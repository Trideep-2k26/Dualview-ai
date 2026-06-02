import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import { useToast } from "@/hooks/use-toast";
import { Youtube, Loader2, AlertCircle } from "lucide-react";
import { ingestVideos } from "@/lib/api";
import { isValidUrl } from "@/lib/utils-video";
import { cn } from "@/lib/utils";
import scanningAnimation from "@/assets/scanning.json";
import logo from "@/assets/logo.png";

type PageState = "idle" | "loading" | "error";

const loadingMessages = [
  "Reading video details",
  "Preparing video preview",
  "Preparing transcript...",
  "Building comparison",
];


export default function Dashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [videoAUrl, setVideoAUrl] = useState("");
  const [videoBUrl, setVideoBUrl] = useState("");
  const [pageState, setPageState] = useState<PageState>("idle");
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [shakeA, setShakeA] = useState(false);
  const [shakeB, setShakeB] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  // Rotate loading messages
  useEffect(() => {
    if (pageState === "loading") {
      setLoadingMsgIndex(0);
      const interval = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 1800);
      return () => clearInterval(interval);
    }
  }, [pageState]);

  const handleAnalyze = async () => {
    // Reset
    setErrorA(null);
    setErrorB(null);
    setGlobalError(null);
    let hasError = false;

    if (!videoAUrl.trim() || !isValidUrl(videoAUrl)) {
      setErrorA("Please enter a valid video URL");
      setShakeA(true);
      setTimeout(() => setShakeA(false), 400);
      hasError = true;
    }
    if (!videoBUrl.trim() || !isValidUrl(videoBUrl)) {
      setErrorB("Please enter a valid video URL");
      setShakeB(true);
      setTimeout(() => setShakeB(false), 400);
      hasError = true;
    }
    if (hasError) return;

    setPageState("loading");

    try {
      const data = await ingestVideos(videoAUrl, videoBUrl);
      // Persist to sessionStorage for Analysis page
      sessionStorage.setItem("latestAnalysis", JSON.stringify(data));
      navigate("/analysis");
    } catch (err: any) {
      setPageState("error");
      const msg =
        err?.message?.includes("fetch")
          ? "Cannot reach the backend. Make sure the server is running on port 8000."
          : err?.message || "Something went wrong. Please try again.";
      setGlobalError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#fffbf5] relative overflow-hidden font-sans">
      {/* Ambient orbs */}
      <div
        className="ambient-orb"
        style={{
          width: 500,
          height: 500,
          top: -150,
          right: -150,
          background: "radial-gradient(circle, rgba(249,115,22,0.10) 0%, transparent 70%)",
        }}
      />
      <div
        className="ambient-orb"
        style={{
          width: 400,
          height: 400,
          bottom: -100,
          left: -100,
          background: "radial-gradient(circle, rgba(251,146,60,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <header className="py-4 border-b border-orange-100 bg-white/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src={logo} alt="DualView AI" className="h-8 object-contain" />
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors font-medium"
          >
            ← Home
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-16 relative z-10 flex flex-col items-center">
        <AnimatePresence mode="wait">
          {pageState === "loading" ? (
            /* ── Immersive Full-Screen Loading View ── */
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#fffbf5] px-6 select-none"
            >
              {/* Subtle ambient gradients */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at 50% 50%, rgba(251,146,60,0.08) 0%, transparent 60%), radial-gradient(circle at 10% 10%, rgba(249,115,22,0.03) 0%, transparent 40%)",
                }}
              />

              {/* Large Lottie animation occupying major visual area */}
              <div className="relative flex items-center justify-center mb-8 w-[220px] sm:w-[320px] md:w-[420px] aspect-square">
                {/* Breathe glow background */}
                <div
                  className="absolute rounded-full animate-orb-breathe pointer-events-none"
                  style={{
                    width: "80%",
                    height: "80%",
                    background:
                      "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)",
                    filter: "blur(30px)",
                  }}
                />
                <div className="relative w-full h-full">
                  <Lottie
                    animationData={scanningAnimation}
                    loop
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
              </div>

              {/* Heading */}
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0f172a] text-center tracking-tight">
                Preparing your comparison
              </h2>

              {/* Subheading */}
              <p className="text-sm sm:text-base md:text-lg text-slate-500 text-center mt-3 max-w-[520px] leading-relaxed">
                We’re reading both videos and preparing a clean AI comparison.
              </p>

              {/* Rotating status pill */}
              <div className="mt-8 h-10 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={loadingMsgIndex}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase"
                    style={{
                      background: "rgba(249,115,22,0.06)",
                      border: "1px solid rgba(249,115,22,0.12)",
                      color: "#ea580c",
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0 animate-pulse"
                    />
                    {loadingMessages[loadingMsgIndex]}
                  </motion.span>
                </AnimatePresence>
              </div>

              {/* Thin animated progress indicator */}
              <div className="w-full max-w-[280px] sm:max-w-[320px] mt-6 px-1">
                <div
                  className="relative h-[3px] rounded-full overflow-hidden"
                  style={{ background: "rgba(249,115,22,0.08)" }}
                >
                  <div
                    className="absolute left-0 top-0 h-full rounded-full animate-progress-fill"
                    style={{
                      background:
                        "linear-gradient(90deg, #fb923c, #f97316, #ea580c)",
                      minWidth: "15%",
                    }}
                  />
                  <div
                    className="absolute top-0 left-0 h-full w-1/3 animate-shimmer"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)",
                    }}
                  />
                </div>
              </div>

              {/* Subtle bottom note */}
              <div className="mt-12">
                <span className="text-xs text-slate-400 font-medium tracking-wide">
                  This usually takes 20–40 seconds.
                </span>
              </div>
            </motion.div>
          ) : (
            /* ── Input form ── */
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-2xl"
            >
              {/* Page hero */}
              <div className="text-center mb-10">
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-600 text-xs font-semibold px-4 py-1.5 rounded-full mb-4"
                >
                  ✦ AI-Powered Comparison
                </motion.span>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-4xl font-extrabold text-gray-900 tracking-tight leading-tight"
                >
                  Compare Two Videos
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-gray-500 mt-3 text-base leading-relaxed max-w-md mx-auto"
                >
                  Paste two video URLs below and let AI compare transcripts,
                  engagement, tone, and more.
                </motion.p>
              </div>

              {/* Card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="glass-card p-8 rounded-3xl"
              >
                {/* Global error */}
                {pageState === "error" && globalError && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-4 mb-6"
                  >
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">
                        Processing failed
                      </p>
                      <p className="text-xs text-red-500 mt-0.5">{globalError}</p>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-5">
                  {/* Video A */}
                  <div>
                    <label className="block text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1.5">
                      Video A
                    </label>
                    <div className="relative">
                      <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400 w-5 h-5 z-10" />
                      <input
                        type="text"
                        value={videoAUrl}
                        onChange={(e) => {
                          setVideoAUrl(e.target.value);
                          if (errorA) setErrorA(null);
                        }}
                        placeholder="https://youtube.com/watch?v=..."
                        className={cn(
                          "w-full h-14 pl-12 pr-4 rounded-2xl bg-white border-2 border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm transition-all shadow-sm",
                          shakeA && "animate-shake",
                          errorA && "border-red-300 focus:border-red-400 focus:ring-red-100"
                        )}
                      />
                    </div>
                    {errorA && (
                      <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errorA}
                      </p>
                    )}
                  </div>

                  {/* VS divider */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs font-bold text-orange-400 bg-orange-50 border border-orange-100 px-3 py-1 rounded-full">
                      VS
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>

                  {/* Video B */}
                  <div>
                    <label className="block text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1.5">
                      Video B
                    </label>
                    <div className="relative">
                      <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400 w-5 h-5 z-10" />
                      <input
                        type="text"
                        value={videoBUrl}
                        onChange={(e) => {
                          setVideoBUrl(e.target.value);
                          if (errorB) setErrorB(null);
                        }}
                        placeholder="https://youtube.com/watch?v=..."
                        className={cn(
                          "w-full h-14 pl-12 pr-4 rounded-2xl bg-white border-2 border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none text-sm transition-all shadow-sm",
                          shakeB && "animate-shake",
                          errorB && "border-red-300 focus:border-red-400 focus:ring-red-100"
                        )}
                      />
                    </div>
                    {errorB && (
                      <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errorB}
                      </p>
                    )}
                  </div>
                </div>

                {/* Analyze button */}
                <button
                  onClick={handleAnalyze}
                  disabled={pageState === "loading"}
                  className="w-full h-14 rounded-2xl mt-8 btn-orange-glow font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {pageState === "loading" ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Analyzing…
                    </>
                  ) : (
                    "Analyze Videos →"
                  )}
                </button>

                {/* Helper text */}
                <p className="text-center text-xs text-gray-400 mt-4 leading-relaxed">
                  Supports YouTube links. Instagram support depends on
                  availability.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
