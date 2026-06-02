import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Instagram } from "lucide-react";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId?: string;
  platform: string;
  sourceUrl: string;
  title: string;
  playableUrl?: string;
}

export default function VideoModal({
  isOpen,
  onClose,
  videoId,
  platform,
  sourceUrl,
  title,
  playableUrl,
}: VideoModalProps) {

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const isYouTube =
    platform.toLowerCase() === "youtube" ||
    platform.toLowerCase() === "youtube shorts";
  const embedUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8"
          style={{ background: "rgba(15, 10, 5, 0.85)", backdropFilter: "blur(12px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            key="modal-content"
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 20 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-4xl rounded-3xl overflow-hidden"
            style={{
              background: "#0f0a05",
              border: "1.5px solid rgba(249,115,22,0.25)",
              boxShadow:
                "0 0 0 1px rgba(249,115,22,0.1), 0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(249,115,22,0.08)",
            }}
          >
            {/* Header bar */}
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{
                background: "rgba(255,255,255,0.04)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(249,115,22,0.15)",
                    border: "1px solid rgba(249,115,22,0.3)",
                    color: "#fb923c",
                  }}
                >
                  {platform}
                </span>
                <span className="text-sm text-gray-400 truncate max-w-xs">
                  {title}
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Close video"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video area */}
            {playableUrl && !isYouTube ? (
              <div className="relative w-full flex items-center justify-center bg-black" style={{ minHeight: "320px" }}>
                <video
                  src={playableUrl}
                  controls
                  autoPlay
                  className="w-full max-h-[70vh] bg-black"
                />
              </div>
            ) : isYouTube && embedUrl ? (
              <div
                className="relative w-full"
                style={{ paddingBottom: "56.25%" /* 16:9 */ }}
              >
                <iframe
                  src={embedUrl}
                  title={title}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              /* Non-YouTube or no video ID or no playable URL */
              <div
                className="flex flex-col items-center justify-center py-20 px-8 text-center"
                style={{ minHeight: "320px" }}
              >
                {platform.toLowerCase().includes("instagram") ? (
                  <Instagram className="w-12 h-12 text-orange-400 mb-4 opacity-70 animate-pulse" />
                ) : (
                  <ExternalLink className="w-12 h-12 text-orange-400 mb-4 opacity-70" />
                )}
                <p className="text-gray-300 font-semibold mb-1">
                  {platform.toLowerCase().includes("instagram")
                    ? "Instagram restricts embedded playback for this video."
                    : "Video playback restricted."}
                </p>
                <p className="text-gray-500 text-sm mb-6">
                  Watch this content directly on the official platform.
                </p>
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all"
                  style={{
                    background: "linear-gradient(135deg, #f97316, #ea580c)",
                    boxShadow: "0 0 20px rgba(249,115,22,0.35)",
                  }}
                >
                  Open on {platform} <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}


            {/* Footer with open-source fallback */}
            {isYouTube && embedUrl && (
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span className="text-xs text-gray-600">
                  Press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-400">ESC</kbd> to close
                </span>
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors"
                >
                  Open on YouTube <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
