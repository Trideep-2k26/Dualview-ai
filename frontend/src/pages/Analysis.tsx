import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Lottie from "lottie-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Sparkles, Send,
  BookOpen, ExternalLink, ChevronDown, Play, Loader2, Youtube, Trophy
} from "lucide-react";
import { streamChat, IngestResponse, Citation, VideoMetadata, BASE_URL } from "@/lib/api";
import {
  formatNumber, formatDuration, formatDate, formatEngagement
} from "@/lib/utils-video";
import { cn } from "@/lib/utils";
import chatbotAnimation from "@/assets/chatbot.json";
import respondingAnimation from "@/assets/responding.json";
import VideoModal from "@/components/VideoModal";
import logo from "@/assets/logo.png";

/* ── Types ── */
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
  isThinking?: boolean;
}

const markdownComponents = {
  table: ({ children, ...props }: any) => (
    <div className="overflow-x-auto w-full rounded-xl border border-orange-100/80 my-4 shadow-sm bg-white">
      <table className="min-w-full divide-y divide-orange-50/30" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: any) => (
    <thead className="bg-orange-50/30" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }: any) => (
    <tbody className="bg-white divide-y divide-orange-50/30" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }: any) => (
    <tr className="hover:bg-orange-50/10 transition-colors" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }: any) => (
    <th className="px-4 py-3.5 text-left text-xs font-semibold text-orange-900 tracking-wider" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: any) => (
    <td className="px-4 py-3.5 text-sm text-gray-700 leading-normal" {...props}>
      {children}
    </td>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="list-disc pl-5 my-2 space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="list-decimal pl-5 my-2 space-y-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: any) => (
    <li className="text-gray-700" {...props}>
      {children}
    </li>
  ),
};

/* ── Helpers ── */
function getYouTubeId(url?: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1);
    const v = parsed.searchParams.get("v");
    if (v) return v;
    const parts = parsed.pathname.split("/");
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    // Shorts
    const shortsIdx = parts.indexOf("shorts");
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
    return "";
  } catch {
    return "";
  }
}

function isYouTubeUrl(url?: string) {
  return !!url && /youtu\.be|youtube\.com/.test(url);
}

