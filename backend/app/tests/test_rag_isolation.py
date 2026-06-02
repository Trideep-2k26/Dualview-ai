import os
import sys
import pytest

# Ensure backend package is importable when running pytest from repo root
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.services.rag_service import detect_query_scope, generate_response_stream, get_last_citations
from langchain_google_genai import ChatGoogleGenerativeAI


def test_detect_query_scope():
    video_a = {
        "video_id": "vid_a_123",
        "title": "Learn Python Programming for Beginners",
        "creator": "TechWithTim",
        "platform": "youtube"
    }
    video_b = {
        "video_id": "vid_b_456",
        "title": "Day in the Life of a Software Engineer Reel",
        "creator": "CodeCoder",
        "platform": "instagram"
    }

    # Case 1: Video A specific queries
    assert detect_query_scope("What is the tone of Video A?", [], video_a, video_b) == "A"
    assert detect_query_scope("Tim's video engagement", [], video_a, video_b) == "A"
    assert detect_query_scope("How long is the Python tutorial?", [], video_a, video_b) == "A"

    # Case 2: Video B specific queries
    assert detect_query_scope("What is being said in Video B?", [], video_a, video_b) == "B"
    assert detect_query_scope("CodeCoder engagement rate", [], video_a, video_b) == "B"
    assert detect_query_scope("Day in the Life of a Software Engineer pacing", [], video_a, video_b) == "B"

    # Case 3: Comparison / Both / VS
    assert detect_query_scope("compare the two videos", [], video_a, video_b) == "BOTH"
    assert detect_query_scope("Which is better?", [], video_a, video_b) == "BOTH"
    assert detect_query_scope("Video A vs Video B", [], video_a, video_b) == "BOTH"
    assert detect_query_scope("what is the difference in hook between Tim's video and CodeCoder?", [], video_a, video_b) == "BOTH"

    # Case 4: History/continuity
    history_a = [
        {"role": "user", "content": "What is Tim's video about?"},
        {"role": "assistant", "content": "It's a Python programming tutorial."}
    ]
    # Follow up query should resolve to A
    assert detect_query_scope("What is the hook?", history_a, video_a, video_b) == "A"

    history_b = [
        {"role": "user", "content": "Tell me about CodeCoder's clip"},
        {"role": "assistant", "content": "It's a day in the life vlog."}
    ]
    assert detect_query_scope("Summarize it.", history_b, video_a, video_b) == "B"


@pytest.mark.anyio
async def test_generate_response_stream_scoped_retrieval(monkeypatch):
    # Setup video metadata in the session
    mock_session = {
        "video_a": {
            "video_id": "vid_a_123",
            "title": "Learn Python",
            "creator": "TechWithTim",
            "platform": "youtube",
            "views": 1000,
            "likes": 100,
            "comments": 10
        },
        "video_b": {
            "video_id": "vid_b_456",
            "title": "Instagram Day",
            "creator": "CodeCoder",
            "platform": "instagram",
            "views": 2000,
            "likes": 200,
            "comments": 20
        }
    }

    # Record similarity search calls to check video_ids scope filtering
    similarity_search_calls = []
    
    def mock_similarity_search(session_id, query, k=4, video_ids=None):
        similarity_search_calls.append({
            "session_id": session_id,
            "query": query,
            "k": k,
            "video_ids": video_ids
        })
        # Return mock chunks
        return [
            {
                "chunk_id": "chunk_1",
                "video_id": "vid_a_123",
                "text": "This is Python programming context.",
                "video_label": "Video A",
                "chunk_index": 1,
                "source_url": "http://youtube.com/a",
                "title": "Learn Python"
            },
            {
                "chunk_id": "chunk_2",
                "video_id": "vid_b_456",
                "text": "This is Instagram daily routine context.",
                "video_label": "Video B",
                "chunk_index": 1,
                "source_url": "http://instagram.com/b",
                "title": "Instagram Day"
            }
        ]

    # Mock DB/Session/Memory methods
    monkeypatch.setattr("app.services.rag_service.get_session", lambda sid: mock_session)
    monkeypatch.setattr("app.services.rag_service.get_chat_history", lambda sid: [])
    monkeypatch.setattr("app.services.rag_service.append_chat_message", lambda *args, **kwargs: None)
    monkeypatch.setattr("app.services.rag_service.similarity_search", mock_similarity_search)
    
    # Mock settings GOOGLE_API_KEY so model doesn't raise error
    monkeypatch.setattr("app.services.rag_service.settings.GOOGLE_API_KEY", "fake_key")

    # Mock ChatGoogleGenerativeAI's astream method
    async def mock_astream(self, input, *args, **kwargs):
        class Chunk:
            content = "Mocked LLM answer highlighting Video A and B."
            usage_metadata = {"input_tokens": 12, "output_tokens": 6, "total_tokens": 18}
        yield Chunk()

    monkeypatch.setattr(ChatGoogleGenerativeAI, "astream", mock_astream)

    # 1. Query targeting Video A only
    tokens = []
    async for token in generate_response_stream("sess_123", "What is the hook of Tim's video?"):
        tokens.append(token)
    
    # Assert similarity search was restricted to A
    assert len(similarity_search_calls) == 1
    assert similarity_search_calls[0]["video_ids"] == ["vid_a_123"]
    
    # Check that citations were set
    citations = get_last_citations("sess_123")
    assert len(citations) > 0
    assert any(c["video_id"] == "vid_a_123" for c in citations)

    # Reset calls list
    similarity_search_calls.clear()

    # 2. Query targeting Video B only
    tokens = []
    async for token in generate_response_stream("sess_123", "What is said in the Instagram Reel?"):
        tokens.append(token)
        
    assert len(similarity_search_calls) == 1
    assert similarity_search_calls[0]["video_ids"] == ["vid_b_456"]

    # Reset calls list
    similarity_search_calls.clear()

    # 3. Query targeting Both
    tokens = []
    async for token in generate_response_stream("sess_123", "Compare Tim's video vs CodeCoder's clip"):
        tokens.append(token)
        
    assert len(similarity_search_calls) == 1
    assert "vid_a_123" in similarity_search_calls[0]["video_ids"]
    assert "vid_b_456" in similarity_search_calls[0]["video_ids"]


