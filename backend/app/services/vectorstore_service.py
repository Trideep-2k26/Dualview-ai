import os
import logging
from typing import List, Dict, Any
from langchain_core.documents import Document
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import chromadb
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


_global_embeddings = None
_global_vectorstore = None


def _get_embeddings() -> GoogleGenerativeAIEmbeddings:
    global _global_embeddings
    if _global_embeddings is None:
        _global_embeddings = GoogleGenerativeAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
        )
    return _global_embeddings


def _get_vectorstore() -> Chroma:
    global _global_vectorstore
    if _global_vectorstore is not None:
        return _global_vectorstore

    os.makedirs(settings.CHROMA_DIR, exist_ok=True)
    embeddings = _get_embeddings()

    client_settings = None
    if getattr(settings, "CHROMA_MODE", "local") == "cloud" and settings.CHROMA_HOST and settings.CHROMA_API_KEY:
        # Configure Chroma to use remote REST API implementation when cloud credentials present
        client_settings = {
            "chroma_api_impl": "rest",
            "chroma_server_host": settings.CHROMA_HOST,
            "chroma_server_use_tls": settings.CHROMA_USE_TLS,
            "chroma_api_key": settings.CHROMA_API_KEY,
        }
        if settings.CHROMA_TENANT:
            client_settings["chroma_tenant"] = settings.CHROMA_TENANT
        if settings.CHROMA_DATABASE:
            client_settings["chroma_database"] = settings.CHROMA_DATABASE
        if settings.CHROMA_PORT:
            client_settings["chroma_server_http_port"] = settings.CHROMA_PORT

    # Instantiate LangChain Chroma wrapper. If client_settings is provided, Chroma will connect to cloud.
    if client_settings:
        _global_vectorstore = Chroma(
            collection_name="video_chunks",
            embedding_function=embeddings,
            persist_directory=settings.CHROMA_DIR,
            client_settings=client_settings,
        )
    else:
        # Local mode with explicit chromadb.PersistentClient
        client = chromadb.PersistentClient(path=settings.CHROMA_DIR)
        _global_vectorstore = Chroma(
            client=client,
            collection_name="video_chunks",
            embedding_function=embeddings,
        )
    
    return _global_vectorstore


def add_video_chunks(session_id: str, video_id: str, chunks: List[Any]) -> int:
    vectorstore = _get_vectorstore()
    
    valid_texts: List[str] = []
    valid_metadatas: List[Dict[str, Any]] = []
    valid_ids: List[str] = []

    for idx, c in enumerate(chunks):
        # 1. & 2. & 3. Extract text and type check
        text = ""
        metadata = {}
        chunk_id = f"chunk_{idx}"
        
        if isinstance(c, str):
            text = c
        elif isinstance(c, dict):
            text = c.get("text", "") or c.get("page_content", "")
            metadata = {k: v for k, v in c.items() if k not in ["text", "page_content"]}
            chunk_id = c.get("chunk_id", chunk_id)
        elif hasattr(c, "page_content"):
            text = getattr(c, "page_content", "")
            metadata = getattr(c, "metadata", {}) or {}
            chunk_id = metadata.get("chunk_id", chunk_id)
            
        text = str(text).strip()
        
        # 4. Remove empty and short chunks
        if not text or len(text) < 20:
            logger.warning(f"Skipping empty or short chunk index {idx} in video {video_id}")
            continue
            
        # 5. Log length
        logger.info(f"Chunk {idx} valid. Length: {len(text)}")
        
        # Metadata logic (step 9) simple values
        base_meta = {
            "session_id": session_id,
            "video_id": video_id,
            "chunk_id": chunk_id,
        }
        # merge other dictionary keys handling only str, int, float, bool
        for k, v in metadata.items():
            if isinstance(v, (str, int, float, bool)):
                base_meta[k] = v
            elif v is not None:
                base_meta[k] = str(v)
                
        valid_texts.append(text)
        valid_metadatas.append(base_meta)
        valid_ids.append(f"{session_id}-{chunk_id}")

    # 10. If no valid chunks remain
    if not valid_texts:
        logger.warning(f"No valid chunks to embed for video {video_id}.")
        return 0

    try:
        # Generate embeddings explicitly if using collection.add
        embeddings_model = _get_embeddings()
        
        embeddings = embeddings_model.embed_documents(valid_texts)
        
        vectorstore._collection.add(
            documents=valid_texts,
            embeddings=embeddings,
            metadatas=valid_metadatas,
            ids=valid_ids
        )
        return len(valid_texts)
    except Exception as e:
        logger.error(f"Embedding/Vectorstore insert failed: {e}")
        raise


def video_chunks_exist(video_id: str) -> bool:
    if not video_id:
        return False
    vectorstore = _get_vectorstore()
    try:
        res = vectorstore._collection.get(where={"video_id": video_id}, limit=1)
        return len(res.get("ids", [])) > 0
    except Exception as e:
        logger.error(f"Error checking if video chunks exist for {video_id}: {e}")
        return False


def validate_video_index(video_id: str, embedding_model: Any = None) -> bool:
    """
    Query vectorstore/chroma for chunk metadata video_id.
    Count chunks and return True only if count > 0.
    """
    if not video_id:
        return False
    vectorstore = _get_vectorstore()
    try:
        res = vectorstore._collection.get(where={"video_id": video_id})
        ids = res.get("ids", []) if res else []
        count = len(ids)
        logger.info("[VECTORSTORE] Found %d chunks in index for video %s", count, video_id)
        return count > 0
    except Exception as e:
        logger.error(f"Error validating video index for {video_id}: {e}")
        return False


def delete_video_chunks(video_id: str):
    """
    Delete all documents for the given video_id from the Chroma collection.
    """
    if not video_id:
        return
    vectorstore = _get_vectorstore()
    try:
        vectorstore._collection.delete(where={"video_id": video_id})
        logger.info("[VECTORSTORE] Deleted existing chunks for video %s", video_id)
    except Exception as e:
        logger.error(f"Error deleting chunks for video {video_id}: {e}")



def similarity_search(
    session_id: str, query: str, k: int = 6, video_ids: list = None
) -> List[Dict[str, Any]]:
    from .memory_service import get_session

    if video_ids is None:
        session = get_session(session_id)
        video_ids = []
        if session and isinstance(session, dict):
            for label in ["video_a", "video_b"]:
                vid = session.get(label, {}).get("video_id")
                if vid:
                    video_ids.append(vid)

    vectorstore = _get_vectorstore()

    if video_ids:
        if len(video_ids) == 1:
            where_filter = {"video_id": video_ids[0]}
        else:
            where_filter = {"video_id": {"$in": video_ids}}
    else:
        where_filter = {"session_id": session_id}

    docs = vectorstore.similarity_search(
        query,
        k=k,
        filter=where_filter,
    )

    results: List[Dict[str, Any]] = []
    for d in docs:
        results.append(
            {
                "text": d.page_content,
                "text_preview": d.page_content[:200] + ("..." if len(d.page_content) > 200 else ""),
                **d.metadata,
            }
        )
    return results

