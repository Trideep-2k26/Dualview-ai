from typing import Dict, Any

def normalize_metadata(raw: Dict[str, Any]) -> Dict[str, Any]:
    # Ensure the metadata has expected keys and types; this is a minimal normalizer
    return {
        "video_id": raw.get("video_id"),
        "creator": raw.get("creator"),
        "follower_count": int(raw.get("follower_count") or 0),
        "views": int(raw.get("views") or 0),
        "likes": int(raw.get("likes") or 0),
        "comments": int(raw.get("comments") or 0),
        "hashtags": raw.get("hashtags") or [],
        "upload_date": raw.get("upload_date"),
        "duration_seconds": int(raw.get("duration_seconds") or 0),
    }
