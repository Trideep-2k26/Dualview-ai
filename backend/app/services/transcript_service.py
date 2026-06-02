import asyncio
import logging
import os
from typing import Optional, Tuple, List
from urllib.parse import urlparse


logger = logging.getLogger(__name__)

_WHISPER_MODEL = None
_WHISPER_TYPE = None

# Full list of supported language codes for caption fetching
# Ordered by preference: English variants first, then major Indian languages
CAPTION_LANGUAGES = [
    "en", "en-US", "en-GB", "en-IN",          # English variants
    "hi", "hi-IN",                              # Hindi
    "bn", "bn-IN", "bn-BD",                    # Bengali
    "ta", "ta-IN",                              # Tamil
    "te", "te-IN",                              # Telugu
    "mr",                                       # Marathi
    "gu",                                       # Gujarati
    "pa", "pa-IN",                              # Punjabi
    "kn",                                       # Kannada
    "ml",                                       # Malayalam
    "ur",                                       # Urdu
]


def _extract_youtube_id(url: str) -> Optional[str]:
    try:
        parsed = urlparse(url)
        host = (parsed.netloc or "").lower()
        path = parsed.path or ""

        if "youtu.be" in host:
            return path.strip("/")

        if "/shorts/" in path:
            return path.split("/shorts/")[-1].split("/")[0]

        if "youtube.com" in host:
            # query param v=...
            query = parsed.query or ""
            for part in query.split("&"):
                if part.startswith("v="):
                    return part.split("=")[-1]
    except Exception:
        return None
    return None


def _load_whisper_model(model_name: str = "base"):
    global _WHISPER_MODEL, _WHISPER_TYPE
    if _WHISPER_MODEL is None:
        try:
            from faster_whisper import WhisperModel
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            logger.info(f"Loading faster-whisper model '{model_name}' on device: {device} (compute: {compute_type})")
            _WHISPER_MODEL = WhisperModel(model_name, device=device, compute_type=compute_type)
            _WHISPER_TYPE = "faster"
        except ImportError:
            try:
                import whisper
                logger.info(f"Loading openai-whisper model '{model_name}'")
                _WHISPER_MODEL = whisper.load_model(model_name)
                _WHISPER_TYPE = "openai"
            except ImportError:
                raise ImportError("Neither faster-whisper nor openai-whisper is installed.")
    return _WHISPER_MODEL


def download_audio_with_ytdlp(url: str, max_duration_seconds: Optional[int] = None) -> str:
    try:
        import yt_dlp
    except Exception as e:
        raise RuntimeError("yt-dlp not installed") from e

    base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "runtime_temp", "audio")
    os.makedirs(base_dir, exist_ok=True)

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(base_dir, "%(id)s.%(ext)s"),
        "quiet": False,
        "noplaylist": True,
        "force_ipv4": True,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
    }

    if max_duration_seconds:
        ydl_opts["postprocessor_args"] = {
            "ffmpeg": ["-ss", "00:00:00", "-t", str(max_duration_seconds)]
        }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)

    video_id = info.get("id")
    if not video_id:
        raise RuntimeError("yt-dlp did not return video id")

    mp3_path = os.path.join(base_dir, f"{video_id}.mp3")
    if not os.path.exists(mp3_path):
        # Fallback: find any mp3 with matching id prefix
        for name in os.listdir(base_dir):
            if name.startswith(video_id) and name.lower().endswith(".mp3"):
                mp3_path = os.path.join(base_dir, name)
                break
        if not os.path.exists(mp3_path):
            raise RuntimeError("mp3 file not found after yt-dlp download")

    return mp3_path


def transcribe_audio_file(path: str, model_name: str = "base") -> Tuple[Optional[str], Optional[str], Optional[str]]:
    try:
        model = _load_whisper_model(model_name)
    except Exception as e:
        return None, None, f"Whisper not installed or failed to load: {e}"

    try:
        if _WHISPER_TYPE == "faster":
            segments, info = model.transcribe(path, beam_size=5)
            text_list = []
            for segment in segments:
                text_list.append(segment.text)
            detected_lang = info.language
            return " ".join(text_list).strip(), detected_lang, None
        else:
            result = model.transcribe(path)
            detected_lang = result.get("language")
            return (result.get("text") or "").strip(), detected_lang, None
    except Exception as e:
        return None, None, f"Whisper transcription failed: {e}"


