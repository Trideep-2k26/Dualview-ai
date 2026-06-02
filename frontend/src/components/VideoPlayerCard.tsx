import ReactPlayer from "react-player";
import { ExternalLink, Instagram } from "lucide-react";

interface VideoPlayerCardProps {
  url: string;
  platform: string;
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
}

export default function VideoPlayerCard({
  url,
  platform,
  className = "",
  onPlay,
  onPause,
}: VideoPlayerCardProps) {
  // Check if react-player supports this URL format
  const isEmbeddable = ReactPlayer.canPlay(url) && !url.includes("instagram.com");

  if (!isEmbeddable) {
    const isInstagram = platform.toLowerCase().includes("instagram") || url.includes("instagram.com");
    return (
      <div 
        className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl ${className}`} 
        style={{ 
          minHeight: "320px", 
          background: "#140e0a", 
          border: "1px solid rgba(249,115,22,0.1)" 
        }}
      >
        {isInstagram ? (
          <Instagram className="w-12 h-12 text-orange-400 mb-4 opacity-75 animate-pulse" />
        ) : (
          <ExternalLink className="w-12 h-12 text-orange-400 mb-4 opacity-75" />
        )}
        <h4 className="text-gray-200 font-semibold mb-1">
          {isInstagram ? "Instagram Reel" : "Video Content"}
        </h4>
        <p className="text-gray-500 text-sm mb-6 max-w-sm">
          {isInstagram
            ? "Instagram restricts direct in-app embeds. Use the link below to watch directly on their platform."
            : "Direct in-app playback is restricted. Watch this video directly on the hosting platform."}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-white transition-all hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #f97316, #ea580c)",
            boxShadow: "0 4px 15px rgba(249,115,22,0.25)",
          }}
        >
          Open Video on {isInstagram ? "Instagram" : platform} <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div 
      className={`relative w-full overflow-hidden rounded-2xl bg-black border border-orange-500/10 ${className}`} 
      style={{ aspectRatio: "16/9" }}
    >
      <ReactPlayer
        url={url}
        width="100%"
        height="100%"
        controls
        playing={true}
        onPlay={onPlay}
        onPause={onPause}
        config={{
          youtube: {
            playerVars: { modestbranding: 1, rel: 0, autoplay: 1 },
          },
        }}
      />
    </div>
  );
}
