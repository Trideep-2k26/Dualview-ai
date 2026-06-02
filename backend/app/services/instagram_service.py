import asyncio
import os
import subprocess
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)


def extract_first_frame(video_url: str, output_name: str) -> Optional[str]:
    # Locate data/generated_thumbnails in the parent of app/
    base_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "data", "generated_thumbnails"))
    os.makedirs(base_dir, exist_ok=True)
    output_path = os.path.join(base_dir, f"{output_name}.jpg")
    
    if os.path.exists(output_path):
        return f"/static/thumbnails/{output_name}.jpg"
        
    try:
        # ffmpeg command to capture first frame from remote url
        cmd = [
            "ffmpeg",
            "-y",
            "-ss", "00:00:00.100",
            "-i", video_url,
            "-vframes", "1",
            "-q:v", "2",
            output_path
        ]
        logger.info(f"Running ffmpeg to extract first frame from {video_url} to {output_path}")
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15)
        if res.returncode == 0 and os.path.exists(output_path):
            logger.info(f"Successfully extracted first frame for {output_name}")
            return f"/static/thumbnails/{output_name}.jpg"
        else:
            logger.warning(f"ffmpeg extraction failed: {res.stderr.decode('utf-8', errors='ignore')}")
    except Exception as e:
        logger.warning(f"Failed to extract first frame using ffmpeg: {e}")
    return None


def extract_views_from_dict(d: dict) -> int:
    possible_keys = [
        "view_count", "play_count", "viewCount", "video_play_count", 
        "ig_play_count", "video_view_count", "plays", "views"
    ]
    
    # Check current dict keys
    for k, v in d.items():
        if k in possible_keys:
            if isinstance(v, (int, float)) and v > 0:
                return int(v)
            if isinstance(v, str) and v.isdigit():
                val = int(v)
                if val > 0:
                    return val
                    
    # Recursively check sub-dictionaries and lists
    for k, v in d.items():
        if isinstance(v, dict):
            res = extract_views_from_dict(v)
            if res > 0:
                return res
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, dict):
                    res = extract_views_from_dict(item)
                    if res > 0:
                        return res
    return 0


