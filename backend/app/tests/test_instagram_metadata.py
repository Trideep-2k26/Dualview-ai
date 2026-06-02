import os
import sys
import pytest

# Ensure backend package is importable when running pytest from repo root
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.services.instagram_service import get_metadata, extract_views_from_dict


def test_extract_views_from_dict():
    # Simple nested structure
    nested_data = {
        "id": "123",
        "nested": {
            "more_nested": {
                "play_count": 9876
            }
        }
    }
    assert extract_views_from_dict(nested_data) == 9876

    # List of dicts structure
    list_data = {
        "items": [
            {"something": 123},
            {"video_play_count": "1040"}
        ]
    }
    assert extract_views_from_dict(list_data) == 1040

    # No views found
    empty_data = {
        "likes": 50,
        "comments": 20
    }
    assert extract_views_from_dict(empty_data) == 0


@pytest.mark.anyio
async def test_get_metadata_instagram_views(monkeypatch):
    # Mock yt-dlp to return different info responses
    mock_info = {
        "id": "insta_reel_123",
        "uploader": "TestCreator",
        "like_count": 150,
        "comment_count": 45,
        "duration": 60,
        "url": "http://instagram.com/playable.mp4",
        "title": "A Cool Instagram Reel",
        # Views exposed under play_count instead of view_count
        "play_count": 5000,
        "view_count": 0,
    }

    class MockYoutubeDL:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def extract_info(self, url, download=False):
            return mock_info

    monkeypatch.setattr("yt_dlp.YoutubeDL", MockYoutubeDL)

    # Run get_metadata
    meta = await get_metadata("https://www.instagram.com/reel/C321456/")
    
    # Assert plays mapped to views successfully
    assert meta["views"] == 5000
    assert meta["metadata_quality"] == "full"


@pytest.mark.anyio
async def test_get_metadata_instagram_views_missing(monkeypatch):
    # Mock yt-dlp returning no views
    mock_info = {
        "id": "insta_reel_456",
        "uploader": "TestCreator",
        "like_count": 150,
        "comment_count": 45,
        "duration": 60,
        "url": "http://instagram.com/playable.mp4",
        "title": "A Cool Instagram Reel",
        # Both are 0 or missing
        "play_count": 0,
        "view_count": 0,
    }

    class MockYoutubeDL:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def extract_info(self, url, download=False):
            return mock_info

    monkeypatch.setattr("yt_dlp.YoutubeDL", MockYoutubeDL)

    # Run get_metadata
    meta = await get_metadata("https://www.instagram.com/reel/C321456/")
    
    # Assert views is None and quality is partial
    assert meta["views"] is None
    assert meta["metadata_quality"] == "partial"