async def get_transcript(
    url: str, platform: str, duration_seconds: Optional[int] = None
) -> Tuple[str, bool, List[str], str, str, str, str]:
    """
    Extract transcript for a video URL.

    Returns:
        (
            transcript_text,        # English text (translated if needed) — used for RAG
            transcript_available,   # bool
            warnings,               # list of warning strings
            lang_code,              # detected language code e.g. "hi"
            lang_name,              # human name e.g. "Hindi"
            original_text,          # original transcript before translation
            transcript_source,      # source used for transcription (e.g., youtube_captions_manual, whisper_transcription)
        )
    """
    warnings: List[str] = []
    transcript_text = ""
    lang_code = "unknown"
    lang_name = "Unknown"
    original_text = ""

    logger.info("Transcript extraction started for %s", url)

    # ── Step 1: YouTube caption API ──────────────────────────────────────
    if platform == "youtube":
        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            video_id = _extract_youtube_id(url)
            logger.info("Extracted YouTube video_id=%s", video_id)
            if video_id:
                api = YouTubeTranscriptApi()
                try:
                    transcript_list = api.list(video_id)
                    available_langs = getattr(transcript_list, "_translation_languages_dict", {})
                    logger.info(
                        "Available transcript languages: %s",
                        ", ".join(available_langs.keys()) if available_langs else "none"
                    )

                    transcript = None
                    used_type = None

                    # 1. Try manual captions in preferred languages (CAPTION_LANGUAGES)
                    try:
                        transcript = transcript_list.find_manually_created_transcript(CAPTION_LANGUAGES)
                        used_type = "manual"
                    except Exception:
                        pass

                    # 2. Try auto-generated captions in preferred languages (CAPTION_LANGUAGES)
                    if transcript is None:
                        try:
                            transcript = transcript_list.find_generated_transcript(CAPTION_LANGUAGES)
                            used_type = "generated"
                        except Exception:
                            pass

                    # 3. Try translating manually created captions to English using YouTube API
                    if transcript is None:
                        try:
                            manual_transcripts = [t for t in transcript_list if not t.is_generated]
                            if manual_transcripts:
                                transcript = manual_transcripts[0].translate("en")
                                used_type = "manual_translated"
                        except Exception:
                            pass

                    # 4. Try translating auto-generated captions to English using YouTube API
                    if transcript is None:
                        try:
                            generated_transcripts = [t for t in transcript_list if t.is_generated]
                            if generated_transcripts:
                                transcript = generated_transcripts[0].translate("en")
                                used_type = "generated_translated"
                        except Exception:
                            pass

                    # 5. Fallback to any transcript as-is
                    if transcript is None:
                        try:
                            all_transcripts = list(transcript_list)
                            if all_transcripts:
                                transcript = all_transcripts[0]
                                used_type = f"fallback ({transcript.language_code})"
                        except Exception as e:
                            warnings.append(f"No transcript found at all: {str(e)}")


                    if transcript is not None:
                        logger.info("Using %s captions (language: %s)", used_type, getattr(transcript, "language_code", "?"))
                        try:
                            items = transcript.fetch()
                            raw_text = " ".join([
                                item.get("text", "") if isinstance(item, dict) else getattr(item, "text", "")
                                for item in items
                            ]).strip()
                            logger.info("Caption transcript length: %s", len(raw_text))
                            if len(raw_text) > 50:
                                # Detect language and translate if needed
                                original_text, transcript_text, lang_code, lang_name = \
                                    await _normalize_transcript(raw_text, warnings)
                                source_val = f"youtube_captions_{used_type}" if used_type in ["manual", "generated", "manual_translated", "generated_translated"] else "youtube_captions_fallback"
                                return transcript_text, True, warnings, lang_code, lang_name, original_text, source_val

                            warnings.append("Captions were too short; falling back to Whisper.")
                        except Exception as fetch_err:
                            warnings.append(f"Failed to fetch content from transcript: {str(fetch_err)}")
                except Exception as list_err:
                    warnings.append(f"list() failed: {str(list_err)}")
            else:
                warnings.append("Could not parse YouTube video id for captions.")
        except Exception as e:
            logger.warning("Captions not available for %s: %s", url, str(e))
            warnings.append(f"Captions unavailable; falling back to Whisper. Reason: {str(e)}")

    # ── Step 2: yt-dlp audio download ────────────────────────────────────
    max_audio_duration = None
    if duration_seconds and duration_seconds > 1200:
        max_audio_duration = 600
        if "Long video detected. Transcribed key sections." not in warnings:
            warnings.append("Long video detected. Transcribed key sections.")

    try:
        audio_path = await asyncio.to_thread(download_audio_with_ytdlp, url, max_audio_duration)
        logger.info("Audio download success for %s -> %s", url, audio_path)
    except Exception as e:
        logger.warning("Audio download failed for %s: %s", url, str(e))
        warnings.append(f"Audio download failed; transcript unavailable. Reason: {str(e)}")
        return "", False, warnings, "unknown", "Unknown", "", "none"

    # ── Step 3: Whisper transcription ─────────────────────────────────────
    # Whisper auto-detects language — works well for Hindi, Bengali, etc.
    try:
        raw_text, detected_lang, whisper_warning = await asyncio.to_thread(transcribe_audio_file, audio_path, "base")
        if whisper_warning:
            warnings.append(whisper_warning)
        raw_text = raw_text or ""
        logger.info("Whisper transcript length: %s, detected language: %s", len(raw_text), detected_lang)
        if len(raw_text) > 50:
            logger.info("Whisper transcription success for %s", url)
            original_text, transcript_text, lang_code, lang_name = \
                await _normalize_transcript(raw_text, warnings, whisper_lang=detected_lang)
            return transcript_text, True, warnings, lang_code, lang_name, original_text, "whisper_transcription"
        warnings.append("Whisper returned empty or short transcript.")
    except Exception as e:
        logger.warning("Whisper transcription failed for %s: %s", url, str(e))
        warnings.append(f"Whisper failed; transcript unavailable. Reason: {str(e)}")

    # ── Step 4: all failed ───────────────────────────────────────────────
    return "", False, warnings, "unknown", "Unknown", "", "none"