async def get_metadata(url: str) -> Dict[str, Any]:
    try:
        import yt_dlp
    except Exception:
        return {"video_id": None}

    # Locate cookies file if configured
    cookie_path = os.environ.get("INSTAGRAM_COOKIES_PATH") or os.environ.get("COOKIES_PATH")
    if not cookie_path:
        for possible_name in ["instagram_cookies.txt", "cookies.txt"]:
            for folder in [os.getcwd(), os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"]:
                p = os.path.join(folder, possible_name)
                if os.path.exists(p):
                    cookie_path = p
                    break
            if cookie_path:
                break

    info = None
    extraction_err = None

    # Attempt 1: Standard extraction
    ydl_opts_1 = {"skip_download": True, "quiet": True, "force_ipv4": True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts_1) as ydl:
            info = await asyncio.to_thread(ydl.extract_info, url, download=False)
    except Exception as e:
        extraction_err = e
        logger.warning(f"Standard Instagram metadata extraction failed: {e}. Retrying with mobile user-agent...")

    # Attempt 2: Mobile User-Agent + custom headers + cookies
    if not info:
        headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://www.instagram.com/',
        }
        ydl_opts_2 = {
            "skip_download": True,
            "quiet": True,
            "force_ipv4": True,
            "http_headers": headers,
        }
        if cookie_path and os.path.exists(cookie_path):
            ydl_opts_2["cookiefile"] = cookie_path
            logger.info(f"Using cookies file for Instagram extraction: {cookie_path}")

        try:
            with yt_dlp.YoutubeDL(ydl_opts_2) as ydl:
                info = await asyncio.to_thread(ydl.extract_info, url, download=False)
        except Exception as retry_err:
            extraction_err = retry_err
            logger.error(f"Mobile retry Instagram metadata extraction failed: {retry_err}")

    if not info:
        # Fail gracefully by raising standard error
        msg = str(extraction_err).lower()
        if any(w in msg for w in ["private", "deleted", "unavailable", "not found", "does not exist", "removed"]):
            raise ValueError("This video may be private, deleted, or unavailable.")
        elif any(w in msg for w in ["sign in", "login", "confirm your age", "age-restricted", "age restricted", "unplayable"]):
            raise ValueError("This video requires access and could not be analyzed fully.")
        else:
            raise ValueError("This video could not be analyzed fully or is invalid.")

    if not info.get("id"):
        raise ValueError("This video may be private, deleted, or unavailable.")

    playable_url = info.get("url")

    # Try to extract best available thumbnail
    thumbnail_url = info.get("thumbnail")
    if not thumbnail_url and info.get("thumbnails"):
        try:
            sorted_thumbs = sorted(
                info.get("thumbnails", []),
                key=lambda x: (int(x.get("width") or 0) * int(x.get("height") or 0)),
                reverse=True
            )
            if sorted_thumbs:
                thumbnail_url = sorted_thumbs[0].get("url")
        except Exception:
            pass

    # First frame fallback using ffmpeg
    if not thumbnail_url and playable_url:
        video_id = info.get("id") or "unknown"
        extracted_thumb = extract_first_frame(playable_url, f"insta_{video_id}")
        if extracted_thumb:
            thumbnail_url = extracted_thumb

    # Extract views with multi-field check
    view_fields = [
        "view_count",
        "play_count",
        "viewCount",
        "video_play_count",
        "ig_play_count",
        "video_view_count"
    ]
    
    views = None
    detected_views_source = "none"
    
    for fld in view_fields:
        val = info.get(fld)
        if isinstance(val, (int, float)) and val > 0:
            views = int(val)
            detected_views_source = fld
            break
        elif isinstance(val, str) and val.isdigit():
            val_int = int(val)
            if val_int > 0:
                views = val_int
                detected_views_source = fld
                break
                
    # Fallback to nested recursive search in extractor JSON
    if not views or views == 0:
        nested_views = extract_views_from_dict(info)
        if nested_views > 0:
            views = nested_views
            detected_views_source = "nested_extractor_json"

    likes = info.get("like_count") or 0
    comments = info.get("comment_count") or 0
    creator = info.get("uploader") or info.get("uploader_id") or "unknown"

    # Ingestion debug logs (Requirement 5)
    logger.info("=========================================")
    logger.info("INSTAGRAM METADATA EXTRACTION DEBUG LOGS:")
    logger.info(f"  - Creator                 : {creator}")
    logger.info(f"  - Likes                   : {likes}")
    logger.info(f"  - Comments                : {comments}")
    logger.info(f"  - Detected Views          : {views}")
    logger.info(f"  - Detected Views Source   : {detected_views_source}")
    logger.info(f"  - Transcript Availability : Whisper audio transcribable")
    logger.info(f"  - Media URL Available     : {bool(playable_url)}")
    logger.info("=========================================")

    # Determine metadata quality
    if views and views > 0 and likes > 0 and comments > 0:
        metadata_quality = "full"
    elif not views or views == 0:
        metadata_quality = "partial"
    elif likes == 0 and comments == 0:
        metadata_quality = "minimal"
    else:
        metadata_quality = "partial"

    return {
        "video_id": info.get("id"),
        "creator": creator,
        "follower_count": None,
        "views": views,
        "likes": likes,
        "comments": comments,
        "hashtags": info.get("tags") or [],
        "upload_date": info.get("upload_date"),
        "duration_seconds": info.get("duration") or 0,
        "title": info.get("title") or f"Instagram Video",
        "description": info.get("description"),
        "thumbnail_url": thumbnail_url,
        "creator_url": info.get("uploader_url"),
        "channel_url": info.get("channel_url"),
        "tags": info.get("tags") or [],
        "categories": info.get("categories") or [],
        "language": info.get("language"),
        "age_limit": info.get("age_limit"),
        "webpage_url": info.get("webpage_url"),
        "average_rating": info.get("average_rating"),
        "comment_count": comments,
        "like_count": likes,
        "view_count": views,
        "duration_string": info.get("duration_string"),
        "upload_date_formatted": None,
        "platform_display_name": "Instagram",
        "playable_url": playable_url,
        "metadata_quality": metadata_quality,
    }


async def get_transcript(url: str) -> Optional[str]:
    return None


