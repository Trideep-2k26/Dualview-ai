export const BASE_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ||
  (import.meta as { env?: Record<string, string> }).env?.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000";

export interface VideoMetadata {
  video_id: string;
  url: string;
  platform: string;
  creator: string;
  follower_count: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  hashtags: string[];
  upload_date: string;
  duration_seconds: number;
  engagement_rate: number | null;
  transcript_available: boolean;
  thumbnail_url?: string;
  
  // Extra fields
  source_url?: string;
  playable_url?: string;
  transcript_source?: string;
  transcript_language?: string;
  transcript_language_name?: string;
  transcript_word_count?: number;
  translation_used?: boolean;
  warnings?: string[];
  metadata_quality?: string | null;
}


export interface IngestResponse {
  session_id: string;
  video_a: VideoMetadata;
  video_b: VideoMetadata;
  chunks_indexed: number;
  warnings: string[];
}

export interface Citation {
  video_id: string;
  chunk_id: string;
  text_preview: string;
  source_url: string;
  original_text?: string;
  original_text_preview?: string;
}

export async function ingestVideos(videoAUrl: string, videoBUrl: string): Promise<IngestResponse> {
  const response = await fetch(`${BASE_URL}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_a_url: videoAUrl, video_b_url: videoBUrl }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const detail = (err as { detail?: string }).detail;
    if (response.status === 422) {
      throw new Error(detail || "Validation error: please check the video URLs.");
    }
    if (response.status >= 500) {
      throw new Error(detail || "Backend error while processing videos.");
    }
    throw new Error(detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function* streamChat(
  sessionId: string,
  message: string
): AsyncGenerator<{ type: string; token?: string; citations?: Citation[]; message?: string }> {
  const response = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const detail = (err as { detail?: string }).detail;
    throw new Error(detail || `HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Stream not available. Please retry.");
  }
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) {
        continue;
      }
      if (!trimmed.startsWith('data:')) {
        continue;
      }
      const payload = trimmed.slice(5).trim();
      if (!payload) {
        continue;
      }
      try {
        const parsed = JSON.parse(payload);
        yield parsed;
      } catch {
        // Ignore partial or malformed chunk
      }
    }
  }
}
