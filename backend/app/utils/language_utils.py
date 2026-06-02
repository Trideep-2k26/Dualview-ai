"""
language_utils.py
-----------------
Lightweight helpers for language detection and translation.

Functions:
  detect_language(text) -> (code: str, name: str)
  translate_to_english(text, api_key) -> str
  normalize_transcript_for_rag(text, api_key) -> (original, translated, lang_code, lang_name)
"""

import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

# Human-readable language names for common codes
LANGUAGE_NAMES: dict = {
    "en": "English",
    "hi": "Hindi",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "ur": "Urdu",
    "kn": "Kannada",
    "ml": "Malayalam",
    "or": "Odia",
    "as": "Assamese",
    "ne": "Nepali",
    "si": "Sinhala",
    "ar": "Arabic",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "pt": "Portuguese",
    "ru": "Russian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh-cn": "Chinese (Simplified)",
    "zh-tw": "Chinese (Traditional)",
    "id": "Indonesian",
    "ms": "Malay",
    "th": "Thai",
    "vi": "Vietnamese",
}

# Languages treated as "already English" — no translation needed
ENGLISH_VARIANTS = {"en", "en-us", "en-gb", "en-in", "en-au", "en-ca"}


def detect_language(text: str) -> Tuple[str, str]:
    """
    Detect the language of the given text.

    Returns:
        (lang_code, lang_name) — e.g. ("hi", "Hindi")
        Falls back to ("unknown", "Unknown") on error.
    """
    if not text or len(text.strip()) < 20:
        return "unknown", "Unknown"

    # Use only first 600 chars for speed
    sample = text.strip()[:600]

    try:
        from langdetect import detect, DetectorFactory
        # Make detection deterministic
        DetectorFactory.seed = 42
        code = detect(sample).lower()
        name = LANGUAGE_NAMES.get(code, code.upper())
        logger.info("Language detected: %s (%s)", code, name)
        return code, name
    except Exception as e:
        logger.warning("langdetect failed: %s — falling back to 'unknown'", e)

    # Fallback: simple Devanagari / Bengali Unicode range heuristic
    try:
        devanagari = sum(1 for c in sample if "\u0900" <= c <= "\u097F")
        bengali = sum(1 for c in sample if "\u0980" <= c <= "\u09FF")
        if devanagari > 30:
            return "hi", "Hindi"
        if bengali > 30:
            return "bn", "Bengali"
    except Exception:
        pass

    return "unknown", "Unknown"


def translate_to_english(text: str, api_key: str) -> str:
    """
    Translate text to English using Gemini.
    Returns original text if already English or if translation fails.
    """
    if not text or not api_key:
        return text

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = (
            "Translate the following transcript to natural, fluent English. "
            "Preserve meaning, tone, and intent. Do not add commentary. "
            "Return ONLY the translated text, nothing else.\n\n"
            f"Transcript:\n{text[:8000]}"
        )

        response = model.generate_content(prompt)
        translated = (response.text or "").strip()

        if translated and len(translated) > 30:
            logger.info("Translation successful. Output length: %d", len(translated))
            return translated
        else:
            logger.warning("Translation returned empty/short result — using original.")
            return text

    except Exception as e:
        logger.warning("Gemini translation failed: %s — using original text.", e)
        return text


def normalize_transcript_for_rag(
    text: str,
    api_key: str,
) -> Tuple[str, str, str, str]:
    """
    Given a raw transcript:
    1. Detect its language.
    2. If not English, translate to English.
    3. Return (original_text, translated_text, lang_code, lang_name).

    If already English: translated_text == original_text.
    If translation fails: translated_text == original_text (use original as fallback).
    """
    if not text or not text.strip():
        return "", "", "unknown", "Unknown"

    lang_code, lang_name = detect_language(text)

    # Already English — no translation needed
    if lang_code.lower() in ENGLISH_VARIANTS or lang_code == "unknown":
        logger.info("Transcript is '%s' — no translation needed.", lang_code)
        return text, text, lang_code, lang_name

    # Non-English — translate
    logger.info(
        "Transcript is '%s' (%s) — translating to English for RAG indexing.",
        lang_code,
        lang_name,
    )
    translated = translate_to_english(text, api_key)
    return text, translated, lang_code, lang_name
