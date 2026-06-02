import os
import sys

# Ensure backend package is importable when running pytest from repo root
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.services.chunking_service import create_chunks


def test_chunking_short_text():
    text = "This is a short transcript."
    chunks = create_chunks("sess1", "VID1", text, "youtube", "http://x", "creator", 1.2)
    assert len(chunks) == 1
    assert chunks[0]["video_id"] == "VID1"
    assert "text" in chunks[0]


def test_chunking_with_original_text():
    translated_text = "This is the first segment of translated text. And this is the second segment of translated text."
    original_text = "यह अनुवादित पाठ का पहला खंड है। और यह अनुवादित पाठ का दूसरा खंड है।"
    
    chunks = create_chunks(
        "sess1", "VID1", translated_text, "youtube", "http://x", "creator", 1.2,
        original_text=original_text
    )
    
    assert len(chunks) >= 1
    assert "original_text" in chunks[0]
    assert len(chunks[0]["original_text"]) > 0
