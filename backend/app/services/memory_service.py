import os
import json
from typing import Dict, Any

_SESSIONS: Dict[str, Any] = {}
_CHAT_HISTORY: Dict[str, list] = {}

# data/sessions is located in the project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SESSIONS_DIR = os.path.join(BASE_DIR, "data", "sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)


def _get_session_path(session_id: str) -> str:
    return os.path.join(SESSIONS_DIR, f"{session_id}.json")


def _get_chat_path(session_id: str) -> str:
    return os.path.join(SESSIONS_DIR, f"{session_id}_chat.json")


def save_session(session_id: str, data: Any):
    _SESSIONS[session_id] = data
    try:
        with open(_get_session_path(session_id), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def get_session(session_id: str):
    if session_id in _SESSIONS:
        return _SESSIONS[session_id]
    
    # Try reading from disk
    path = _get_session_path(session_id)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                _SESSIONS[session_id] = data
                return data
        except Exception:
            pass
    return None


def clear_session(session_id: str):
    if session_id in _SESSIONS:
        del _SESSIONS[session_id]
    if session_id in _CHAT_HISTORY:
        del _CHAT_HISTORY[session_id]
    
    try:
        sp = _get_session_path(session_id)
        if os.path.exists(sp):
            os.remove(sp)
        cp = _get_chat_path(session_id)
        if os.path.exists(cp):
            os.remove(cp)
    except Exception:
        pass


def append_chat_message(session_id: str, role: str, content: str, citations: list = None):
    history = get_chat_history(session_id)
    msg = {"role": role, "content": content}
    if citations is not None:
        msg["citations"] = citations
    history.append(msg)
    # Sliding window of last 10 messages to optimize prompt size and performance
    if len(history) > 10:
        history = history[-10:]
    _CHAT_HISTORY[session_id] = history
    
    try:
        with open(_get_chat_path(session_id), "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def get_chat_history(session_id: str) -> list:
    if session_id in _CHAT_HISTORY:
        return _CHAT_HISTORY[session_id]
    
    # Try reading from disk
    path = _get_chat_path(session_id)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                history = json.load(f)
                _CHAT_HISTORY[session_id] = history
                return history
        except Exception:
            pass
    return []
