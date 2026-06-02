import asyncio
import logging
import time
from typing import Dict, Any, List, Optional
from ..config import get_settings
from ..schemas import VideoMetadata
from ..utils.engagement import calculate_engagement_rate
from ..utils.id_utils import extract_video_id
from . import youtube_service, instagram_service, transcript_service, chunking_service, vectorstore_service, video_cache_service


settings = get_settings()


def to_optional_int(val) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def validate_url(url: str, label: str):
    url_lower = (url or "").lower().strip()
    if not (url_lower.startswith("http://") or url_lower.startswith("https://")):
        raise ValueError(f"Invalid URL for Video {label}: must start with http:// or https://")
    
    is_youtube = any(p in url_lower for p in ["youtube.com", "youtu.be"])
    is_instagram = "instagram.com" in url_lower
    
    if not is_youtube and not is_instagram:
        raise ValueError(f"Unsupported platform for Video {label}: Currently supported: YouTube and Instagram.")


async def ingest_pair(session_id: str, video_a_url: str, video_b_url: str) -> Dict[str, Any]:
    logger = logging.getLogger(__name__)
    warnings: List[str] = []
    
    # Run link validations first (raises ValueError on fail)
    validate_url(video_a_url, "A")
    validate_url(video_b_url, "B")

    video_a = None
    chunks_a = 0
    warnings_a = []
    
    video_b = None
    chunks_b = 0
    warnings_b = []
    
    err_a = None
    err_b = None

    try:
        video_a, chunks_a, warnings_a = await ingest_single(session_id, "A", video_a_url)
    except Exception as e:
        err_a = e
        logger.warning(f"Ingestion failed for Video A: {e}")
        
    try:
        video_b, chunks_b, warnings_b = await ingest_single(session_id, "B", video_b_url)
    except Exception as e:
        err_b = e
        logger.warning(f"Ingestion failed for Video B: {e}")

    # If both failed, raise the error (or a combined ValueError)
    if err_a and err_b:
        raise ValueError(f"Both videos were completely inaccessible.\nVideo A: {str(err_a)}\nVideo B: {str(err_b)}")

    # If Video A failed, construct a fallback VideoMetadata for A
    if err_a:
        platform_a = "youtube" if any(p in video_a_url.lower() for p in ["youtube.com", "youtu.be"]) else "instagram"
        video_id_a = extract_video_id(video_a_url, platform_a) or "failed_a"
        video_a = VideoMetadata(
            video_id=video_id_a,
            url=video_a_url,
            platform=platform_a,
            title="Video A (Unavailable)",
            description=f"This video could not be analyzed: {str(err_a)}",
            transcript_available=False,
            transcript_source="unavailable",
            warnings=[f"Video A is inaccessible: {str(err_a)}"]
        )
        warnings.append(f"Video A is inaccessible: {str(err_a)}")

    # If Video B failed, construct a fallback VideoMetadata for B
    if err_b:
        platform_b = "youtube" if any(p in video_b_url.lower() for p in ["youtube.com", "youtu.be"]) else "instagram"
        video_id_b = extract_video_id(video_b_url, platform_b) or "failed_b"
        video_b = VideoMetadata(
            video_id=video_id_b,
            url=video_b_url,
            platform=platform_b,
            title="Video B (Unavailable)",
            description=f"This video could not be analyzed: {str(err_b)}",
            transcript_available=False,
            transcript_source="unavailable",
            warnings=[f"Video B is inaccessible: {str(err_b)}"]
        )
        warnings.append(f"Video B is inaccessible: {str(err_b)}")

    warnings.extend(warnings_a)
    warnings.extend(warnings_b)
    chunks_indexed = chunks_a + chunks_b
    logger.info("Chunks indexed: %s", chunks_indexed)

    available_transcript_videos = []
    if video_a.transcript_available:
        available_transcript_videos.append("A")
    if video_b.transcript_available:
        available_transcript_videos.append("B")

    return {
        "session_id": session_id,
        "video_a": video_a.model_dump(),
        "video_b": video_b.model_dump(),
        "chunks_indexed": chunks_indexed,
        "warnings": warnings,
        "available_transcript_videos": available_transcript_videos,
    }


