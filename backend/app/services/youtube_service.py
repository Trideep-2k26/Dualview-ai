import asyncio
from typing import Optional, Dict

async def get_metadata(url: str) -> Dict[str, Optional[str]]:
    # Lightweight metadata extraction; prefer yt-dlp if available
    # Return keys: video_id, creator, follower_count, views, likes, comments, hashtags, upload_date, duration_seconds
    try:
        # lazy import yt_dlp to avoid hard dependency during skeleton
        import yt_dlp
    except Exception:
        return {"video_id": None}

    # Use yt-dlp to extract info dict
    ydl_opts = {"skip_download": True, "quiet": True, "force_ipv4": True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:
        msg = str(e).lower()
        if any(w in msg for w in ["private", "deleted", "unavailable", "not found", "does not exist", "removed"]):
            raise ValueError("This video may be private, deleted, or unavailable.")
        elif any(w in msg for w in ["sign in", "login", "confirm your age", "age-restricted", "age restricted", "unplayable"]):
            raise ValueError("This video requires access and could not be analyzed fully.")
        else:
            raise ValueError(f"This video could not be analyzed fully or is invalid.")

    if not info or not info.get("id"):
        raise ValueError("This video may be private, deleted, or unavailable.")

    return {
        "video_id": info.get("id"),
        "creator": info.get("uploader") or info.get("channel"),
        "follower_count": None,
        "views": info.get("view_count") or 0,
        "likes": info.get("like_count") or 0,
        "comments": info.get("comment_count") or 0,
        "hashtags": info.get("tags") or [],
        "upload_date": info.get("upload_date"),
        "duration_seconds": info.get("duration") or 0,
        "title": info.get("title"),
        "description": info.get("description"),
        "thumbnail_url": info.get("thumbnail"),
        "creator_url": info.get("uploader_url"),
        "channel_url": info.get("channel_url"),
        "tags": info.get("tags") or [],
        "categories": info.get("categories") or [],
        "language": info.get("language"),
        "age_limit": info.get("age_limit"),
        "webpage_url": info.get("webpage_url"),
        "average_rating": info.get("average_rating"),
        "comment_count": info.get("comment_count") or 0,
        "like_count": info.get("like_count") or 0,
        "view_count": info.get("view_count") or 0,
        "duration_string": info.get("duration_string"),
        "upload_date_formatted": None,
        "platform_display_name": "YouTube",
        "playable_url": url,
    }



async def get_transcript(url: str) -> Optional[str]:
    # Try youtube-transcript-api first
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except Exception:
        YouTubeTranscriptApi = None

    video_id = None
    if "v=" in url:
        # naive extraction
        video_id = url.split("v=")[-1].split("&")[0]
    elif "youtu.be" in url:
        video_id = url.rstrip("/").split("/")[-1]

    if YouTubeTranscriptApi and video_id:
        try:
            parts = YouTubeTranscriptApi.get_transcript(video_id)
            text = "\n".join([p.get("text", "") for p in parts])
            return text
        except Exception:
            pass

    # Fallback: try yt-dlp to download subtitles or audio (not implemented in skeleton)
    return None
