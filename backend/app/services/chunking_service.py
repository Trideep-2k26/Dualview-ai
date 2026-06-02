from typing import List, Dict, Any
from ..utils.id_utils import make_chunk_id
from ..utils.text_utils import preview_text


def create_chunks(
    session_id: str,
    video_id: str,
    text: str,
    platform: str,
    source_url: str,
    creator: str,
    engagement_rate: float,
    video_label: str = None,
    title: str = None,
    original_text: str = None
) -> List[Dict[str, Any]]:
    # Try to use LangChain splitter if available, otherwise do a simple split by paragraphs
    try:
        from langchain.text_splitter import RecursiveCharacterTextSplitter

        splitter = RecursiveCharacterTextSplitter(chunk_size=850, chunk_overlap=125)
        docs = splitter.split_text(text)
    except Exception:
        # fallback naive splitter
        parts = [p.strip() for p in text.split("\n\n") if p.strip()]
        docs = []
        current = ""
        for p in parts:
            if len(current) + len(p) + 1 > 850:
                docs.append(current)
                current = p
            else:
                current = (current + "\n\n" + p).strip() if current else p
        if current:
            docs.append(current)

    # Ensure empty/whitespace chunks are filtered out
    docs = [d.strip() for d in docs if d.strip()]

    chunks = []
    L_en = len(text) if text else 1
    L_orig = len(original_text) if original_text else 0

    for i, d in enumerate(docs, start=1):
        chunk_id = make_chunk_id(video_id or "V", i)
        
        chunk_meta = {
            "session_id": session_id,
            "video_id": video_id,
            "chunk_id": chunk_id,
            "chunk_index": i,
            "platform": platform,
            "source_url": source_url,
            "creator": creator,
            "engagement_rate": engagement_rate,
            "text": d,
            "text_preview": preview_text(d),
            "video_label": video_label or "unknown",
            "title": title or "unknown",
        }
        
        if original_text and L_orig > 0:
            # Estimate start and end positions of the chunk in the translated text
            start_pos = text.find(d)
            if start_pos != -1:
                end_pos = start_pos + len(d)
                r_start = start_pos / L_en
                r_end = end_pos / L_en
                orig_segment = original_text[int(r_start * L_orig) : int(r_end * L_orig)].strip()
                if orig_segment:
                    chunk_meta["original_text"] = orig_segment
                    chunk_meta["original_text_preview"] = preview_text(orig_segment)
                    
        chunks.append(chunk_meta)

    return chunks
