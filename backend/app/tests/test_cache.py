"""
test_cache.py
=============
Tests for the production SQLite-backed video_cache_service.

Uses a temporary in-memory/temp-path database so production data is never touched.
"""
import os
import sys
import tempfile
import importlib

import pytest

# Ensure backend package is importable when running pytest from repo root
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.utils.id_utils import extract_video_id


# ---------------------------------------------------------------------------
# Fixture: redirect the SQLite DB to a temp file for test isolation
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def _isolated_cache(tmp_path, monkeypatch):
    """
    Point the cache module at a fresh temp SQLite file and reset its singleton
    connection so each test starts clean.
    """
    import app.services.video_cache_service as vcs

    # Patch the DB path before connection is opened
    db_file = str(tmp_path / "test_video_cache.sqlite")
    monkeypatch.setattr(vcs, "_DB_PATH", db_file)
    # Also patch the cache dir so makedirs works
    monkeypatch.setattr(vcs, "_CACHE_DIR", str(tmp_path))
    
    # Enable cache specifically for cache tests
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "CACHE_ENABLED", True)

    # Reset singleton connection so the next call re-initialises at the new path
    old_conn = vcs._conn
    vcs._conn = None
    yield
    # Teardown: close and reset connection
    if vcs._conn is not None:
        try:
            vcs._conn.close()
        except Exception:
            pass
    vcs._conn = old_conn  # restore (may be None)


# ---------------------------------------------------------------------------
# Re-import helper (same module, so we just use the already-imported one)
# ---------------------------------------------------------------------------
from app.services import video_cache_service as vcs


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
SAMPLE_META = {"title": "Test Video", "views": 12345, "duration_seconds": 300}
SAMPLE_TX = {
    "transcript_text": "Hello world this is a test transcript.",
    "transcript_available": True,
    "transcript_warnings": [],
    "transcript_lang_code": "en",
    "transcript_lang_name": "English",
    "transcript_original_text": "Hello world this is a test transcript.",
    "transcript_source": "youtube_captions_manual",
}


# ---------------------------------------------------------------------------
# URL / ID extraction tests (independent of cache backend)
# ---------------------------------------------------------------------------
class TestExtractVideoId:
    def test_youtube_watch(self):
        assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube") == "dQw4w9WgXcQ"

    def test_youtube_short_url(self):
        assert extract_video_id("https://youtu.be/dQw4w9WgXcQ", "youtube") == "dQw4w9WgXcQ"

    def test_youtube_shorts(self):
        assert extract_video_id("https://www.youtube.com/shorts/dQw4w9WgXcQ", "youtube") == "dQw4w9WgXcQ"

    def test_instagram_reel(self):
        assert extract_video_id("https://www.instagram.com/reel/C321456/", "instagram") == "C321456"

    def test_instagram_post_with_query(self):
        assert extract_video_id("https://www.instagram.com/p/C321456/?igsh=123", "instagram") == "C321456"


# ---------------------------------------------------------------------------
# Core cache CRUD tests
# ---------------------------------------------------------------------------
class TestCacheSaveAndGet:
    def test_miss_on_empty_db(self):
        result = vcs.get_video_cache("youtube", "nonexistent_id")
        assert result is None

    def test_save_then_get(self):
        vcs.save_video_cache("youtube", "vid001", SAMPLE_META, SAMPLE_TX, chunks_exist=True)
        cached = vcs.get_video_cache("youtube", "vid001")

        assert cached is not None
        assert cached["cache_hit"] is True
        assert cached["metadata"]["title"] == "Test Video"
        assert cached["metadata"]["views"] == 12345
        assert cached["transcript_data"]["transcript_text"] == "Hello world this is a test transcript."

    def test_fresh_entry_is_not_stale(self):
        vcs.save_video_cache("youtube", "vid002", SAMPLE_META, SAMPLE_TX, chunks_exist=True)
        cached = vcs.get_video_cache("youtube", "vid002")

        assert cached is not None
        assert cached["meta_stale"] is False
        assert cached["transcript_stale"] is False

    def test_different_platforms_do_not_collide(self):
        meta_yt = dict(SAMPLE_META, title="YouTube Video")
        meta_ig = dict(SAMPLE_META, title="Instagram Reel")
        vcs.save_video_cache("youtube", "shared_id", meta_yt, SAMPLE_TX, chunks_exist=True)
        vcs.save_video_cache("instagram", "shared_id", meta_ig, SAMPLE_TX, chunks_exist=True)

        cached_yt = vcs.get_video_cache("youtube", "shared_id")
        cached_ig = vcs.get_video_cache("instagram", "shared_id")

        assert cached_yt["metadata"]["title"] == "YouTube Video"
        assert cached_ig["metadata"]["title"] == "Instagram Reel"

    def test_none_platform_returns_none(self):
        assert vcs.get_video_cache("", "vid") is None
        assert vcs.get_video_cache(None, "vid") is None  # type: ignore[arg-type]

    def test_none_video_id_returns_none(self):
        assert vcs.get_video_cache("youtube", "") is None

    def test_save_returns_true_on_success(self):
        ok = vcs.save_video_cache("youtube", "vid003", SAMPLE_META, SAMPLE_TX, chunks_exist=False)
        assert ok is True