async def ingest_single(session_id: str, label: str, url: str):
    logger = logging.getLogger(__name__)
    warnings: List[str] = []
    
    # Detect platform
    platform = None
    url_lower = (url or "").lower().strip()
    if any(p in url_lower for p in ["youtube.com", "youtu.be"]):
        platform = "youtube"
    elif "instagram.com" in url_lower:
        platform = "instagram"

    # Try to extract video ID from URL first
    video_id = extract_video_id(url, platform) if platform else None
    
    meta = None
    transcript_text = ""
    transcript_available = False
    transcript_lang_code = "unknown"
    transcript_lang_name = "Unknown"
    transcript_original_text = ""
    transcript_source = "none"
    translation_used = False
    
    meta_cache_hit = False
    transcript_cache_hit = False
    embedding_cache_hit = False
    
    meta_time = 0.0
    transcription_time = 0.0
    chunk_count = 0

    # 1. Check cache if platform and video ID are known
    cached_data = None
    # Completely disabled: do not read or reuse cached data
    # if platform and video_id:
    #     cached_data = video_cache_service.get_video_cache(platform, video_id)
        
    if cached_data:
        hit_type = cached_data.get("hit_type", "PARTIAL_CACHE_HIT")
        meta_stale = cached_data.get("meta_stale", False)

        if not meta_stale:
            # Metadata is fresh — reuse it
            meta = cached_data["metadata"]
            meta_cache_hit = True
            logger.info(
                "[CACHE HIT] Fresh metadata for Video %s (%s/%s)",
                label, platform, video_id,
            )
        else:
            # Metadata TTL expired — silently re-extract
            logger.info(
                "[CACHE HIT + META REFRESH] Metadata stale for Video %s (%s/%s) — re-extracting",
                label, platform, video_id,
            )
            meta_start = time.time()
            try:
                if platform == "youtube":
                    meta = await youtube_service.get_metadata(url)
                elif platform == "instagram":
                    meta = await instagram_service.get_metadata(url)
                else:
                    meta = await youtube_service.get_metadata(url)
                if meta and meta.get("video_id"):
                    video_id = meta.get("video_id")
            except Exception as e:
                warnings.append(f"Metadata refresh failed for Video {label}: {str(e)}")
                meta = cached_data.get("metadata", {})   # fall back to stale cache
            meta_time = time.time() - meta_start

        if hit_type == "FULL_CACHE_HIT":
            logger.info("Full cache hit: transcript and embeddings valid.")
            tc_data = cached_data.get("transcript_data", {})
            transcript_text = tc_data.get("transcript_text", "")
            transcript_available = tc_data.get("transcript_available", False)
            transcript_warnings = tc_data.get("transcript_warnings", [])
            transcript_lang_code = tc_data.get("transcript_lang_code", "unknown")
            transcript_lang_name = tc_data.get("transcript_lang_name", "Unknown")
            transcript_original_text = tc_data.get("transcript_original_text", "")
            transcript_source = tc_data.get("transcript_source", "cache")
            warnings.extend(transcript_warnings)
            transcript_cache_hit = True
            embedding_cache_hit = True
            chunks_currently_exist = True
            logger.info(
                "[CACHE HIT] Fresh transcript and embeddings for Video %s (%s/%s)",
                label, platform, video_id,
            )
        else:
            # PARTIAL_CACHE_HIT (due to missing transcript, empty, bad source, or chroma count == 0)
            logger.info("Partial cache hit: metadata found, transcript/index missing. Repairing.")
            logger.info("Partial cache found. Repairing transcript/index for video.")
            dur_sec_tmp = int(meta.get("duration_seconds") or 0) if meta else 0
            transcript_start = time.time()
            try:
                (
                    transcript_text,
                    transcript_available,
                    transcript_warnings,
                    transcript_lang_code,
                    transcript_lang_name,
                    transcript_original_text,
                    transcript_source,
                ) = await transcript_service.get_transcript(url, platform or "", duration_seconds=dur_sec_tmp)
                warnings.extend(transcript_warnings)
            except Exception as e:
                warnings.append(f"Transcript extraction failed for Video {label}. Reason: {str(e)}")
            transcription_time = time.time() - transcript_start
            
            # Since we are repairing chunks/embeddings, chunks do not currently exist
            chunks_currently_exist = False
            embedding_cache_hit = False
            transcript_cache_hit = False
    else:
        # Cache miss! Extract metadata and transcript
        logger.info(f"[CACHE MISS] Cache miss for Video {label} ({url})")
        
        # Metadata extraction
        meta_start = time.time()
        try:
            if platform == "youtube":
                meta = await youtube_service.get_metadata(url)
            elif platform == "instagram":
                meta = await instagram_service.get_metadata(url)
            else:
                meta = await youtube_service.get_metadata(url)
            # Update video_id if it wasn't extracted from URL or was different
            if meta and meta.get("video_id"):
                video_id = meta.get("video_id")
        except ValueError as ve:
            raise ve
        except Exception as e:
            warnings.append(f"Metadata extraction failed for Video {label}. Reason: {str(e)}")
            meta = {}
        meta_time = time.time() - meta_start
        
        # Compute duration seconds early
        dur_sec = int(meta.get("duration_seconds") or 0) if meta else 0

        # Transcription
        transcript_start = time.time()
        try:
            (
                transcript_text,
                transcript_available,
                transcript_warnings,
                transcript_lang_code,
                transcript_lang_name,
                transcript_original_text,
                transcript_source,
            ) = await transcript_service.get_transcript(url, platform or "", duration_seconds=dur_sec)
            warnings.extend(transcript_warnings)
        except Exception as e:
            warnings.append(f"Transcript extraction failed for Video {label}. Reason: {str(e)}")
        transcription_time = time.time() - transcript_start
        
        chunks_currently_exist = False

    # Detect if translation was applied
    if transcript_original_text and transcript_text:
        if transcript_original_text.strip() != transcript_text.strip():
            translation_used = True

    # Transcript Quality Validation (Task 7)
    if transcript_text:
        is_valid = True
        stripped_text = transcript_text.strip()
        if len(stripped_text) < 30:
            is_valid = False
        else:
            words_list = stripped_text.split()
            if len(words_list) < 5:
                is_valid = False
                
        if not is_valid:
            if "Transcript quality insufficient for reliable AI comparison." not in warnings:
                warnings.append("Transcript quality insufficient for reliable AI comparison.")
            transcript_text = ""
            transcript_available = False
            transcript_original_text = ""
            transcript_source = "unavailable"

    # Format upload date (YYYYMMDD to YYYY-MM-DD)
    raw_date = meta.get("upload_date") if meta else None
    upload_date_formatted = None
    if raw_date:
        if len(raw_date) == 8 and raw_date.isdigit():
            upload_date_formatted = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
        else:
            upload_date_formatted = raw_date

    # Format duration string
    dur_sec = int(meta.get("duration_seconds") or 0) if meta else 0
    duration_string = None
    if dur_sec > 0:
        h = dur_sec // 3600
        m = (dur_sec % 3600) // 60
        s = dur_sec % 60
        if h > 0:
            duration_string = f"{h}:{m:02d}:{s:02d}"
        else:
            duration_string = f"{m}:{s:02d}"

    # Calculate derived content insights
    hook_summary = None
    word_count = 0
    speaking_density = 0.0
    content_type_guess = "Educational/Informational"
    
    if transcript_text:
        hook_summary = transcript_text[:180].strip() + ("..." if len(transcript_text) > 180 else "")
        word_count = len(transcript_text.split())
        if dur_sec > 0:
            speaking_density = round(word_count / (dur_sec / 60.0), 1)

        # Keyword guess
        title_val = meta.get("title") or ""
        desc_val = meta.get("description") or ""
        tags_list = meta.get("tags") or []
        combined_text = f"{title_val} {desc_val} {' '.join(tags_list)}".lower()
        
        if any(kw in combined_text for kw in ["tutorial", "how to", "guide", "learn", "course", "explain"]):
            content_type_guess = "Tutorial / Guide"
        elif any(kw in combined_text for kw in ["review", "unboxing", "comparison", "test", "versus", "vs"]):
            content_type_guess = "Product Review"
        elif any(kw in combined_text for kw in ["vlog", "day in", "daily", "life", "travel", "routine"]):
            content_type_guess = "Vlog / Lifestyle"
        elif any(kw in combined_text for kw in ["comedy", "funny", "meme", "joke", "prank", "humor"]):
            content_type_guess = "Comedy / Entertainment"
        elif any(kw in combined_text for kw in ["news", "update", "report", "breaking", "politics", "world"]):
            content_type_guess = "News / Commentary"
        elif any(kw in combined_text for kw in ["podcast", "interview", "talk", "chat", "show"]):
            content_type_guess = "Podcast / Talk Show"

    # Calculate transcript source mapping (Task 6)
    t_source = "unavailable"
    if transcript_text:
        if "manual" in transcript_source:
            t_source = "captions"
        elif "generated" in transcript_source or "fallback" in transcript_source:
            t_source = "auto_captions"
        elif "whisper" in transcript_source:
            t_source = "audio_whisper"
    else:
        meta_desc = meta.get("description") or ""
        meta_title = meta.get("title") or ""
        meta_tags = " ".join(meta.get("tags") or [])
        combined_text_check = f"Title: {meta_title}\nDescription: {meta_desc}\nTags: {meta_tags}".strip()
        if len(combined_text_check) > 30:
            t_source = "description"

    # Task 9: Huge video duration check (e.g. > 20 minutes)
    if dur_sec > 1200:
        warnings.append("Long video detected. Transcribed key sections.")

    # Normalize transcript language code (Task 6)
    norm_lang = "unknown"
    if transcript_lang_code:
        lang_lower = transcript_lang_code.lower().strip()
        if lang_lower.startswith("en"):
            norm_lang = "en"
        elif lang_lower.startswith("hi"):
            norm_lang = "hi"
        elif lang_lower.startswith("bn"):
            norm_lang = "bn"
        elif "mixed" in lang_lower or "hinglish" in lang_lower:
            norm_lang = "mixed"
        else:
            norm_lang = "unknown"

    # Normalize into VideoMetadata
    vm = VideoMetadata(
        video_id=video_id or meta.get("video_id") if meta else None,
        url=url,
        platform=platform,
        creator=meta.get("creator") if meta else None,
        follower_count=to_optional_int(meta.get("follower_count")) if meta else None,
        views=to_optional_int(meta.get("views")) if meta else None,
        likes=to_optional_int(meta.get("likes")) if meta else None,
        comments=to_optional_int(meta.get("comments")) if meta else None,
        hashtags=meta.get("hashtags") or [],
        upload_date=meta.get("upload_date") if meta else None,
        duration_seconds=dur_sec,
        transcript_available=bool(transcript_text),
        
        # Expanded metadata fields
        title=meta.get("title") or f"Video {label}",
        description=meta.get("description"),
        thumbnail_url=meta.get("thumbnail_url"),
        creator_url=meta.get("creator_url"),
        channel_url=meta.get("channel_url"),
        tags=meta.get("tags") or [],
        categories=meta.get("categories") or [],
        language=meta.get("language"),
        age_limit=meta.get("age_limit"),
        webpage_url=meta.get("webpage_url"),
        average_rating=meta.get("average_rating"),
        comment_count=to_optional_int(meta.get("comment_count")) if meta else None,
        like_count=to_optional_int(meta.get("like_count")) if meta else None,
        view_count=to_optional_int(meta.get("view_count")) if meta else None,
        duration_string=duration_string or (meta.get("duration_string") if meta else None),
        upload_date_formatted=upload_date_formatted,
        platform_display_name=meta.get("platform_display_name") if meta and meta.get("platform_display_name") else (platform.capitalize() if platform else "Video"),
        
        # Extra playable / source fields
        source_url=url,
        playable_url=meta.get("playable_url"),
        transcript_source=t_source,
        metadata_quality=meta.get("metadata_quality") if meta else None,
        warnings=warnings,
        
        # Derived properties
        hook_summary=hook_summary,
        transcript_word_count=word_count,
        estimated_speaking_density=speaking_density,
        content_type_guess=content_type_guess,
        has_transcript=bool(transcript_text),
        transcript_language=norm_lang,
        transcript_language_name=transcript_lang_name,
        transcript_original_text=transcript_original_text[:500] if transcript_original_text else None,
        translation_used=translation_used,
    )

    vm.engagement_rate = calculate_engagement_rate(vm.likes, vm.comments, vm.views)

    # Chunk and embed logic
    # Force fresh ingest/embeddings every time: do not reuse existing chunks
    chunks_currently_exist = False
    
    text_to_index = transcript_text
    if not text_to_index:
        # Fallback to Title / Description / Tags index (Task 8)
        meta_desc = meta.get("description") or ""
        meta_title = meta.get("title") or ""
        meta_tags = " ".join(meta.get("tags") or [])
        text_to_index = f"Title: {meta_title}\nDescription: {meta_desc}\nTags: {meta_tags}".strip()
        
    if text_to_index and len(text_to_index) > 30:
        # Clear existing chunks from vectorstore to avoid duplicate indexing
        if vm.video_id:
            try:
                vectorstore_service.delete_video_chunks(vm.video_id)
            except Exception as e:
                logger.warning(f"Failed to clear existing chunks for video {vm.video_id}: {e}")

        chunks = chunking_service.create_chunks(
            session_id=session_id,
            video_id=vm.video_id or label,
            text=text_to_index,
            platform=vm.platform or "",
            source_url=url,
            creator=vm.creator or "",
            engagement_rate=vm.engagement_rate,
            video_label=f"Video {label}",
            title=vm.title,
            original_text=transcript_original_text,
        )
        logger.info("Created %s chunks for Video %s", len(chunks), label)
        # Add to vectorstore
        try:
            chunk_count = vectorstore_service.add_video_chunks(session_id, vm.video_id or label, chunks)
            logger.info("Inserted %s chunks for Video %s", chunk_count, label)
        except Exception as e:
            warnings.append(f"Vectorstore insert failed for Video {label}: {e}")
    else:
        if not transcript_text:
            warnings.append(f"Transcript and metadata unavailable for indexing Video {label}.")

    # Save / refresh cache
    # Write if: (a) was a full cache miss, (b) metadata was stale and re-extracted,
    # (c) transcript was stale and re-extracted, or (d) chunks were freshly embedded.
    _should_write_meta = not cached_data or (cached_data and cached_data.get("meta_stale", False))
    _should_write_tx = not cached_data or (cached_data and cached_data.get("transcript_stale", False))
    _force_meta = _should_write_meta

    if platform and vm.video_id and (_should_write_meta or _should_write_tx or not chunks_currently_exist):
        video_cache_service.save_video_cache(
            platform=platform,
            video_id=vm.video_id,
            metadata=meta,
            transcript_data={
                "transcript_text": transcript_text,
                "transcript_available": bool(transcript_text),
                "transcript_warnings": warnings,
                "transcript_lang_code": transcript_lang_code,
                "transcript_lang_name": transcript_lang_name,
                "transcript_original_text": transcript_original_text,
                "transcript_source": transcript_source,
            },
            chunks_exist=bool(text_to_index and (chunks_currently_exist or chunk_count > 0)),
            force_meta_refresh=_force_meta,
        )
        logger.info("[CACHE WRITE] Cache persisted for Video %s (%s/%s)", label, platform, vm.video_id)

    # 11. Timing / cost log
    cache_status = "FULL_HIT" if (meta_cache_hit and transcript_cache_hit and embedding_cache_hit) else \
                   "PARTIAL_HIT" if (meta_cache_hit or transcript_cache_hit or embedding_cache_hit) else "MISS"
    logger.info("============================================================")
    logger.info(" TIMING & COST STATISTICS  |  Video %s", label)
    logger.info("  Cache status      : %s", cache_status)
    logger.info("  Meta time         : %.3fs  (cache_hit=%s)", meta_time, meta_cache_hit)
    logger.info("  Transcript source : %s  (cache_hit=%s)", transcript_source, transcript_cache_hit)
    logger.info("  Transcription time: %.3fs", transcription_time)
    logger.info("  Chunks embedded   : %d  (cache_hit=%s)", chunk_count, embedding_cache_hit)
    logger.info("============================================================")

    # Check if this was a partial cache hit repair attempt
    if cached_data and cached_data.get("hit_type") == "PARTIAL_CACHE_HIT":
        has_chunks_now = vectorstore_service.validate_video_index(vm.video_id) if vm.video_id else False
        if transcript_text and has_chunks_now:
            logger.info("Transcript repaired and indexed successfully.")
        else:
            logger.info("Transcript repair failed after all fallback methods.")

    return vm, chunk_count, warnings