@pytest.mark.anyio
async def test_generate_response_stream_missing_transcript_fallback(monkeypatch):
    mock_session = {
        "video_a": {
            "video_id": "vid_a_123",
            "title": "Learn Python",
            "creator": "TechWithTim",
            "platform": "youtube",
            "transcript_available": True,
            "views": 1000,
        },
        "video_b": {
            "video_id": "vid_b_456",
            "title": "Instagram Day",
            "creator": "CodeCoder",
            "platform": "instagram",
            "transcript_available": False,
            "views": 2000,
        }
    }

    # Mock DB/Session/Memory methods
    monkeypatch.setattr("app.services.rag_service.get_session", lambda sid: mock_session)
    monkeypatch.setattr("app.services.rag_service.get_chat_history", lambda sid: [])
    monkeypatch.setattr("app.services.rag_service.append_chat_message", lambda *args, **kwargs: None)
    
    # 1. Asking about missing transcript for Video B should trigger direct fallback response
    tokens = []
    async for token in generate_response_stream("sess_123", "What is said in Video B?"):
        tokens.append(token)
    
    response = "".join(tokens)
    assert "I don’t have reliable transcript evidence for Video B" in response

    # 2. Compare query with only Video A having transcript should append notice and stream LLM response
    similarity_search_calls = []
    def mock_similarity_search(session_id, query, k=4, video_ids=None):
        similarity_search_calls.append(query)
        return []

    monkeypatch.setattr("app.services.rag_service.similarity_search", mock_similarity_search)
    monkeypatch.setattr("app.services.rag_service.settings.GOOGLE_API_KEY", "fake_key")

    astream_input = {}
    async def mock_astream(self, input_dict, *args, **kwargs):
        nonlocal astream_input
        astream_input.update(input_dict)
        class Chunk:
            content = "Mocked LLM comparison."
            usage_metadata = {}
        yield Chunk()

    monkeypatch.setattr(ChatGoogleGenerativeAI, "astream", mock_astream)

    tokens = []
    async def run_chat():
        async for token in generate_response_stream("sess_123", "Compare both videos"):
            tokens.append(token)
    
    await run_chat()

    assert len(similarity_search_calls) == 1
    # The question sent to LLM should contain the fallback instructions directive in the HumanMessage content
    messages = astream_input.get("messages", [])
    human_msg_content = ""
    for m in messages:
        if m.__class__.__name__ == "HumanMessage" or hasattr(m, "content"):
            human_msg_content = getattr(m, "content", "")
    assert "Video B has no transcript available" in human_msg_content

