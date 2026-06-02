import os
import sys
import pytest
from unittest.mock import AsyncMock, patch

# Ensure backend package is importable when running pytest from repo root
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.services.ingestion_service import ingest_pair, ingest_single
from app.schemas import VideoMetadata


@pytest.mark.anyio
@patch("app.services.ingestion_service.ingest_single")
async def test_ingest_pair_single_video_fallback(mock_ingest_single):
    # Mock ingest_single: Video A succeeds, Video B raises ValueError
    video_a_meta = VideoMetadata(
        video_id="vid_a",
        url="https://youtube.com/watch?v=vid_a",
        platform="youtube",
        title="Video A Success",
        creator="creator_a",
        upload_date="20260531",
        transcript_available=True,
        transcript_source="captions",
    )
    mock_ingest_single.side_effect = [
        (video_a_meta, 3, []),
        ValueError("Video is private or deleted"),
    ]
    
    result = await ingest_pair("sess_test", "https://youtube.com/watch?v=vid_a", "https://instagram.com/reel/vid_b")
    
    assert result["session_id"] == "sess_test"
    assert result["video_a"]["title"] == "Video A Success"
    # Video B should fallback gracefully
    assert result["video_b"]["title"] == "Video B (Unavailable)"
    assert "inaccessible: Video is private or deleted" in result["warnings"][0]


@pytest.mark.anyio
@patch("app.services.ingestion_service.ingest_single")
async def test_ingest_pair_both_videos_fail(mock_ingest_single):
    # Both fail -> should raise ValueError
    mock_ingest_single.side_effect = [
        ValueError("Video A private"),
        ValueError("Video B deleted"),
    ]
    
    with pytest.raises(ValueError) as exc_info:
        await ingest_pair("sess_test", "https://youtube.com/watch?v=vid_a", "https://instagram.com/reel/vid_b")
        
    assert "Both videos were completely inaccessible" in str(exc_info.value)
