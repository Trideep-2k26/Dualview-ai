from typing import Any, Optional
from urllib.parse import urlparse


def make_chunk_id(video_id: str, index: int) -> str:
    # Format: VIDEO-001
    v = (video_id or "V").upper()
    return f"{v}-{index:03d}"


def extract_video_id(url: str, platform: str) -> Optional[str]:
    if not url:
        return None
    url_lower = url.lower().strip()
    if platform == "youtube":
        try:
            parsed = urlparse(url)
            host = (parsed.netloc or "").lower()
            path = parsed.path or ""

            if "youtu.be" in host:
                return path.strip("/")

            if "/shorts/" in path:
                return path.split("/shorts/")[-1].split("/")[0]

            if "youtube.com" in host:
                query = parsed.query or ""
                for part in query.split("&"):
                    if part.startswith("v="):
                        return part.split("=")[-1]
        except Exception:
            return None
    elif platform == "instagram":
        try:
            parsed = urlparse(url)
            path = parsed.path.strip("/")
            parts = path.split("/")
            for idx, part in enumerate(parts):
                if part in ["reel", "p", "tv"] and idx + 1 < len(parts):
                    return parts[idx + 1]
            if parts:
                return parts[-1]
        except Exception:
            return None
    return None

