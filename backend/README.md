# RAG Video Compare Backend

This is a skeleton FastAPI backend for a retrieval-augmented generation (RAG) system that ingests two social videos (YouTube and Instagram), extracts transcripts and metadata, chunks transcripts, creates embeddings, stores vectors locally in Chroma, and serves a LangChain-powered chat with SSE streaming using Gemini Flash.

Quickstart (local skeleton):

1. Create a virtual environment and install dependencies:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and set `GOOGLE_API_KEY`.

3. Run the app:

```bash
uvicorn app.main:app --reload --port 8000
```

4. Health check:

```bash
curl http://localhost:8000/api/health
```

Notes:
- This skeleton uses ChromaDB for vector storage and Gemini Flash via LangChain.
- Whisper/yt-dlp/ffmpeg may be required for full transcript support.
 - Do NOT commit secrets. `.env` contains API keys and credentials (including Chroma cloud keys).
	 Add `.env` to your `.gitignore` (already included in backend/.gitignore) and store secrets securely.
