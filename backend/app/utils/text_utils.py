def preview_text(text: str, length: int = 200) -> str:
    if not text:
        return ""
    t = text.strip()
    return t[:length] + ("..." if len(t) > length else "")
