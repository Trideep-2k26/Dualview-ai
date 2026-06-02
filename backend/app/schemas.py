from pydantic import BaseModel, Field
from typing import List, Optional


class IngestRequest(BaseModel):
    video_a_url: str
    video_b_url: str


class VideoMetadata(BaseModel):
    video_id: Optional[str] = None
    url: Optional[str] = None
    platform: Optional[str] = None
    creator: Optional[str] = None
    follower_count: Optional[int] = None
    views: Optional[int] = None
    likes: Optional[int] = None
    comments: Optional[int] = None
    hashtags: List[str] = []
    upload_date: Optional[str] = None
    duration_seconds: int = 0
    engagement_rate: Optional[float] = None
    transcript_available: bool = False
    
    # Expanded metadata fields
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    creator_url: Optional[str] = None
    channel_url: Optional[str] = None
    tags: List[str] = []
    categories: List[str] = []
    language: Optional[str] = None
    age_limit: Optional[int] = None
    webpage_url: Optional[str] = None
    average_rating: Optional[float] = None
    comment_count: Optional[int] = None
    like_count: Optional[int] = None
    view_count: Optional[int] = None
    duration_string: Optional[str] = None
    upload_date_formatted: Optional[str] = None
    platform_display_name: Optional[str] = None
    
    # Extra fields for playable media / cached details
    source_url: Optional[str] = None
    playable_url: Optional[str] = None
    transcript_source: Optional[str] = None
    metadata_quality: Optional[str] = None
    warnings: List[str] = []

    # Derived properties
    hook_summary: Optional[str] = None
    transcript_word_count: Optional[int] = 0
    estimated_speaking_density: Optional[float] = 0.0
    content_type_guess: Optional[str] = None
    has_transcript: bool = False
    transcript_language: Optional[str] = None
    transcript_language_name: Optional[str] = None   # e.g. "Hindi", "Bengali"
    transcript_original_text: Optional[str] = None   # original non-English text (first 500 chars stored)
    translation_used: bool = False                   # True when transcript was translated to English



class IngestResponse(BaseModel):
    session_id: str
    video_a: VideoMetadata
    video_b: VideoMetadata
    chunks_indexed: int = 0
    warnings: List[str] = []
    available_transcript_videos: List[str] = []


class ChatRequest(BaseModel):
    session_id: str
    message: str
