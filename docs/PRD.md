# PRD: Social Media Video Comparison RAG Chatbot

**Version:** 1.0  
**Status:** Engineering Draft  
**Target Completion:** 5 Days  
**Last Updated:** 2025-05-29

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Goals](#2-goals)
3. [Non-Goals](#3-non-goals)
4. [Functional Requirements](#4-functional-requirements)
5. [System Architecture](#5-system-architecture)
6. [API Design](#6-api-design)
7. [Database Schema](#7-database-schema)
8. [Vector DB Schema](#8-vector-db-schema)
9. [RAG Pipeline](#9-rag-pipeline)
10. [Frontend Requirements](#10-frontend-requirements)
11. [Backend Requirements](#11-backend-requirements)
12. [Scalability Plan](#12-scalability-plan)
13. [Cost Optimization Strategy](#13-cost-optimization-strategy)
14. [Security Considerations](#14-security-considerations)
15. [Deployment Architecture](#15-deployment-architecture)
16. [Folder Structure](#16-folder-structure)
17. [5-Day Milestones](#17-5-day-milestones)
18. [Risks and Mitigations](#18-risks-and-mitigations)
19. [Future Improvements](#19-future-improvements)

---

## 1. Problem Statement

Analyzing and comparing social media videos across platforms (YouTube and Instagram) currently requires engineers and content analysts to manually switch between platforms, copy-paste data, run separate analytics tools, and mentally reconcile disparate engagement metrics. There is no unified interface that can ingest two video URLs, extract their transcripts and engagement metadata, and answer natural-language questions that reference both videos simultaneously with cited sources.

The core engineering challenge is threefold:

- **Heterogeneous data extraction:** YouTube and Instagram have fundamentally different APIs, auth models, and transcript availability patterns. Fallback strategies are required.
- **Cross-platform semantic comparison:** Embedding transcripts and enabling a RAG pipeline that knows which chunks belong to which video, so citations are accurate and grounded.
- **Real-time conversational UX:** Streaming responses, session memory, and source citations must work together without degrading perceived latency.

---

## 2. Goals

**G1 — Ingestion:** Accept one YouTube URL and one Instagram Reels URL, extract transcripts via the primary/fallback chain, and extract the eight required metadata fields per video in under 60 seconds total.

**G2 — Engagement Analytics:** Compute `engagement_rate = (likes + comments) / views × 100` server-side and expose it alongside raw metrics for both videos.

**G3 — RAG Pipeline:** Chunk, embed (`text-embedding-3-small`), and persist transcripts into ChromaDB (dev) / Qdrant (prod) with video-level namespace isolation. Retrieval must return the top-K chunks with their source video tagged.

**G4 — Conversational Chat:** LangChain-powered conversational RAG with GPT-4o-mini, streaming token output, per-session memory (`ConversationBufferWindowMemory` or equivalent), and inline source citations.

**G5 — Frontend:** Next.js app with side-by-side video cards, real-time metadata display, and a streaming chat panel — all rendering on first load within 2 seconds on a standard broadband connection.

**G6 — Developer Velocity:** The full stack must be runnable with a single `docker compose up` for local dev. No manual environment setup beyond `.env` file population.

---

## 3. Non-Goals

- **NG1:** TikTok, Twitter/X, Facebook, or any platform other than YouTube and Instagram Reels.
- **NG2:** Batch processing of more than two videos per session.
- **NG3:** User authentication, multi-user sessions, or persistent user accounts.
- **NG4:** Real-time comment sentiment analysis (comments count is retrieved but not analyzed).
- **NG5:** Video downloading or storing raw media files.
- **NG6:** Paid API access to Instagram Graph API — the solution uses public scraping where permissible and documents the legal boundary.
- **NG7:** Accessibility (WCAG) compliance in v1 — deferred to future iteration.
- **NG8:** Mobile-first responsive design — desktop-first, mobile is best-effort.

---

## 4. Functional Requirements

### 4.1 Video Ingestion

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | System accepts exactly two video URLs per session: one YouTube, one Instagram Reels | P0 |
| FR-02 | URL validation rejects non-YouTube / non-Instagram URLs before any network call | P0 |
| FR-03 | YouTube transcript extraction uses `youtube-transcript-api` as primary | P0 |
| FR-04 | YouTube fallback: `yt-dlp --write-auto-sub` if no transcript available | P0 |
| FR-05 | YouTube final fallback: download audio stream, run OpenAI Whisper `base` model | P1 |
| FR-06 | Instagram transcript extraction uses `yt-dlp` to download Reels audio, then Whisper | P0 |
| FR-07 | If all extraction methods fail, surface a structured error with the failure stage | P0 |

### 4.2 Metadata Extraction

| ID | Field | Source (YouTube) | Source (Instagram) | Priority |
|----|-------|-----------------|-------------------|----------|
| FR-08 | `views` | YouTube Data API v3 | yt-dlp metadata | P0 |
| FR-09 | `likes` | YouTube Data API v3 | yt-dlp metadata | P0 |
| FR-10 | `comments` (count) | YouTube Data API v3 | yt-dlp metadata | P0 |
| FR-11 | `creator` (channel/username) | YouTube Data API v3 | yt-dlp metadata | P0 |
| FR-12 | `follower_count` | YouTube Data API v3 (subscribers) | Instagram scrape / yt-dlp | P1 |
| FR-13 | `hashtags` | YouTube description parse | yt-dlp description parse | P0 |
| FR-14 | `upload_date` (ISO 8601) | YouTube Data API v3 | yt-dlp metadata | P0 |
| FR-15 | `duration` (seconds) | YouTube Data API v3 | yt-dlp metadata | P0 |
| FR-16 | `engagement_rate` | Computed: `(likes + comments) / views × 100` | Same formula | P0 |

### 4.3 RAG and Embedding

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-17 | Transcripts chunked with `RecursiveCharacterTextSplitter`: chunk_size=500, chunk_overlap=50 | P0 |
| FR-18 | Each chunk embedded via `text-embedding-3-small` (1536 dims) | P0 |
| FR-19 | Chunks stored in isolated collections per session (`session_{uuid}`) | P0 |
| FR-20 | Each chunk's metadata payload includes: `video_id`, `platform`, `chunk_index`, `start_time` (if available), `url` | P0 |
| FR-21 | Retrieval returns top-5 chunks via cosine similarity with MMR reranking | P1 |

### 4.4 Chatbot Behavior

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-22 | LangChain `ConversationalRetrievalChain` with GPT-4o-mini | P0 |
| FR-23 | Streaming via `StreamingStdOutCallbackHandler` + SSE to frontend | P0 |
| FR-24 | Memory: `ConversationBufferWindowMemory(k=10)` — last 10 turns | P0 |
| FR-25 | Every response includes source citations: `[Source: YouTube - "{chunk_preview}"]` | P0 |
| FR-26 | System prompt instructs model to compare both videos, never hallucinate statistics | P0 |
| FR-27 | If question is not answerable from context, model says so explicitly | P0 |

### 4.5 Frontend

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-28 | URL input form with validation; submit triggers ingestion pipeline | P0 |
| FR-29 | Loading states with per-stage progress (Fetching metadata → Extracting transcript → Embedding) | P0 |
| FR-30 | Side-by-side video cards: embedded player + all 9 metadata fields + engagement rate | P0 |
| FR-31 | Chat panel below/beside cards with message history and streaming token display | P0 |
| FR-32 | Clear session button resets vector store and chat history | P1 |

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│  Next.js 14 App Router                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  URL Input   │  │ Video Cards  │  │      Chat Panel          │  │
│  │  Component   │  │ (side-by-    │  │  (SSE streaming +        │  │
│  │              │  │  side)       │  │   message history)       │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────────────┘  │
│         │ HTTP/SSE                                                  │
└─────────┼───────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API LAYER (FastAPI)                               │
│                                                                     │
│  POST /api/ingest      GET /api/session/{id}    POST /api/chat     │
│         │                                              │            │
│         ▼                                              ▼            │
│  ┌─────────────────┐                    ┌─────────────────────────┐ │
│  │ Ingestion       │                    │  LangChain RAG Chain    │ │
│  │ Orchestrator    │                    │  - Retriever            │ │
│  │                 │                    │  - ConversationMemory   │ │
│  │ ┌─────────────┐ │                    │  - GPT-4o-mini (stream) │ │
│  │ │ YouTube     │ │                    └──────────┬──────────────┘ │
│  │ │ Extractor   │ │                               │                │
│  │ └─────────────┘ │                               ▼                │
│  │ ┌─────────────┐ │                    ┌─────────────────────────┐ │
│  │ │ Instagram   │ │                    │    Vector Store         │ │
│  │ │ Extractor   │ │                    │    (ChromaDB / Qdrant)  │ │
│  │ └─────────────┘ │                    └─────────────────────────┘ │
│  │ ┌─────────────┐ │                                                │
│  │ │ Whisper     │ │                                                │
│  │ │ Fallback    │ │                                                │
│  │ └─────────────┘ │                                                │
│  │ ┌─────────────┐ │                                                │
│  │ │ Embedding   │ │                                                │
│  │ │ Pipeline    │ │                                                │
│  │ └─────────────┘ │                                                │
│  └─────────────────┘                                               │
│                                                                     │
│  SQLite (session + metadata store)                                  │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────┐    ┌──────────────────────┐
│   OpenAI API         │    │  YouTube Data API v3  │
│   - embeddings       │    │  (metadata)           │
│   - GPT-4o-mini      │    └──────────────────────┘
└──────────────────────┘
```

### 5.1 Request Lifecycle — Ingestion

```
Client                    FastAPI                   Extractors              OpenAI
  │                          │                          │                      │
  │──POST /api/ingest──────►│                          │                      │
  │   {yt_url, ig_url}       │                          │                      │
  │                          │──validate URLs──────────►│                      │
  │                          │──fetch YT metadata──────►│                      │
  │                          │◄─metadata────────────────│                      │
  │                          │──extract YT transcript──►│                      │
  │                          │◄─transcript──────────────│                      │
  │                          │──yt-dlp IG audio────────►│                      │
  │                          │──Whisper transcribe─────►│                      │
  │                          │◄─IG transcript───────────│                      │
  │                          │──chunk + embed──────────────────────────────────►│
  │                          │◄─embeddings─────────────────────────────────────│
  │                          │──upsert to ChromaDB                             │
  │◄─{session_id, metadata}──│                                                  │
```

### 5.2 Request Lifecycle — Chat

```
Client                    FastAPI                 ChromaDB             OpenAI
  │                          │                       │                    │
  │──POST /api/chat──────────►│                       │                    │
  │   {session_id, message}  │                       │                    │
  │                          │──embed(message)──────────────────────────►│
  │                          │◄─query_vector────────────────────────────│
  │                          │──similarity_search(top5)────────────────►│
  │                          │◄─relevant chunks────────────────────────│ (ChromaDB)
  │                          │──build prompt + history                   │
  │                          │──GPT-4o-mini (stream)────────────────────►│
  │◄──SSE token stream───────│◄─streaming tokens────────────────────────│
  │                          │──append to memory                         │
```

---

## 6. API Design

### Base URL: `http://localhost:8000/api/v1`

---

### `POST /ingest`

Kicks off the full ingestion pipeline for two video URLs. Returns a `session_id` used for all subsequent requests.

**Request Body:**
```json
{
  "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "instagram_url": "https://www.instagram.com/reel/ABC123/"
}
```

**Response `200 OK`:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "videos": [
    {
      "platform": "youtube",
      "video_id": "dQw4w9WgXcQ",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "metadata": {
        "creator": "RickAstleyVEVO",
        "views": 1500000000,
        "likes": 16000000,
        "comments": 2300000,
        "follower_count": 3800000,
        "hashtags": ["#rickastley", "#nevergonnagiveyouup"],
        "upload_date": "2009-10-25T00:00:00Z",
        "duration": 213,
        "engagement_rate": 1.22
      },
      "transcript_length": 412,
      "chunk_count": 4,
      "transcript_method": "youtube_transcript_api"
    },
    {
      "platform": "instagram",
      "video_id": "ABC123",
      "url": "https://www.instagram.com/reel/ABC123/",
      "metadata": {
        "creator": "someuser",
        "views": 450000,
        "likes": 32000,
        "comments": 1800,
        "follower_count": 125000,
        "hashtags": ["#fyp", "#trending"],
        "upload_date": "2024-11-01T00:00:00Z",
        "duration": 58,
        "engagement_rate": 7.51
      },
      "transcript_length": 180,
      "chunk_count": 2,
      "transcript_method": "whisper"
    }
  ]
}
```

**Error `422 Unprocessable Entity`:**
```json
{
  "error": "INVALID_URL",
  "detail": "instagram_url must be an Instagram Reels URL (contains /reel/)"
}
```

**Error `502 Bad Gateway`:**
```json
{
  "error": "EXTRACTION_FAILED",
  "stage": "instagram_transcript",
  "method_attempted": ["yt_dlp", "whisper"],
  "detail": "Audio download failed: geo-restricted content"
}
```

---

### `GET /session/{session_id}`

Returns session state, including both videos' metadata. Used by frontend on page refresh.

**Response `200 OK`:** Same shape as `POST /ingest` response.

**Error `404 Not Found`:**
```json
{ "error": "SESSION_NOT_FOUND" }
```

---

### `POST /chat`

Sends a message to the RAG chatbot. Returns a Server-Sent Events stream.

**Request Body:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Which video has a higher engagement rate and why?"
}
```

**Response: `text/event-stream`**
```
data: {"type": "token", "content": "Based"}
data: {"type": "token", "content": " on"}
data: {"type": "token", "content": " the"}
...
data: {"type": "sources", "sources": [
  {"platform": "youtube", "video_id": "dQw4w9WgXcQ", "chunk": "Rick Astley describes...", "chunk_index": 2},
  {"platform": "instagram", "video_id": "ABC123", "chunk": "The creator mentions...", "chunk_index": 0}
]}
data: {"type": "done"}
```

**Error `404`:** Session not found.  
**Error `400`:** Session exists but ingestion is not yet complete.

---

### `DELETE /session/{session_id}`

Clears the vector store collection and SQLite session record.

**Response `200 OK`:**
```json
{ "deleted": true, "session_id": "550e8400-..." }
```

---

### `GET /health`

Liveness check.

**Response `200 OK`:**
```json
{
  "status": "ok",
  "chromadb": "connected",
  "openai": "reachable",
  "version": "1.0.0"
}
```

---

## 7. Database Schema

SQLite is used in development. Postgres can be swapped in via the same SQLAlchemy models for production.

### Table: `sessions`

```sql
CREATE TABLE sessions (
    id              TEXT PRIMARY KEY,         -- UUID v4
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status          TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    youtube_url     TEXT NOT NULL,
    instagram_url   TEXT NOT NULL,
    error_detail    TEXT                      -- JSON string, populated on failure
);
```

### Table: `videos`

```sql
CREATE TABLE videos (
    id                  TEXT PRIMARY KEY,      -- UUID v4
    session_id          TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    platform            TEXT NOT NULL CHECK(platform IN ('youtube', 'instagram')),
    video_id            TEXT NOT NULL,         -- platform-native ID
    url                 TEXT NOT NULL,
    creator             TEXT,
    views               INTEGER,
    likes               INTEGER,
    comments            INTEGER,
    follower_count      INTEGER,
    hashtags            TEXT,                  -- JSON array serialized as string
    upload_date         TEXT,                  -- ISO 8601
    duration            INTEGER,               -- seconds
    engagement_rate     REAL,                  -- computed: (likes + comments) / views * 100
    transcript          TEXT,                  -- raw full transcript
    transcript_method   TEXT,                  -- 'youtube_transcript_api' | 'yt_dlp_subs' | 'whisper'
    chunk_count         INTEGER,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_videos_session ON videos(session_id);
```

### Table: `chat_messages`

```sql
CREATE TABLE chat_messages (
    id          TEXT PRIMARY KEY,              -- UUID v4
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    sources     TEXT,                          -- JSON array of source objects, null for user messages
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_session_order ON chat_messages(session_id, created_at);
```

---

## 8. Vector DB Schema

### ChromaDB (Development)

One collection per session. This prevents cross-session contamination and enables clean deletion.

**Collection name:** `session_{session_id}` (UUID with dashes replaced by underscores)

**Document metadata fields (per chunk):**

```python
{
    "session_id":    str,   # e.g. "550e8400-e29b-41d4-a716-446655440000"
    "video_id":      str,   # platform-native ID
    "platform":      str,   # "youtube" | "instagram"
    "url":           str,   # original video URL
    "creator":       str,   # channel/username
    "chunk_index":   int,   # 0-based index within this video's chunks
    "start_char":    int,   # character offset in original transcript
    "end_char":      int,   # character offset in original transcript
    "start_time":    float, # seconds (if available from youtube-transcript-api, else -1)
    "end_time":      float, # seconds (if available, else -1)
}
```

**Embedding:** `text-embedding-3-small` → 1536-dimensional float32 vectors.  
**Distance metric:** Cosine similarity.

### Qdrant (Production)

Same logical schema, mapped to Qdrant's collections API:

```python
# Collection creation
client.create_collection(
    collection_name=f"session_{session_id}",
    vectors_config=VectorParams(
        size=1536,
        distance=Distance.COSINE
    ),
    # Enable payload indexing for filtered retrieval
    optimizers_config=OptimizersConfigDiff(indexing_threshold=0)
)

# Point payload schema (identical to ChromaDB metadata above)
PointStruct(
    id=str(uuid4()),
    vector=[...],  # 1536 floats
    payload={
        "session_id": ...,
        "video_id": ...,
        "platform": ...,
        "url": ...,
        "creator": ...,
        "chunk_index": ...,
        "start_char": ...,
        "end_char": ...,
        "start_time": ...,
        "end_time": ...,
        "text": ...,       # the chunk text itself
    }
)
```

**Filtered retrieval by platform:**
```python
# When user asks "what does the YouTube video say about X"
Filter(
    must=[FieldCondition(key="platform", match=MatchValue(value="youtube"))]
)
```

---

## 9. RAG Pipeline

### 9.1 Chunking Strategy

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", ". ", " ", ""],
    length_function=len,
)

# Each chunk document is enriched with metadata before embedding
chunks = splitter.create_documents(
    texts=[transcript],
    metadatas=[{
        "session_id": session_id,
        "video_id": video_id,
        "platform": platform,
        "url": url,
        "creator": creator,
    }]
)
```

**Why 500/50:** Balances context richness per chunk (enough for GPT-4o-mini to reason about) vs. retrieval precision. Overlap prevents edge-sentence splits from losing coherence.

### 9.2 Embedding

```python
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    dimensions=1536,  # explicit, future-proof
)
```

Embedding is batched: all chunks from both videos are embedded in a single `embed_documents()` call to minimize API round-trips.

### 9.3 Vector Store Initialization

```python
# Development
from langchain_chroma import Chroma

vectorstore = Chroma(
    collection_name=f"session_{session_id}",
    embedding_function=embeddings,
    persist_directory="./chroma_db",
)
vectorstore.add_documents(chunks)

# Production
from langchain_qdrant import QdrantVectorStore

vectorstore = QdrantVectorStore.from_documents(
    chunks,
    embeddings,
    url=settings.QDRANT_URL,
    collection_name=f"session_{session_id}",
)
```

### 9.4 Retriever Configuration

```python
retriever = vectorstore.as_retriever(
    search_type="mmr",               # Max Marginal Relevance for diversity
    search_kwargs={
        "k": 5,                      # return top 5 chunks
        "fetch_k": 20,               # candidate pool for MMR
        "lambda_mult": 0.7,          # 0=max diversity, 1=max relevance
    }
)
```

MMR is preferred over pure cosine similarity to prevent the retriever from returning 5 near-duplicate chunks from the same video when the question has a strong semantic pull toward one platform.

### 9.5 LangChain Chain Construction

```python
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferWindowMemory
from langchain_openai import ChatOpenAI
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler

llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.2,       # low for factual comparison tasks
    streaming=True,
    callbacks=[StreamingStdOutCallbackHandler()],
)

memory = ConversationBufferWindowMemory(
    k=10,
    memory_key="chat_history",
    return_messages=True,
    output_key="answer",
)

chain = ConversationalRetrievalChain.from_llm(
    llm=llm,
    retriever=retriever,
    memory=memory,
    return_source_documents=True,
    verbose=False,
    combine_docs_chain_kwargs={"prompt": COMPARISON_PROMPT},
)
```

### 9.6 System Prompt

```python
COMPARISON_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert social media analyst comparing two videos.

Video 1 (YouTube): {youtube_metadata_summary}
Video 2 (Instagram): {instagram_metadata_summary}

Rules:
1. ALWAYS cite which video you are referencing using [YouTube] or [Instagram] tags.
2. When comparing engagement, use the exact engagement_rate values from metadata, not from the transcript context.
3. If the transcript context does not contain the answer, say: "The transcripts don't cover this topic."
4. Never fabricate statistics. If a metric is missing, say it's unavailable.
5. Keep responses concise but thorough. Use bullet points for comparisons.

Context from transcripts:
{context}

Chat history:
{chat_history}
"""),
    ("human", "{question}"),
])
```

### 9.7 Source Citation Post-Processing

After the chain returns `source_documents`, format citations server-side before streaming:

```python
def format_sources(source_docs: list) -> list[dict]:
    seen = set()
    sources = []
    for doc in source_docs:
        key = (doc.metadata["platform"], doc.metadata["chunk_index"])
        if key not in seen:
            seen.add(key)
            sources.append({
                "platform": doc.metadata["platform"],
                "video_id": doc.metadata["video_id"],
                "creator": doc.metadata["creator"],
                "chunk_index": doc.metadata["chunk_index"],
                "chunk": doc.page_content[:120] + "...",
                "start_time": doc.metadata.get("start_time", -1),
            })
    return sources
```

---

## 10. Frontend Requirements

### 10.1 Pages and Routes

```
/                    → Home (URL input form)
/session/[id]        → Session view (video cards + chat)
```

### 10.2 Component Tree

```
app/
├── page.tsx                        # Home: UrlInputForm
├── session/[id]/
│   └── page.tsx                    # Session: VideoCards + ChatPanel
│
components/
├── UrlInputForm/
│   ├── index.tsx                   # Form with validation
│   └── ProgressIndicator.tsx       # Stage-based loading bar
├── VideoCard/
│   ├── index.tsx                   # Single card wrapper
│   ├── MetadataGrid.tsx            # 8 fields + engagement rate
│   └── EmbeddedPlayer.tsx          # YouTube iframe / IG embed
├── ChatPanel/
│   ├── index.tsx                   # Chat container
│   ├── MessageList.tsx             # Scrolling message history
│   ├── MessageBubble.tsx           # User/assistant message + sources
│   ├── SourceCitation.tsx          # Inline citation pill
│   └── ChatInput.tsx               # Input + send button
└── shared/
    ├── Badge.tsx                   # Platform badge (YT/IG)
    └── Skeleton.tsx                # Loading skeleton
```

### 10.3 State Management

Use React's built-in `useState` + `useReducer` + server-side fetching via Next.js. No Redux or Zustand needed for v1.

```typescript
// Session state shape
interface SessionState {
  sessionId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  loadingStage: string | null;   // e.g. "Extracting YouTube transcript..."
  videos: VideoData[];
  messages: ChatMessage[];
  isStreaming: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitation[];
  createdAt: string;
}
```

### 10.4 SSE Streaming Implementation

```typescript
// hooks/useChat.ts
export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (text: string) => {
    const userMsg = { id: uuid(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const assistantMsgId = uuid();
    setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

    const response = await fetch('/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message: text }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const event = JSON.parse(line.slice(6));

        if (event.type === 'token') {
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: m.content + event.content }
              : m
          ));
        } else if (event.type === 'sources') {
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, sources: event.sources }
              : m
          ));
        } else if (event.type === 'done') {
          setIsStreaming(false);
        }
      }
    }
  };

  return { messages, sendMessage, isStreaming };
}
```

### 10.5 UI Design Constraints

- **Color palette:** Neutral-900 background, white cards, YouTube red `#FF0000`, Instagram gradient for badges.
- **Typography:** Inter font, 14px base.
- **Card layout:** CSS Grid `grid-cols-2` with `gap-4`. On screens < 768px: stacked.
- **Chat panel:** Fixed height with `overflow-y-auto`, auto-scroll to bottom on new messages.
- **Performance:** Video embeds are lazy-loaded. Metadata is rendered as plain text — no charts in v1.

### 10.6 Environment Variables (Frontend)

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

---

## 11. Backend Requirements

### 11.1 FastAPI Application Structure

```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init DB, connect ChromaDB
    await db.init()
    yield
    # Shutdown: close connections
    await db.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], ...)

app.include_router(ingest_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(session_router, prefix="/api/v1")
```

### 11.2 Ingestion Service

```python
# services/ingestion.py
class IngestionService:
    async def ingest(self, session_id: str, yt_url: str, ig_url: str) -> None:
        await self._update_status(session_id, "processing")
        try:
            yt_data = await self._process_video("youtube", yt_url, session_id)
            ig_data = await self._process_video("instagram", ig_url, session_id)
            await self._embed_and_store([yt_data, ig_data], session_id)
            await self._update_status(session_id, "completed")
        except Exception as e:
            await self._update_status(session_id, "failed", error=str(e))
            raise

    async def _process_video(self, platform: str, url: str, session_id: str) -> VideoData:
        metadata = await self._extract_metadata(platform, url)
        transcript = await self._extract_transcript(platform, url)
        metadata["engagement_rate"] = (
            (metadata["likes"] + metadata["comments"]) / metadata["views"] * 100
            if metadata["views"] > 0 else 0.0
        )
        await self._save_to_db(session_id, platform, url, metadata, transcript)
        return VideoData(metadata=metadata, transcript=transcript, platform=platform, url=url)
```

### 11.3 YouTube Extractor

```python
# extractors/youtube.py
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
import subprocess, json

class YouTubeExtractor:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def get_metadata(self, video_id: str) -> dict:
        # YouTube Data API v3: videos.list
        # parts: snippet, statistics, contentDetails
        url = (
            f"https://www.googleapis.com/youtube/v3/videos"
            f"?id={video_id}&part=snippet,statistics,contentDetails"
            f"&key={self.api_key}"
        )
        ...

    def get_transcript(self, video_id: str) -> tuple[str, str]:
        """Returns (transcript_text, method_used)"""
        # Method 1: youtube-transcript-api
        try:
            entries = YouTubeTranscriptApi.get_transcript(video_id)
            text = " ".join(e["text"] for e in entries)
            return text, "youtube_transcript_api"
        except (TranscriptsDisabled, NoTranscriptFound):
            pass

        # Method 2: yt-dlp auto-generated subtitles
        try:
            result = subprocess.run([
                "yt-dlp", "--write-auto-sub", "--sub-format", "srv3",
                "--skip-download", "-o", f"/tmp/{video_id}", 
                f"https://www.youtube.com/watch?v={video_id}"
            ], capture_output=True, timeout=60)
            # parse SRV3 subtitle file
            ...
            return text, "yt_dlp_subs"
        except Exception:
            pass

        # Method 3: Whisper fallback
        return self._whisper_fallback(video_id), "whisper"

    def _whisper_fallback(self, video_id: str) -> str:
        subprocess.run([
            "yt-dlp", "-x", "--audio-format", "mp3",
            "-o", f"/tmp/{video_id}.%(ext)s",
            f"https://www.youtube.com/watch?v={video_id}"
        ], timeout=120)
        import whisper
        model = whisper.load_model("base")
        result = model.transcribe(f"/tmp/{video_id}.mp3")
        return result["text"]
```

### 11.4 Instagram Extractor

```python
# extractors/instagram.py
import subprocess, json

class InstagramExtractor:
    def get_metadata(self, url: str) -> dict:
        result = subprocess.run([
            "yt-dlp", "--dump-json", "--no-download", url
        ], capture_output=True, text=True, timeout=60)
        data = json.loads(result.stdout)
        return {
            "creator": data.get("uploader", ""),
            "views": data.get("view_count", 0),
            "likes": data.get("like_count", 0),
            "comments": data.get("comment_count", 0),
            "follower_count": data.get("channel_follower_count", 0),
            "hashtags": self._parse_hashtags(data.get("description", "")),
            "upload_date": data.get("upload_date", ""),
            "duration": data.get("duration", 0),
        }

    def get_transcript(self, url: str, video_id: str) -> tuple[str, str]:
        # Instagram Reels rarely have captions; go straight to Whisper
        subprocess.run([
            "yt-dlp", "-x", "--audio-format", "mp3",
            "-o", f"/tmp/{video_id}.%(ext)s", url
        ], timeout=120)
        import whisper
        model = whisper.load_model("base")
        result = model.transcribe(f"/tmp/{video_id}.mp3")
        return result["text"], "whisper"

    def _parse_hashtags(self, description: str) -> list[str]:
        import re
        return re.findall(r"#\w+", description)
```

### 11.5 Chat Streaming Endpoint

```python
# routers/chat.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from langchain.callbacks import AsyncIteratorCallbackHandler
import asyncio, json

router = APIRouter()

@router.post("/chat")
async def chat(body: ChatRequest):
    session = await get_session(body.session_id)
    if not session or session.status != "completed":
        raise HTTPException(400, "Session not ready")

    chain = await build_chain(body.session_id)
    callback = AsyncIteratorCallbackHandler()
    chain.llm.callbacks = [callback]

    async def generate():
        task = asyncio.create_task(
            chain.ainvoke({"question": body.message})
        )
        async for token in callback.aiter():
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        result = await task
        sources = format_sources(result.get("source_documents", []))
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

### 11.6 Configuration

```python
# config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    OPENAI_API_KEY: str
    YOUTUBE_API_KEY: str
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""
    DATABASE_URL: str = "sqlite+aiosqlite:///./app.db"
    USE_QDRANT: bool = False           # toggle via env in prod
    WHISPER_MODEL: str = "base"        # "small" for better accuracy
    MAX_TRANSCRIPT_CHARS: int = 50000  # guard against extremely long videos
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 12. Scalability Plan

### 12.1 Current Bottlenecks

| Bottleneck | Severity | Notes |
|---|---|---|
| Whisper transcription (CPU) | High | `base` model: ~1–4 min for 60s audio on CPU |
| OpenAI embedding API call | Medium | ~1–2s for full batch; rate limit risk at scale |
| ChromaDB in-process | Medium | Single-process, no concurrency; fine for dev only |
| SQLite | Low | Adequate for < 100 concurrent users |

### 12.2 Horizontal Scaling Path

**Phase 1 (Current — single machine):**
- FastAPI with `uvicorn --workers 4`
- ChromaDB as embedded local store
- SQLite

**Phase 2 (Multi-user production — 10–100 concurrent sessions):**
- Migrate ingestion pipeline to background task queue: Celery + Redis
- `POST /ingest` returns immediately with `{"status": "pending", "session_id": "..."}`
- Client polls `GET /session/{id}` or uses WebSocket for status updates
- Qdrant replaces ChromaDB (dedicated container or Qdrant Cloud)
- PostgreSQL replaces SQLite
- Whisper runs on dedicated GPU worker (or swapped for OpenAI Whisper API)

**Phase 3 (High-scale — 100+ concurrent):**
- Kubernetes deployment with separate deployments for: API, Celery workers, Qdrant
- Horizontal pod autoscaling on API tier
- OpenAI Whisper API replaces self-hosted model (eliminates GPU dependency)
- Session data in Redis with TTL for cleanup

### 12.3 Whisper Optimization

```python
# Option A: OpenAI Whisper API (Phase 2+)
from openai import OpenAI
client = OpenAI()
with open(audio_path, "rb") as f:
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=f,
        response_format="text"
    )

# Option B: faster-whisper (CTranslate2 engine, 4x faster on CPU)
from faster_whisper import WhisperModel
model = WhisperModel("base", device="cpu", compute_type="int8")
segments, _ = model.transcribe(audio_path, beam_size=1)
```

---

## 13. Cost Optimization Strategy

### 13.1 OpenAI Cost Breakdown (Per Session)

| Operation | Model | Approx. Tokens | Cost @ May 2025 |
|---|---|---|---|
| Embed 2 transcripts (avg ~2,000 chars each) | text-embedding-3-small | ~600 tokens | ~$0.000072 |
| Embed user query (per message) | text-embedding-3-small | ~20 tokens | ~$0.0000024 |
| GPT-4o-mini completion (per message, ~2K context) | gpt-4o-mini | ~2,500 tokens | ~$0.00065 |
| **Estimated cost per 10-message session** | | | **~$0.007** |

Cost per session is under 1 cent. The dominant cost driver is GPT-4o-mini inference.

### 13.2 Optimization Levers

**Transcript truncation:** Cap raw transcript at `MAX_TRANSCRIPT_CHARS = 50_000` characters. Videos over ~6 hours are truncated (irrelevant for Reels).

**Embedding cache:** Cache embeddings by `(video_id, transcript_hash)` in the DB. If the same video is submitted in a new session, skip re-embedding.

```python
async def get_or_create_embeddings(video_id: str, transcript: str) -> list[list[float]]:
    transcript_hash = hashlib.sha256(transcript.encode()).hexdigest()
    cached = await db.get_embedding_cache(video_id, transcript_hash)
    if cached:
        return cached
    embeddings = await embed(transcript)
    await db.save_embedding_cache(video_id, transcript_hash, embeddings)
    return embeddings
```

**Memory window:** `ConversationBufferWindowMemory(k=10)` limits chat history passed to GPT-4o-mini. Without this, long conversations inflate token costs linearly.

**Whisper model selection:** `base` model for dev; `small` for prod (better accuracy, ~2x slower). Avoid `large` unless accuracy is critical.

**Session TTL:** Auto-delete vector store collections and DB records after 24 hours of inactivity. Implement via a scheduled job (APScheduler or cron).

```python
# Cleanup job runs every hour
async def cleanup_expired_sessions():
    cutoff = datetime.utcnow() - timedelta(hours=24)
    expired = await db.get_sessions_before(cutoff)
    for session in expired:
        chroma_client.delete_collection(f"session_{session.id.replace('-', '_')}")
        await db.delete_session(session.id)
```

---

## 14. Security Considerations

### 14.1 Input Validation

All URLs must pass strict validation before any network call:

```python
import re

YOUTUBE_PATTERN = re.compile(
    r"^https?://(www\.)?(youtube\.com/watch\?v=|youtu\.be/)[\w-]{11}"
)
INSTAGRAM_PATTERN = re.compile(
    r"^https?://(www\.)?instagram\.com/reel/[\w-]+/?$"
)

def validate_urls(yt_url: str, ig_url: str):
    if not YOUTUBE_PATTERN.match(yt_url):
        raise ValueError("Invalid YouTube URL")
    if not INSTAGRAM_PATTERN.match(ig_url):
        raise ValueError("Invalid Instagram Reels URL")
```

### 14.2 Subprocess Hardening

`yt-dlp` and `whisper` are called via `subprocess`. Mitigations:

- Never pass user-supplied strings directly to the shell. Use list form: `subprocess.run(["yt-dlp", url], ...)` — not `shell=True`.
- Set `timeout=120` on all subprocess calls to prevent hanging.
- Run subprocess commands as a non-root user.
- Sandbox temp files to `/tmp/session_{session_id}/` and clean up on completion.

### 14.3 API Key Management

- All API keys stored in `.env`, loaded via `pydantic-settings`. Never committed.
- In production: use environment variables injected by the deployment system (Docker secrets, Kubernetes Secrets, or a secrets manager like AWS Secrets Manager).
- The OpenAI API key is never exposed to the frontend. All LLM calls happen server-side.

### 14.4 Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/ingest")
@limiter.limit("5/minute")  # prevent abuse of expensive ingestion
async def ingest(...): ...

@router.post("/chat")
@limiter.limit("30/minute")  # generous for conversational use
async def chat(...): ...
```

### 14.5 CORS

Restrict CORS to the frontend origin only. Do not use `allow_origins=["*"]` in production.

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],  # e.g. "https://yourdomain.com"
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)
```

### 14.6 Legal / ToS Considerations

- **YouTube:** `youtube-transcript-api` and `yt-dlp` access publicly available data. YouTube Data API v3 is used within its official quota (10,000 units/day free tier). Ensure compliance with YouTube's ToS regarding automated access.
- **Instagram:** `yt-dlp` scrapes public Reels. Instagram's ToS prohibits automated scraping. This is a known risk; document it and plan to migrate to the Instagram Graph API (requires approved app + permissions) for a commercial product.
- **Whisper:** OpenAI Whisper model weights are MIT licensed. OpenAI Whisper API usage is governed by OpenAI's usage policies.

---

## 15. Deployment Architecture

### 15.1 Development (`docker compose up`)

```yaml
# docker-compose.yml
version: "3.9"
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
    volumes:
      - ./frontend:/app
    depends_on: [backend]

  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
      - DATABASE_URL=sqlite+aiosqlite:///./app.db
      - CHROMA_PERSIST_DIR=/data/chroma
      - USE_QDRANT=false
    volumes:
      - ./backend:/app
      - chroma_data:/data/chroma
      - /tmp:/tmp                    # for yt-dlp audio downloads

volumes:
  chroma_data:
```

### 15.2 Production (Minimal — Single VPS)

```
                ┌─────────────────────────────────┐
                │         VPS / EC2 Instance       │
                │                                 │
                │  ┌───────────┐  ┌─────────────┐ │
Internet ──────►│  │  Nginx    │  │  Next.js    │ │
HTTPS:443       │  │ (reverse  │──►  (port 3000) │ │
                │  │  proxy)   │  └─────────────┘ │
                │  │           │  ┌─────────────┐ │
                │  │           │──►  FastAPI     │ │
                │  └───────────┘  │  (port 8000) │ │
                │                 └──────┬────────┘ │
                │                        │          │
                │  ┌─────────────┐  ┌────▼────────┐ │
                │  │  Qdrant     │◄─│  SQLite /   │ │
                │  │  (port 6333)│  │  Postgres   │ │
                │  └─────────────┘  └─────────────┘ │
                └─────────────────────────────────────┘
                         │                │
                    OpenAI API      YouTube API
```

**Nginx config snippet:**
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_buffering off;           # CRITICAL for SSE streaming
        proxy_cache off;
        proxy_set_header X-Accel-Buffering no;
        proxy_read_timeout 300s;
    }

    location / {
        proxy_pass http://localhost:3000;
    }
}
```

**Note:** `proxy_buffering off` is mandatory for SSE. Without it, Nginx buffers the response and the frontend receives all tokens at once after completion — no streaming.

---

## 16. Folder Structure

```
video-rag-chatbot/
│
├── .env.example
├── .gitignore
├── docker-compose.yml
├── docker-compose.prod.yml
├── README.md
│
├── frontend/                          # Next.js 14 app
│   ├── .env.local
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx               # Home / URL input
│       │   ├── globals.css
│       │   └── session/
│       │       └── [id]/
│       │           └── page.tsx       # Session view
│       ├── components/
│       │   ├── UrlInputForm/
│       │   │   ├── index.tsx
│       │   │   └── ProgressIndicator.tsx
│       │   ├── VideoCard/
│       │   │   ├── index.tsx
│       │   │   ├── MetadataGrid.tsx
│       │   │   └── EmbeddedPlayer.tsx
│       │   ├── ChatPanel/
│       │   │   ├── index.tsx
│       │   │   ├── MessageList.tsx
│       │   │   ├── MessageBubble.tsx
│       │   │   ├── SourceCitation.tsx
│       │   │   └── ChatInput.tsx
│       │   └── shared/
│       │       ├── Badge.tsx
│       │       └── Skeleton.tsx
│       ├── hooks/
│       │   ├── useChat.ts             # SSE streaming hook
│       │   ├── useIngest.ts           # Ingestion + polling
│       │   └── useSession.ts          # Session data fetching
│       ├── lib/
│       │   ├── api.ts                 # API client (fetch wrappers)
│       │   └── utils.ts               # Formatters, validators
│       └── types/
│           └── index.ts               # Shared TypeScript interfaces
│
├── backend/                           # FastAPI app
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   ├── main.py                        # App factory + lifespan
│   ├── config.py                      # pydantic-settings
│   ├── database.py                    # SQLAlchemy async setup
│   ├── models.py                      # SQLAlchemy ORM models
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── ingest.py                  # POST /ingest
│   │   ├── chat.py                    # POST /chat (SSE)
│   │   ├── session.py                 # GET, DELETE /session/{id}
│   │   └── health.py                  # GET /health
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── ingestion.py               # Orchestration logic
│   │   ├── rag.py                     # LangChain chain builder
│   │   ├── embedding.py               # Embedding + vector store ops
│   │   └── cleanup.py                 # Session TTL cleanup
│   │
│   ├── extractors/
│   │   ├── __init__.py
│   │   ├── youtube.py                 # YT metadata + transcript chain
│   │   ├── instagram.py               # IG metadata + Whisper
│   │   └── whisper_runner.py          # Shared Whisper logic
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── ingest.py                  # Pydantic request/response models
│   │   └── chat.py
│   │
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── url_validator.py           # Regex validators
│   │   └── metadata_parser.py         # Hashtag extraction, date formatting
│   │
│   └── tests/
│       ├── conftest.py
│       ├── test_extractors.py
│       ├── test_rag.py
│       └── test_api.py
│
├── scripts/
│   ├── seed_test_session.py           # Create a test session for dev
│   └── benchmark_embedding.py         # Benchmark embedding cost/speed
│
└── docs/
    ├── PRD.md                         # This document
    ├── api-spec.yaml                  # OpenAPI 3.0 spec
    └── architecture.drawio
```

---

## 17. 5-Day Milestones

### Day 1 — Foundation + Extraction

**Goal:** Both videos can be ingested end-to-end and metadata + transcripts are persisted to SQLite.

**Tasks:**

- [ ] Initialize repo: Next.js + FastAPI + docker-compose
- [ ] Implement `url_validator.py`
- [ ] Build `YouTubeExtractor`: metadata from YouTube Data API v3, transcript via `youtube-transcript-api`
- [ ] Build `InstagramExtractor`: metadata via yt-dlp, transcript via Whisper
- [ ] Implement `whisper_runner.py` with `faster-whisper`
- [ ] `POST /ingest` endpoint: orchestrates extraction, saves to SQLite
- [ ] `GET /session/{id}` endpoint
- [ ] Write unit tests for extractors with mocked API responses

**Definition of Done:** `curl -X POST /api/v1/ingest -d '{"youtube_url": "...", "instagram_url": "..."}` returns a session with both videos' metadata and transcript lengths.

---

### Day 2 — Embedding Pipeline + Vector Store

**Goal:** Transcripts are chunked, embedded, and stored in ChromaDB. Similarity search works.

**Tasks:**

- [ ] Implement `embedding.py`: chunking with `RecursiveCharacterTextSplitter`
- [ ] ChromaDB integration with per-session collections
- [ ] Batch embedding via `text-embedding-3-small`
- [ ] Metadata payload attached to each chunk
- [ ] `DELETE /session/{id}`: cleans up vector store collection
- [ ] Unit test: insert chunks → similarity search → verify correct chunks returned
- [ ] Embedding cache in SQLite (`embedding_cache` table)

**Definition of Done:** After ingestion, `chroma_client.get_collection("session_{id}").count()` returns expected number of chunks (approximately `(yt_chars + ig_chars) / 450` ± 20%).

---

### Day 3 — LangChain RAG Chain + Streaming Chat

**Goal:** The chat endpoint works with streaming tokens, memory, and source citations.

**Tasks:**

- [ ] Build `rag.py`: `ConversationalRetrievalChain` with memory, custom prompt
- [ ] `POST /chat` endpoint with SSE response
- [ ] `AsyncIteratorCallbackHandler` for async token streaming
- [ ] Source citation post-processing (`format_sources()`)
- [ ] Session memory persistence: save chat messages to `chat_messages` table
- [ ] Integration test: send 3 messages, verify memory carries context

**Definition of Done:** `curl -N -X POST /api/v1/chat -d '{"session_id": "...", "message": "compare the two videos"}'` streams tokens with a `sources` event containing citations from both platforms.

---

### Day 4 — Frontend

**Goal:** Full UI is functional with URL input, video cards, and live streaming chat.

**Tasks:**

- [ ] Next.js project setup with Tailwind
- [ ] `UrlInputForm` with validation + `useIngest` hook + `ProgressIndicator`
- [ ] `VideoCard` with metadata grid and embedded player
- [ ] `ChatPanel` with `useChat` SSE hook + `MessageBubble` + `SourceCitation`
- [ ] `/session/[id]` page wiring all components together
- [ ] Error boundary for failed ingestion
- [ ] Manual end-to-end test: submit two URLs, see cards, ask 5 questions

**Definition of Done:** Full user flow works in browser: input → loading stages → video cards rendered → streaming chat with visible source citations.

---

### Day 5 — Hardening, Error Handling, and Deployment

**Goal:** Production-ready: error handling, rate limiting, cleanup job, and deployable.

**Tasks:**

- [ ] All three extraction fallbacks implemented and tested (youtube-transcript-api → yt-dlp subs → Whisper)
- [ ] Rate limiting with `slowapi`
- [ ] Session TTL cleanup job (APScheduler, runs hourly)
- [ ] `GET /health` endpoint
- [ ] Qdrant integration (`USE_QDRANT=true` path in `embedding.py`)
- [ ] Nginx config for SSE passthrough
- [ ] `docker-compose.prod.yml` with Qdrant service
- [ ] Environment variable documentation in README
- [ ] Load test: simulate 5 concurrent ingestion requests

**Definition of Done:** `docker compose -f docker-compose.prod.yml up` starts the full stack. All Day 4 flows work against Qdrant. No unhandled 500 errors on invalid URLs or missing API keys.

---

## 18. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Instagram changes yt-dlp behavior (geo-block, auth wall) | High | High | Document fallback: return partial data with error flag; guide user to manually paste transcript text |
| YouTube captions disabled (live streams, music videos) | Medium | Medium | Three-stage fallback chain is already implemented; Whisper handles this |
| OpenAI API rate limits during peak embedding | Low | Medium | Exponential backoff with `tenacity`; embedding cache prevents re-embedding same video |
| Whisper transcription too slow (CPU, long video) | High | Medium | Use `faster-whisper` with `int8` quantization; set 15-minute video cap client-side |
| SSE stream cut by proxy/firewall | Medium | Medium | Document Nginx `proxy_buffering off` requirement; implement SSE heartbeat (`data: {"type": "ping"}`) every 15s |
| ChromaDB collection isolation failure (UUID collision) | Very Low | High | UUIDs are cryptographically random; assert collection name is unique before creation |
| Instagram follower count unavailable via yt-dlp | High | Low | Return `null` for `follower_count` with a `"data_unavailable"` flag; do not block ingestion |
| yt-dlp subprocess injection via crafted URL | Low | Critical | Strict URL regex validation before any subprocess call; never use `shell=True` |
| LangChain version API churn | Medium | Medium | Pin all LangChain dependencies to exact versions in `requirements.txt`; use `langchain==0.3.x` |
| OpenAI GPT-4o-mini context window overflow (very long transcripts) | Low | Medium | `MAX_TRANSCRIPT_CHARS` guard; chunk retrieval limits context to top-5 chunks (~2,500 chars) |

---

## 19. Future Improvements

**F1 — Async Ingestion with WebSockets:** Replace synchronous `POST /ingest` with a task queue (Celery + Redis). Client connects via WebSocket to receive real-time stage updates instead of polling.

**F2 — Support More Platforms:** TikTok and Twitter/X are natural next targets. Abstract the extractor interface so new platforms require only implementing `get_metadata()` and `get_transcript()`.

**F3 — Transcript Timeline Linking:** When YouTube captions are available, store `start_time` per chunk. In source citations, render a clickable timestamp that seeks the embedded player to the relevant moment.

**F4 — Engagement Analytics Dashboard:** Add a visualization panel (Chart.js or Recharts) showing side-by-side bar charts of all metrics. Currently all metrics are text-only.

**F5 — Comment Sentiment Analysis:** Retrieve top 50 comments from YouTube Data API v3 and run a sentiment pass (GPT-4o-mini or a dedicated model). Surface sentiment score alongside engagement rate.

**F6 — Multi-Video Sessions:** Allow more than two videos. Generalize the vector store to N videos per session with per-video namespace filtering. Retriever would support "filter to video X" queries.

**F7 — Persistent User Sessions:** Add authentication (NextAuth.js + JWT). Users can save sessions, name them, and return to past comparisons.

**F8 — Instagram Graph API Migration:** Replace yt-dlp Instagram scraping with the official Instagram Graph API to ensure ToS compliance and access richer analytics (impressions, reach, saves).

**F9 — Transcript Quality Scoring:** After Whisper transcription, compute a confidence score (average log-probability from Whisper's output). Surface a warning badge on the video card if confidence is below a threshold (e.g., heavily accented speech, background music).

**F10 — Export Report:** Generate a PDF comparison report from the session data, formatted with key metrics and an AI-generated summary. Useful for content strategists who want a shareable artifact.

---

*End of PRD — v1.0*
