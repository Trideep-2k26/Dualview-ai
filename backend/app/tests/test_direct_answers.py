import os
import sys

# Ensure backend package is importable when running pytest from repo root
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest
from app.services.rag_service import handle_metadata_direct_question


def test_handle_metadata_direct_question():
    video_a = {
        "title": "Unboxing Video",
        "creator": "TechGuy",
        "views": 150000,
        "likes": 8000,
        "comments": 450,
        "engagement_rate": 5.63,
        "duration_string": "10:15",
        "upload_date_formatted": "2026-05-15"
    }
    
    video_b = {
        "title": "Review Video",
        "creator": "GadgetGirl",
        "views": 200000,
        "likes": 12000,
        "comments": 900,
        "engagement_rate": 6.45,
        "duration_string": "12:30",
        "upload_date_formatted": "2026-05-20"
    }
    
    # Simple metric queries - views
    res1 = handle_metadata_direct_question("how many views does video A have?", video_a, video_b)
    assert res1 is not None
    assert "150,000" in res1
    
    res2 = handle_metadata_direct_question("compare views between the videos", video_a, video_b)
    assert res2 is not None
    assert "Unboxing Video" in res2
    assert "Review Video" in res2
    assert "50,000" in res2 or "difference" in res2
    
    # Likes
    res3 = handle_metadata_direct_question("who has more likes?", video_a, video_b)
    assert res3 is not None
    assert "Review Video" in res3
    assert "12,000" in res3
    
    # Creator
    res4 = handle_metadata_direct_question("who is the creator of video A?", video_a, video_b)
    assert res4 is not None
    assert "TechGuy" in res4
    assert "GadgetGirl" in res4

    # Skip reasoning queries
    res5 = handle_metadata_direct_question("why does video B have more views?", video_a, video_b)
    assert res5 is None
    
    res6 = handle_metadata_direct_question("how can we improve engagement for video a?", video_a, video_b)
    assert res6 is None