async def _normalize_transcript(
    raw_text: str,
    warnings: List[str],
    whisper_lang: Optional[str] = None
) -> Tuple[str, str, str, str]:
    """
    Detect language and translate to English if needed.
    Returns (original_text, english_text, lang_code, lang_name).
    """
    try:
        from ..utils.language_utils import normalize_transcript_for_rag, LANGUAGE_NAMES
        from ..config import get_settings
        settings = get_settings()
        api_key = settings.GOOGLE_API_KEY or ""

        original, translated, lang_code, lang_name = await asyncio.to_thread(
            normalize_transcript_for_rag, raw_text, api_key
        )

        if whisper_lang:
            lang_code = whisper_lang
            lang_name = LANGUAGE_NAMES.get(whisper_lang, whisper_lang.upper())

        if lang_code not in ("en", "en-us", "en-gb", "en-in", "unknown") and translated != original:
            warnings.append(
                f"Transcript language detected: {lang_name}. "
                "English translation generated for AI comparison."
            )

        return original, translated, lang_code, lang_name

    except Exception as e:
        logger.warning("Language normalization failed: %s — using raw text as-is.", e)
        warnings.append(f"Language detection/translation skipped: {str(e)}")
        if whisper_lang:
            from ..utils.language_utils import LANGUAGE_NAMES
            return raw_text, raw_text, whisper_lang, LANGUAGE_NAMES.get(whisper_lang, whisper_lang.upper())
        return raw_text, raw_text, "unknown", "Unknown"