# ---------------------------------------------------------------------------
# Staleness / TTL tests
# ---------------------------------------------------------------------------
class TestCacheStaleness:
    def test_force_meta_refresh_updates_metadata(self):
        vcs.save_video_cache("youtube", "vid010", SAMPLE_META, SAMPLE_TX, chunks_exist=True)

        updated_meta = dict(SAMPLE_META, views=99999)
        vcs.save_video_cache(
            "youtube", "vid010", updated_meta, SAMPLE_TX,
            chunks_exist=True, force_meta_refresh=True,
        )
        cached = vcs.get_video_cache("youtube", "vid010")
        assert cached["metadata"]["views"] == 99999

    def test_without_force_refresh_stale_meta_not_overwritten(self):
        """When metadata is fresh, a second save without force_meta_refresh keeps original."""
        vcs.save_video_cache("youtube", "vid011", SAMPLE_META, SAMPLE_TX, chunks_exist=True)
        original_views = vcs.get_video_cache("youtube", "vid011")["metadata"]["views"]

        updated_meta = dict(SAMPLE_META, views=55555)
        # force_meta_refresh=False (default) + fresh entry → should NOT overwrite
        vcs.save_video_cache("youtube", "vid011", updated_meta, SAMPLE_TX, chunks_exist=True)

        cached = vcs.get_video_cache("youtube", "vid011")
        # Views should remain original because the entry is fresh
        assert cached["metadata"]["views"] == original_views


# ---------------------------------------------------------------------------
# Invalidation tests
# ---------------------------------------------------------------------------
class TestCacheInvalidation:
    def test_invalidate_removes_entry(self):
        vcs.save_video_cache("youtube", "vid020", SAMPLE_META, SAMPLE_TX, chunks_exist=True)
        assert vcs.get_video_cache("youtube", "vid020") is not None

        ok = vcs.invalidate_video_cache("youtube", "vid020")
        assert ok is True
        assert vcs.get_video_cache("youtube", "vid020") is None

    def test_invalidate_nonexistent_returns_true(self):
        # Should not raise; returns True even if row doesn't exist
        result = vcs.invalidate_video_cache("youtube", "does_not_exist")
        assert result is True


# ---------------------------------------------------------------------------
# Cache stats tests
# ---------------------------------------------------------------------------
class TestCacheStats:
    def test_stats_structure(self):
        stats = vcs.get_cache_stats()
        assert "total_videos_cached" in stats
        assert "total_transcripts_cached" in stats
        assert "hit_rate_pct_24h" in stats
        assert "meta_ttl_hours" in stats
        assert "transcript_ttl_days" in stats

    def test_stats_counts_increase(self):
        before = vcs.get_cache_stats()["total_videos_cached"]
        vcs.save_video_cache("youtube", "vid_stats_1", SAMPLE_META, SAMPLE_TX, chunks_exist=True)
        after = vcs.get_cache_stats()["total_videos_cached"]
        assert after == before + 1

    def test_hit_rate_after_lookups(self):
        vcs.save_video_cache("youtube", "vid_hr_1", SAMPLE_META, SAMPLE_TX, chunks_exist=True)
        vcs.get_video_cache("youtube", "vid_hr_1")   # HIT
        vcs.get_video_cache("youtube", "not_exist")  # MISS
        stats = vcs.get_cache_stats()
        # Hit rate should be 50 % (1 hit, 1 miss)
        assert stats["hit_rate_pct_24h"] == 50.0