function getYouTubeThumbnail(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function getThumbnailUrl(thumbnailUrl?: string, ytId?: string): string {
  if (!thumbnailUrl) {
    return ytId ? getYouTubeThumbnail(ytId) : "";
  }
  if (thumbnailUrl.startsWith("/")) {
    return `${BASE_URL}${thumbnailUrl}`;
  }
  return thumbnailUrl;
}

function getTranscriptBadgeLabel(video: VideoMetadata): string {
  if (!video.transcript_available) {
    return "Transcript unavailable";
  }

  // Check for quality/duration limits warning or low confidence
  const hasLimitWarning = !!video.warnings?.some(w => 
    w.toLowerCase().includes("limit") || 
    w.toLowerCase().includes("short") || 
    w.toLowerCase().includes("quality") || 
    w.toLowerCase().includes("insufficient") ||
    w.toLowerCase().includes("key sections") ||
    w.toLowerCase().includes("long video")
  );

  const isLowConfidence = video.transcript_source === "description" || hasLimitWarning;

  if (isLowConfidence) {
    return "Limited transcript confidence";
  }
  if (video.translation_used) {
    return "Translation applied";
  }
  if (video.transcript_source === "audio_whisper") {
    if (video.platform === "instagram") {
      return "Audio-only transcription";
    }
    return "Whisper transcription used";
  }
  if (video.transcript_source === "auto_captions") {
    return "Auto-generated captions used";
  }
  return "Transcript Ready";
}

function getTranscriptBadgeClass(video: VideoMetadata): string {
  if (!video.transcript_available) {
    return "bg-amber-50 border-amber-100 text-amber-600";
  }

  const label = getTranscriptBadgeLabel(video);
  switch (label) {
    case "Limited transcript confidence":
      return "bg-red-50 border-red-100 text-red-600";
    case "Translation applied":
      return "bg-purple-50 border-purple-100 text-purple-600";
    case "Whisper transcription used":
      return "bg-blue-50 border-blue-100 text-blue-600";
    case "Audio-only transcription":
      return "bg-indigo-50 border-indigo-100 text-indigo-600";
    case "Auto-generated captions used":
      return "bg-cyan-50 border-cyan-100 text-cyan-600";
    case "Transcript Ready":
    default:
      return "bg-green-50 border-green-100 text-green-600";
  }
}


/* ── Conversational prompt cards ── */
const PROMPT_CARDS = [
  {
    title: "Which creator delivered a stronger emotional message?",
    subtitle: "Analyze tone, pacing, and transcript clarity.",
    q: "Which creator delivered a stronger emotional message? Analyze tone, pacing, and transcript clarity for both videos.",
  },
  {
    title: "How could the weaker video improve retention?",
    subtitle: "Get practical creator coaching suggestions.",
    q: "Act as a creator coach. How could the weaker video improve viewer retention, hook strength, and message clarity?",
  },
];

/* ════════════════════════════════════════════════════════════ */
export default function Analysis() {
  const { toast } = useToast();

  /* ── Load data from sessionStorage ── */
  const [analysisData, setAnalysisData] = useState<IngestResponse | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("latestAnalysis");
    if (raw) {
      try {
        setAnalysisData(JSON.parse(raw));
      } catch {
        setAnalysisData(null);
      }
    }
    setDataLoaded(true);
  }, []);

  /* ── Video modal state ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [modalVideoId, setModalVideoId] = useState("");
  const [modalPlatform, setModalPlatform] = useState("");
  const [modalSourceUrl, setModalSourceUrl] = useState("");
  const [modalTitle, setModalTitle] = useState("");
  const [modalPlayableUrl, setModalPlayableUrl] = useState("");

  const openModal = (url: string, platform: string, titleStr: string, playableUrl?: string) => {
    const id = getYouTubeId(url);
    setModalVideoId(id);
    setModalPlatform(platform);
    setModalSourceUrl(url);
    setModalTitle(titleStr);
    setModalPlayableUrl(playableUrl || "");
    setModalOpen(true);
  };


  /* ── Warnings ── */
  const [warningsOpen, setWarningsOpen] = useState(false);

  /* ── Chat state ── */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [citationsOpen, setCitationsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const canChat = !!analysisData && (analysisData.video_a.transcript_available || analysisData.video_b.transcript_available);

  useEffect(() => {
    if (analysisData) {
      const hasA = analysisData.video_a.transcript_available;
      const hasB = analysisData.video_b.transcript_available;
      if ((!hasA && hasB) || (hasA && !hasB)) {
        toast({
          title: "Notice",
          description: "Some content details may be limited for one video.",
        });
      }
    }
  }, [analysisData]);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const isStreaming = lastMsg && lastMsg.role === "assistant" && lastMsg.isStreaming;
      
      if (isStreaming) {
        const el = chatContainerRef.current;
        if (el) {
          const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 200;
          if (isNearBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
          }
        }
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  /* ── Helpers ── */
  const getVideoLabel = (videoId?: string) => {
    if (!analysisData || !videoId) return "Video";
    if (videoId === analysisData.video_a.video_id) return "Video A";
    if (videoId === analysisData.video_b.video_id) return "Video B";
    return "Video";
  };

  const getVideoCreator = (videoId?: string) => {
    if (!analysisData || !videoId) return "";
    if (videoId === analysisData.video_a.video_id) return analysisData.video_a.creator;
    if (videoId === analysisData.video_b.video_id) return analysisData.video_b.creator;
    return "";
  };

  const getWinner = () => {
    if (!analysisData) return null;
    const erA = analysisData.video_a.engagement_rate;
    const erB = analysisData.video_b.engagement_rate;
    
    const erANull = erA === null || erA === undefined;
    const erBNull = erB === null || erB === undefined;
    
    if (erANull && erBNull) return null;
    if (erANull) return analysisData.video_b;
    if (erBNull) return analysisData.video_a;
    
    if (erA === erB) return "tie";
    return erA > erB ? analysisData.video_a : analysisData.video_b;
  };

  const latestCitations =
    messages
      .filter((m) => m.role === "assistant" && m.citations && m.citations.length > 0)
      .pop()?.citations || [];

  /* ── Chat send ── */
  const handleSendMessage = async (customMsg?: string) => {
    const msgToSend = customMsg || inputMessage;
    if (!msgToSend.trim() || !analysisData || isChatLoading) return;
    if (!analysisData.session_id) {
      toast({ title: "Missing session", description: "Please re-run the analysis.", variant: "destructive" });
      return;
    }
    if (!canChat) {
      toast({
        title: "Limited transcript",
        description: "Transcript unavailable. Metadata comparison is still available.",
        variant: "destructive",
      });
      return;
    }

    const userMsg: ChatMessage = { role: "user", content: msgToSend };
    const assistantMsg: ChatMessage = { role: "assistant", content: "", isStreaming: true, isThinking: true };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputMessage("");
    setIsChatLoading(true);

    let fullContent = "";
    let citations: Citation[] = [];

    try {
      for await (const event of streamChat(analysisData.session_id, msgToSend)) {
        if (event.type === "token" && event.token) {
          fullContent += event.token;
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: fullContent, isThinking: false } : m
            )
          );
        } else if (event.type === "citations" && event.citations) {
          citations = event.citations;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, isStreaming: false, isThinking: false, citations } : m
        )
      );
    } catch (err: any) {
      const errMsg = err?.message || "";
      const isSessionNotFound =
        errMsg.toLowerCase().includes("session not found") ||
        errMsg.includes("404") ||
        errMsg.toLowerCase().includes("not found");

      const displayMsg = isSessionNotFound
        ? "Session not found on server. This can happen if the backend restarted or the session expired. Please [go to the Dashboard](/dashboard) to re-run the comparison."
        : (errMsg || "Sorry, something went wrong. Please try again.");

      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, content: displayMsg, isStreaming: false, isThinking: false }
            : m
        )
      );
      toast({
        title: isSessionNotFound ? "Session Expired" : "Stream interrupted",
        description: isSessionNotFound ? "Please restart your comparison." : (errMsg || "Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  /* ════════ RENDER ════════ */

  /* Loading skeleton while sessionStorage is read */
  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-[#fffbf5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  /* Empty state — no data */
  if (!analysisData) {
    return (
      <div className="min-h-screen bg-[#fffbf5] flex flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="w-16 h-16 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-orange-300" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">No analysis found</h2>
          <p className="text-gray-500 mt-2 max-w-sm">
            Start a new comparison by pasting two video URLs on the dashboard.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="btn-orange-glow rounded-full px-8 py-3 font-semibold text-sm"
        >
          Go to Dashboard →
        </Link>
      </div>
    );
  }

  const winner = getWinner();

  return (
    <div className="min-h-screen bg-[#fffbf5] relative overflow-hidden font-sans">
      {/* Ambient orbs */}
      <div className="ambient-orb bg-orange-200" style={{ width: 400, height: 400, top: -100, left: -100 }} />
      <div className="ambient-orb bg-orange-100" style={{ width: 600, height: 600, bottom: -200, right: -200 }} />

      {/* Video Modal */}
      <VideoModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        videoId={modalVideoId}
        platform={modalPlatform}
        sourceUrl={modalSourceUrl}
        title={modalTitle}
        playableUrl={modalPlayableUrl}
      />


      {/* Header */}
      <header className="py-4 border-b border-orange-100 bg-white/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src={logo} alt="DualView AI" className="h-8 object-contain" />
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-full transition-colors"
          >
            + New Comparison
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 relative z-10">

        {/* ── Section header ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Comparison Overview
          </h1>
          <p className="text-sm font-medium mt-1.5">
            {analysisData.chunks_indexed > 0 ? (
              <span className="text-orange-500">Transcript ready · AI comparison enabled</span>
            ) : (
              <span className="text-amber-600">Metadata comparison available · Transcript limited</span>
            )}
          </p>
        </motion.div>



        {/* ── Video cards grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 relative"
        >
          {/* VS badge */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex w-12 h-12 bg-white border-2 border-orange-200 rounded-full items-center justify-center text-orange-500 font-bold text-sm shadow-lg"
            style={{ animation: "pulse-border-glow 2s ease-in-out infinite" }}
          >
            VS
          </div>

          {[
            { label: "Video A", video: analysisData.video_a },
            { label: "Video B", video: analysisData.video_b },
          ].map(({ label, video }) => {
            const ytId = isYouTubeUrl(video.url) ? getYouTubeId(video.url) : "";
            const rawThumbnail = (video as { thumbnail_url?: string }).thumbnail_url;
            const thumbnail = getThumbnailUrl(rawThumbnail, ytId);
            const isYT = isYouTubeUrl(video.url);
            const isInsta = video.platform.toLowerCase().includes("instagram");

            return (
              <div key={label} className="glass-card p-6 rounded-3xl shadow-sm">
                {/* Card header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="bg-orange-50 border border-orange-100 text-orange-600 text-xs font-semibold px-3 py-1 rounded-full">
                    {label} · {video.platform}
                  </span>
                  {(() => {
                    const label = getTranscriptBadgeLabel(video);
                    if (label === "Transcript unavailable" || label === "Auto-generated captions used") {
                      return null;
                    }
                    return (
                      <span className={cn(
                        "text-xs font-semibold px-3 py-1 rounded-full border",
                        getTranscriptBadgeClass(video)
                      )}>
                        {label}
                      </span>
                    );
                  })()}
                </div>

                {/* Thumbnail / preview */}
                <div
                  className="relative h-44 rounded-2xl overflow-hidden border border-orange-100 cursor-pointer group"
                  onClick={() => openModal(video.url, video.platform, (video as any).title || video.creator || label, video.playable_url)}
                >
                  {thumbnail ? (
                    <div className="w-full h-full relative">
                      <img
                        src={thumbnail}
                        alt={`${video.creator || 'Video'} thumbnail`}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-400"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) {
                            fallback.classList.remove("hidden");
                            fallback.classList.add("flex");
                          }
                        }}
                      />
                      <div className="absolute inset-0 hidden items-center justify-center bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 backdrop-blur-sm">
                        <div className="bg-white/80 backdrop-blur-md border border-orange-100 rounded-2xl p-4 shadow-sm text-center">
                          <span className="text-xs font-bold text-orange-600 uppercase tracking-wider block mb-1">
                            {video.platform}
                          </span>
                          <span className="text-sm font-bold text-gray-800 line-clamp-1 max-w-[200px]">
                            {video.creator || "Watch Video"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 flex items-center justify-center p-6 text-center">
                      <div className="bg-white/80 backdrop-blur-md border border-orange-100 rounded-2xl p-4 shadow-sm">
                        <span className="text-xs font-bold text-orange-600 uppercase tracking-wider block mb-1">
                          {video.platform}
                        </span>
                        <span className="text-sm font-bold text-gray-800 line-clamp-1 max-w-[200px]">
                          {video.creator || "Watch Video"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl"
                      style={{
                        background: "rgba(249,115,22,0.9)",
                        boxShadow: "0 0 30px rgba(249,115,22,0.5)",
                      }}
                    >
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    </div>
                  </div>

                  {/* Bottom label overlay */}
                  <div className="absolute bottom-0 inset-x-0 opacity-0 group-hover:opacity-100 transition-opacity px-4 pb-3">
                    <span className="text-white text-xs font-medium">
                      {isYT ? "Watch on YouTube" : isInsta ? "Open Instagram" : "Watch Video"}
                    </span>
                  </div>
                </div>

                {/* Title & Creator */}
                <div className="mt-4">
                  <h3
                    className="text-base font-bold text-gray-900 truncate"
                    title={(video as any).title || label}
                  >
                    {(video as any).title || label}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium truncate mt-0.5" title={video.creator}>
                    by {video.creator || "Unknown Creator"}
                  </p>
                </div>
 
                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-y-4 gap-x-3 mt-4 p-4 bg-white/50 rounded-2xl border border-gray-100">
                  {[
                    { 
                      label: "Views", 
                      value: (() => {
                        const v = (video as any).view_count !== undefined && (video as any).view_count !== null ? (video as any).view_count : video.views;
                        return v !== null && v !== undefined && v > 0 ? formatNumber(v) : "—";
                      })()
                    },
                    { 
                      label: "Likes", 
                      value: (() => {
                        const l = (video as any).like_count !== undefined && (video as any).like_count !== null ? (video as any).like_count : video.likes;
                        return l !== null && l !== undefined ? formatNumber(l) : "0";
                      })()
                    },
                    { 
                      label: "Comments", 
                      value: (() => {
                        const c = (video as any).comment_count !== undefined && (video as any).comment_count !== null ? (video as any).comment_count : video.comments;
                        return c !== null && c !== undefined ? formatNumber(c) : "0";
                      })()
                    },
                    { label: "Duration", value: (video as any).duration_string || formatDuration(video.duration_seconds) },
                    { label: "Uploaded", value: (video as any).upload_date_formatted || formatDate(video.upload_date) },
                    { 
                      label: "Engagement", 
                      value: video.engagement_rate !== null && video.engagement_rate !== undefined
                        ? formatEngagement(video.engagement_rate)
                        : "—"
                    },
                  ].map(({ label: statLabel, value }) => (
                    <div key={statLabel}>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                        {statLabel}
                      </div>
                      <div className="text-sm font-bold text-gray-800 mt-0.5">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Hook Summary if available */}
                {(video as any).hook_summary && (
                  <div className="mt-4 p-3 bg-orange-50/50 border border-orange-100/50 rounded-xl">
                    <div className="text-[10px] text-orange-500 uppercase tracking-wider font-semibold">Hook Summary</div>
                    <p className="text-xs text-gray-600 mt-1 italic leading-relaxed">"{(video as any).hook_summary}"</p>
                  </div>
                )}

                {/* Open source link */}
                <a
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {isYT ? "Open on YouTube" : isInsta ? "Open on Instagram" : "Open source"}
                </a>
              </div>
            );
          })}
        </motion.div>

        {/* Subtle Info Area for Data/Transcript limitations */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            For detailed platform metrics limitations or transcript sources, ask the AI comparison assistant below.
          </p>
        </div>

        {/* ── Engagement winner panel ── */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mt-6 p-6 rounded-2xl border border-orange-100 flex items-center justify-between shadow-sm"
            style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.04) 0%, rgba(251,146,60,0.03) 100%)" }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl border border-orange-100 flex items-center justify-center shadow-sm flex-shrink-0">
                <Trophy className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
                  Better Engagement
                </div>
                {winner === "tie" ? (
                  <div className="text-xl font-bold text-gray-900 mt-0.5">
                    It's a tie 🤝
                  </div>
                ) : winner ? (
                  <div className="text-xl font-bold text-gray-900 mt-0.5">
                    {winner.creator}{" "}
                    <span className="text-orange-500 font-semibold ml-2">
                      {formatEngagement(winner.engagement_rate)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            {winner !== "tie" && winner && (
              <div className="hidden sm:block">
                <span className="bg-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.4)]">
                  ↑ Higher Engagement
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Chat + Citations ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-10 glass-card rounded-3xl p-0 flex flex-col lg:flex-row shadow-lg border border-orange-200/60 h-auto lg:h-[680px] overflow-visible lg:overflow-hidden relative"
        >
          {/* ── Chat Area ── */}
          <div className="w-full lg:flex-1 flex flex-col bg-white/40 h-[550px] lg:h-full min-h-0 rounded-t-3xl lg:rounded-l-3xl lg:rounded-tr-none">

            {/* Chat header */}
            <div className="bg-white/80 border-b border-orange-100 px-6 py-4 flex items-center justify-between backdrop-blur-md flex-shrink-0">
              <div className="flex items-center gap-2 text-gray-900">
                <Sparkles className="w-5 h-5 text-orange-400" />
                <span className="font-bold">AI Comparison</span>
              </div>
            </div>

            {/* Messages / empty state */}
            <div
              ref={chatContainerRef}
              className={cn(
                "flex-1 px-6 py-6 min-h-0",
                messages.length === 0 ? "overflow-hidden flex flex-col justify-center" : "overflow-y-auto scrollbar-thin"
              )}
            >
              {messages.length === 0 ? (
                /* ── Chat empty state — premium redesign ── */
                <div className="flex flex-col items-center justify-center text-center px-4 py-3">

                  {/* Free-floating animation — no box, no card */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="relative flex items-center justify-center mb-4 mt-6 flex-shrink-0"
                  >
                    {/* Soft orange ambient halo — no border, pure glow */}
                    <div
                      className="absolute rounded-full animate-orb-breathe pointer-events-none"
                      style={{
                        width: "280px",
                        height: "280px",
                        background: "radial-gradient(ellipse, rgba(249,115,22,0.14) 0%, rgba(251,146,60,0.06) 45%, transparent 70%)",
                        filter: "blur(32px)",
                      }}
                    />
                    {/* Animation — floating freely, no surrounding card */}
                    <div className="relative animate-float-slow">
                      <Lottie
                        animationData={chatbotAnimation}
                        loop
                        style={{ width: "200px", height: "200px" }}
                      />
                    </div>
                  </motion.div>

                  {/* Heading */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.12 }}
                    className="mb-1 flex-shrink-0"
                  >
                    <h3
                      className="font-extrabold text-gray-900 tracking-tight leading-tight"
                      style={{ fontSize: "1.45rem", letterSpacing: "-0.02em" }}
                    >
                      What would you like to discover?
                    </h3>
                  </motion.div>

                  {/* Subtitle — creator language, no technical jargon */}
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="text-gray-400 mb-5 leading-relaxed max-w-sm text-xs flex-shrink-0"
                  >
                    Ask about message clarity, engagement, pacing, hooks, and creator strategy.
                  </motion.p>

                  {/* ── 4 Large conversational prompt cards — 2-col grid ── */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.28 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl flex-shrink-0"
                  >
                    {PROMPT_CARDS.map((card, i) => (
                      <button
                        key={i}
                        onClick={() => { handleSendMessage(card.q); }}
                        className="group flex flex-col items-start text-left p-4 rounded-2xl cursor-pointer prompt-card outline-none focus:outline-none focus-visible:outline-none"
                        style={{
                          background: "rgba(255,255,255,0.85)",
                          border: "1px solid rgba(229,231,235,0.9)",
                          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                          backdropFilter: "blur(8px)",
                          WebkitBackdropFilter: "blur(8px)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <p className="text-sm font-semibold text-gray-800 leading-snug group-hover:text-orange-700 transition-colors duration-150">
                          {card.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed font-normal">
                          {card.subtitle}
                        </p>
                      </button>
                    ))}
                  </motion.div>

                </div>
              ) : (
                /* ── Messages ── */
                <div className="space-y-6">
                  {messages.map((m, i) => {
                    const isAssistantThinkingOnly = m.role === "assistant" && m.isThinking && !m.content;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                      >
                        {isAssistantThinkingOnly ? (
                          <div className="flex items-center justify-start pl-4 py-2">
                            <Lottie 
                              animationData={respondingAnimation} 
                              loop 
                              style={{ width: "60px", height: "30px" }} 
                            />
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "px-5 py-4 max-w-[85%] text-sm leading-relaxed shadow-sm",
                              m.role === "user"
                                ? "bg-orange-500 text-white rounded-3xl rounded-br-sm font-medium"
                                : "bg-white border border-gray-100 text-gray-800 rounded-3xl rounded-bl-sm"
                            )}
                          >
                            {m.role === "assistant" ? (
                              <div className="space-y-3">
                                {m.content && (
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    className="prose prose-sm max-w-none prose-headings:text-orange-600 prose-headings:font-semibold prose-p:my-2 prose-li:my-1 prose-strong:text-gray-900"
                                    components={markdownComponents}
                                  >
                                    {m.content}
                                  </ReactMarkdown>
                                )}
                                {m.isStreaming && m.content && (
                                  <span className="inline-block animate-blink ml-1 font-bold text-orange-400">|</span>
                                )}
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap">{m.content}</div>
                            )}
                            {m.citations && m.citations.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-gray-100">
                                <div className="flex items-center gap-1.5 text-xs text-orange-600 font-bold mb-2">
                                  <BookOpen className="w-3.5 h-3.5" />
                                  Sources ({m.citations.length})
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                  {m.citations.map((c: any, idx) => (
                                    <a
                                      key={idx}
                                      href={c.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-2 rounded-xl bg-orange-50/50 hover:bg-orange-50 border border-orange-100/50 hover:border-orange-200 transition-all flex flex-col text-left group"
                                    >
                                      <div className="flex items-center justify-between gap-1.5">
                                        <span className="text-[10px] font-bold text-orange-700 truncate">
                                          {c.video_label || getVideoLabel(c.video_id)}
                                        </span>
                                        <span className="text-[9px] text-gray-400 font-mono">
                                          Index {c.chunk_index || c.chunk_id?.slice(-3)}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-gray-600 mt-1 line-clamp-2 italic">
                                        "{c.text_preview || c.text}"
                                      </p>
                                      {c.original_text_preview && (
                                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1 italic">
                                          Original: "{c.original_text_preview}"
                                        </p>
                                      )}
                                      <span className="text-[9px] text-orange-500 font-semibold mt-1 flex items-center gap-0.5 group-hover:underline">
                                        Open source <ExternalLink className="w-2.5 h-2.5" />
                                      </span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Chat input — glass premium style */}
            <div
              className="border-t border-orange-100/60 px-5 py-4 backdrop-blur-md flex-shrink-0 rounded-b-3xl lg:rounded-bl-3xl lg:rounded-br-none z-10"
              style={{ background: "rgba(255,255,255,0.90)", position: "relative" }}
            >
              <div
                className={cn(
                  "chat-input-wrap flex items-center gap-3 px-2 py-2 rounded-2xl transition-all duration-200",
                  isChatLoading && "opacity-60 bg-gray-50/50 cursor-not-allowed pointer-events-none"
                )}
                style={{
                  background: "rgba(255,255,255,0.98)",
                  border: "1.5px solid rgba(229,231,235,0.8)",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.04), 0 0 0 0 rgba(249,115,22,0)",
                }}
                onFocus={(e) => {
                  if (isChatLoading) return;
                  const wrap = e.currentTarget;
                  wrap.style.borderColor = "rgba(249,115,22,0.45)";
                  wrap.style.boxShadow = "0 0 0 3px rgba(249,115,22,0.07), 0 4px 16px rgba(249,115,22,0.08)";
                }}
                onBlur={(e) => {
                  if (isChatLoading) return;
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    const wrap = e.currentTarget;
                    wrap.style.borderColor = "rgba(229,231,235,0.8)";
                    wrap.style.boxShadow = "0 2px 16px rgba(0,0,0,0.04)";
                  }
                }}
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={isChatLoading ? "AI is typing..." : "Ask about engagement, storytelling, hooks, pacing…"}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 h-10 text-gray-900 placeholder:text-gray-400 outline-none"
                  disabled={isChatLoading || !canChat}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isChatLoading || !inputMessage.trim() || !canChat}
                  className="flex-shrink-0 w-10 h-10 rounded-xl text-white flex items-center justify-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #f97316, #ea580c)",
                    boxShadow: "0 0 16px rgba(249,115,22,0.30), 0 2px 8px rgba(249,115,22,0.18)",
                  }}
                  onMouseEnter={(e) => {
                    if (!(e.currentTarget as HTMLButtonElement).disabled) {
                      e.currentTarget.style.boxShadow = "0 0 28px rgba(249,115,22,0.55), 0 4px 14px rgba(249,115,22,0.30)";
                      e.currentTarget.style.transform = "scale(1.06) translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 16px rgba(249,115,22,0.30), 0 2px 8px rgba(249,115,22,0.18)";
                    e.currentTarget.style.transform = "scale(1) translateY(0)";
                  }}
                >
                  {isChatLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 ml-0.5" />
                  )}
                </button>
              </div>
              {!canChat ? (
                <p className="text-xs text-amber-500/80 mt-2 text-center font-medium">
                  Transcript unavailable — metadata comparison is still available.
                </p>
              ) : (
                (analysisData.video_a.transcript_available !== analysisData.video_b.transcript_available) && (
                  <p className="text-xs text-amber-500/80 mt-2 text-center font-medium">
                    Some content details may be limited for one video.
                  </p>
                )
              )}
            </div>
          </div>

          {/* ── Citations Sidebar ── */}
          <div className="w-full lg:w-[360px] border-t lg:border-t-0 lg:border-l border-orange-100 bg-orange-50/30 flex flex-col h-auto lg:h-full min-h-0 flex-shrink-0 rounded-b-3xl lg:rounded-r-3xl lg:rounded-bl-none mt-6 lg:mt-0 shadow-sm lg:shadow-none">
            <button
              className="px-5 py-4 border-b border-orange-100 bg-white/50 backdrop-blur-md flex items-center justify-between flex-shrink-0"
              onClick={() => setCitationsOpen(!citationsOpen)}
            >
              <span className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-orange-500" /> Source Citations
              </span>
              <ChevronDown
                className={cn("w-4 h-4 text-orange-400 transition-transform", citationsOpen && "rotate-180")}
              />
            </button>

            <div
              className={cn(
                "scrollbar-thin",
                !citationsOpen 
                  ? "hidden lg:block lg:flex-1 lg:overflow-y-auto lg:min-h-0" 
                  : "block h-auto overflow-visible p-0 lg:flex-1 lg:overflow-y-auto lg:min-h-0"
              )}
            >
              {latestCitations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,247,237,1), rgba(255,237,213,0.6))",
                      border: "1.5px solid rgba(249,115,22,0.12)",
                      boxShadow: "0 4px 16px rgba(249,115,22,0.08)",
                    }}
                  >
                    <BookOpen className="text-orange-300 w-7 h-7" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 tracking-tight">No citations yet</p>
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed max-w-[180px]">
                    AI citations will appear here after a response is generated.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  {latestCitations.map((cit, idx) => {
                    const label = getVideoLabel(cit.video_id);
                    const creator = getVideoCreator(cit.video_id);
                    return (
                      <div key={idx} className="p-4 rounded-2xl bg-white/80 border border-orange-100 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5",
                              label === "Video A"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-amber-100 text-amber-700"
                            )}
                          >
                            <Youtube className="w-3 h-3" />
                            {label}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono tracking-tighter">
                            {cit.chunk_id.slice(-6)}
                          </span>
                        </div>
                        {creator && <div className="text-xs text-gray-500 mt-2">{creator}</div>}
                        <p className="text-xs text-gray-700 mt-3 leading-relaxed border-l-2 border-orange-200 pl-3 italic">
                          "{cit.text_preview}"
                        </p>
                        {cit.original_text_preview && (
                          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed border-l-2 border-gray-200 pl-3 italic">
                            Original: "{cit.original_text_preview}"
                          </p>
                        )}
                        <a
                          href={cit.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-semibold text-orange-600 hover:text-orange-700 transition-colors"
                        >
                          Open source <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
