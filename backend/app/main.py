from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import json
from uuid import uuid4
import asyncio
import logging

from .config import Settings, get_settings
from .schemas import IngestRequest, IngestResponse, ChatRequest
from .services import (
    ingestion_service,
    rag_service,
    memory_service,
    vectorstore_service,
    video_cache_service,
)

settings: Settings = get_settings()

logging.basicConfig(level=logging.INFO)

from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(title="RAG Video Compare Backend")

# Mount static directory for served thumbnails
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
generated_thumbs_dir = os.path.join(base_dir, "data", "generated_thumbnails")
os.makedirs(generated_thumbs_dir, exist_ok=True)
app.mount("/static/thumbnails", StaticFiles(directory=generated_thumbs_dir), name="thumbnails")


cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
if settings.FRONTEND_ORIGIN and settings.FRONTEND_ORIGIN not in cors_origins:
    cors_origins.append(settings.FRONTEND_ORIGIN)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _validate_settings_on_startup():
    # Ensure GOOGLE_API_KEY is present and log success
    if not settings.GOOGLE_API_KEY:
        logging.error("GOOGLE_API_KEY missing in environment")
        raise RuntimeError("GOOGLE_API_KEY missing in environment")
    logging.getLogger(__name__).info("Gemini API key loaded successfully")


@app.get("/api/health")
async def health():
    return {"status": "ok", "chroma_dir": settings.CHROMA_DIR}


@app.post("/api/ingest", response_model=IngestResponse)
async def ingest(req: IngestRequest):
    session_id = str(uuid4())

    try:
        result = await ingestion_service.ingest_pair(
            session_id=session_id, video_a_url=req.video_a_url, video_b_url=req.video_b_url
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

    # store session summary in memory for quick access
    memory_service.save_session(session_id, result)

    return JSONResponse(status_code=200, content=result)


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    # Validate session
    session = memory_service.get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")

    async def event_generator():
        # Use rag_service to generate a stream of tokens (synchronous generator adapted)
        try:
            async for token in rag_service.generate_response_stream(req.session_id, req.message):
                # SSE data event
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
            # After tokens, send citations event
            citations = rag_service.get_last_citations(req.session_id)
            yield f"data: {json.dumps({'type': 'citations', 'citations': citations})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    session = memory_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    return session


# ---------------------------------------------------------------------------
# Internal admin endpoints (protected by X-Admin-Token header)
# ---------------------------------------------------------------------------
from fastapi import Header

_ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")


def _require_admin(x_admin_token: str = Header(default="")):
    """Simple token gate — set ADMIN_TOKEN env var to enable."""
    if _ADMIN_TOKEN and x_admin_token != _ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Admin access required")


@app.get("/api/cache/stats")
async def cache_stats(x_admin_token: str = Header(default="")):
    """Returns SQLite video cache statistics (admin only)."""
    _require_admin(x_admin_token)
    return video_cache_service.get_cache_stats()


@app.post("/api/cache/purge")
async def cache_purge(x_admin_token: str = Header(default="")):
    """Purge stale cache entries (admin only)."""
    _require_admin(x_admin_token)
    deleted = video_cache_service.purge_stale_entries()
    return {"purged": deleted}
