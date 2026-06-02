import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import Lottie from "lottie-react";
import { 
  Github, Menu, Play, Eye, Sparkles, Database, FileText, 
  BarChart3, Layers, Quote, Link2, Scissors, Server, Search, Zap, Brain, Code2
} from "lucide-react";
import { cn } from "@/lib/utils";
import fullLogo from "@/assets/full logo.png";
import videoAnimation from "@/assets/video animation in landing page.json";
import aiFlowchart from "@/assets/ai flowchart.json";
import aiHumanAnimation from "@/assets/landing page ai+human.json";
import creatorAnimation from "@/assets/creator.json";
import insightAnimation from "@/assets/insight.json";


function FloatingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl rounded-full transition-all duration-300",
        scrolled 
          ? "bg-white/80 backdrop-blur-xl border border-orange-100 shadow-lg py-3 px-6"
          : "bg-transparent py-4 px-4"
      )}
    >
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img src={fullLogo} alt="DualView AI" className="h-8 md:h-9 object-contain" />
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <a href="#features" className="hover:text-orange-500 transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-orange-500 transition-colors">How It Works</a>
          <a href="#technology" className="hover:text-orange-500 transition-colors">Technology</a>
          <a href="#about" className="hover:text-orange-500 transition-colors">About</a>
        </div>

        <div className="flex items-center gap-4">
          <a href="https://github.com" target="_blank" rel="noreferrer" className="hidden md:flex text-gray-400 hover:text-gray-900 transition-colors">
            <Github className="w-5 h-5" />
          </a>
          <Link href="/dashboard" className="btn-orange-glow rounded-full px-5 py-2 text-sm font-semibold">
            Get Started →
          </Link>
          <button className="md:hidden text-gray-600">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>
    </motion.nav>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen pt-32 pb-28 overflow-hidden flex items-center">
      {/* Ambient background orbs — subtle, not harsh */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{ width: 700, height: 700, top: -80, right: -220, background: 'radial-gradient(circle, rgba(249,115,22,0.07) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />
      <div
        className="pointer-events-none absolute rounded-full"
        style={{ width: 400, height: 400, bottom: 0, left: -100, background: 'radial-gradient(circle, rgba(251,146,60,0.05) 0%, transparent 70%)', filter: 'blur(80px)' }}
      />

      {/* Wide container — 7xl for premium breathing room */}
      <div className="max-w-7xl mx-auto px-8 lg:px-16 relative z-10 w-full">
        <div className="flex flex-col lg:flex-row lg:items-center gap-16 lg:gap-24">

          {/* ── LEFT: Text content ── ~45% */}
          <div className="flex-1 lg:max-w-[46%] space-y-8">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            >
              <span className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200/70 text-orange-600 text-xs font-semibold px-4 py-2 rounded-full tracking-wide">
                ✦ Video Insights &amp; Analytics
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: 'easeOut' }}
              className="text-5xl md:text-6xl lg:text-[4rem] xl:text-[4.5rem] font-extrabold leading-[1.06] tracking-tight text-gray-900"
            >
              Understand your<br />
              video content.<br />
              <span className="bg-gradient-to-r from-orange-500 to-orange-500/80 bg-clip-text text-transparent">
                Side-by-side.
              </span>
            </motion.h1>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.18, ease: 'easeOut' }}
              className="text-lg text-slate-500 leading-[1.75] max-w-[38ch]"
            >
              Paste two video links. Compare their transcripts, pacing, and
              audience engagement to see what worked better.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.26, ease: 'easeOut' }}
              className="flex flex-wrap items-center gap-4 pt-2"
            >
              <Link
                href="/dashboard"
                className="btn-orange-glow rounded-full px-9 py-4 text-base font-semibold transition-all duration-300 hover:scale-[1.03] shadow-[0_8px_32px_rgba(249,115,22,0.28)]"
              >
                Get Started →
              </Link>
              <a
                href="#how-it-works"
                className="border border-gray-200 text-gray-700 bg-white/60 backdrop-blur-sm rounded-full px-9 py-4 text-base font-semibold hover:border-orange-200 transition-colors"
              >
                How It Works
              </a>
            </motion.div>

            {/* Feature Pills */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.34, ease: 'easeOut' }}
              className="flex flex-wrap gap-3 pt-1"
            >
              {['Comparison Dashboard', 'Source Citations', 'Fast Analysis', 'Content Insights'].map(label => (
                <span
                  key={label}
                  className="bg-white/90 backdrop-blur-sm border border-gray-200/80 text-gray-500 text-xs font-medium px-4 py-2 rounded-full transition-colors hover:border-orange-200 hover:text-gray-700 cursor-default"
                >
                  {label}
                </span>
              ))}
            </motion.div>
          </div>

          {/* ── RIGHT: Visual illustration ── ~55% */}
          {/* Desktop: absolute-positioned layered cards inside a fixed-height canvas */}
          {/* Mobile: simple vertical stack, centered */}
          <div className="flex-1 lg:max-w-[54%]">

            {/* Mobile stack */}
            <div className="lg:hidden flex flex-col items-center gap-5 w-full">
              {/* AI card center */}
              <motion.div
                initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, delay: 0.35 }}
                className="glass-card p-5 w-full max-w-[320px] shadow-[0_16px_40px_rgba(249,115,22,0.08)]"
              >
                <div className="text-xs font-bold text-gray-700 mb-2 text-center flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" /> AI Comparison
                </div>
                <div className="h-36 w-full flex items-center justify-center rounded-xl bg-orange-50/30 overflow-hidden">
                  <Lottie animationData={aiFlowchart} loop style={{ width: '100%', height: '100%' }} />
                </div>
              </motion.div>
              {/* Video cards side-by-side on mobile */}
              <div className="flex gap-4 w-full max-w-[320px]">
                {[{ views: '1.2M', delay: 0.2 }, { views: '845K', delay: 0.3 }].map(({ views, delay }, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay }}
                    className="glass-card p-3 flex-1 shadow-sm"
                  >
                    <div className="h-16 rounded-lg overflow-hidden flex items-center justify-center bg-white/50 border border-orange-100/50">
                      <Lottie animationData={videoAnimation} loop style={{ width: '100%', height: '100%' }} />
                    </div>
                    <div className="bg-gray-200 h-2 rounded w-3/4 mt-2" />
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400">
                      <Eye className="w-3 h-3" /> {views} views
                    </div>
                  </motion.div>
                ))}
              </div>
              {/* Bottom cards */}
              <div className="flex gap-4 w-full max-w-[320px]">
                <motion.div
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="glass-card p-4 flex-1 shadow-sm"
                >
                  <div className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                    <Quote className="w-3.5 h-3.5 text-orange-500" /> Citations
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed border-l-2 border-orange-200 pl-2">
                    Source-backed transcript insights.
                  </p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.55 }}
                  className="glass-card p-4 flex-1 shadow-sm"
                >
                  <div className="flex items-center gap-1.5 text-gray-900">
                    <Sparkles className="text-orange-500 w-3.5 h-3.5" />
                    <span className="font-bold text-xs">Insights</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">Video A wins engagement.</p>
                  <div className="mt-2 inline-flex bg-orange-50 border border-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Higher Engagement
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Desktop layout — 3-row flex, ZERO collision guaranteed */}
            <div className="hidden lg:flex flex-col gap-5 w-full">

              {/* ROW 1 — Video A ← connector → Video B, all in one flex row */}
              <div className="flex items-center gap-0">

                {/* Video A */}
                <motion.div
                  initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.28 }}
                  className="glass-card p-4 shadow-[0_12px_28px_rgba(0,0,0,0.05)] animate-float-slow flex-1 -rotate-1"
                  style={{ animationDelay: '0s' }}
                >
                  {/* Label */}
                  <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-2">Video A</div>
                  <div className="h-[80px] rounded-lg overflow-hidden bg-white/50 border border-orange-100/50 flex items-center justify-center">
                    <Lottie animationData={videoAnimation} loop style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div className="bg-gray-200 h-2 rounded-full w-3/4 mt-3" />
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400">
                    <Eye className="w-3 h-3" /> 1.2M views
                  </div>
                </motion.div>

                {/* Inline connector between cards */}
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="relative flex-shrink-0 flex items-center"
                  style={{ width: 56 }}
                >
                  {/* Line */}
                  <div
                    className="absolute inset-y-0 left-0 right-0 flex items-center"
                    style={{ top: '50%', transform: 'translateY(-50%)' }}
                  >
                    <div className="w-full h-px" style={{ background: 'linear-gradient(90deg, rgba(249,115,22,0.4), rgba(249,115,22,0.8), rgba(249,115,22,0.4))' }} />
                  </div>
                  {/* Animated dot on the line */}
                  <div
                    className="absolute w-2.5 h-2.5 bg-orange-400 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.7)]"
                    style={{ animation: 'travel-dot 2.4s linear infinite', top: '50%', transform: 'translateY(-50%)', left: 0 }}
                  />
                </motion.div>

                {/* Video B */}
                <motion.div
                  initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="glass-card p-4 shadow-[0_12px_28px_rgba(0,0,0,0.05)] animate-float-medium flex-1 rotate-1"
                  style={{ animationDelay: '0.6s' }}
                >
                  {/* Label */}
                  <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-2">Video B</div>
                  <div className="h-[80px] rounded-lg overflow-hidden bg-white/50 border border-orange-100/50 flex items-center justify-center">
                    <Lottie animationData={videoAnimation} loop style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div className="bg-gray-200 h-2 rounded-full w-3/4 mt-3" />
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400">
                    <Eye className="w-3 h-3" /> 845K views
                  </div>
                </motion.div>
              </div>

              {/* ROW 2 — AI Comparison card (centered) */}
              <div className="flex justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.35 }}
                  className="glass-card p-5 w-full max-w-[340px] shadow-[0_24px_50px_rgba(249,115,22,0.09)] animate-float-slow hover:border-orange-200 transition-colors z-10"
                >
                  <div className="text-xs font-bold text-gray-700 mb-3 text-center flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-500" /> AI Comparison
                  </div>
                  <div className="h-[152px] w-full flex items-center justify-center rounded-xl bg-gradient-to-b from-orange-50/40 to-white/20 overflow-hidden">
                    <Lottie animationData={aiFlowchart} loop style={{ width: '100%', height: '100%' }} />
                  </div>
                </motion.div>
              </div>

              {/* ROW 3 — Citations (left) + Insights (right) */}
              <div className="flex items-start justify-between gap-4">

                {/* Citations */}
                <motion.div
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.65 }}
                  className="glass-card p-4 shadow-[0_10px_24px_rgba(0,0,0,0.04)] animate-float-medium flex-1 max-w-[46%] -rotate-1"
                  style={{ animationDelay: '0.9s' }}
                >
                  <div className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                    <Quote className="w-3.5 h-3.5 text-orange-500" /> Citations
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2 leading-relaxed border-l-2 border-orange-200 pl-2.5">
                    Source-backed transcript insights.
                  </p>
                </motion.div>

                {/* Insights Summary */}
                <motion.div
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.55 }}
                  className="glass-card p-4 shadow-[0_14px_34px_rgba(249,115,22,0.05)] animate-float-slow flex-1 max-w-[50%] rotate-1"
                  style={{ animationDelay: '1.3s' }}
                >
                  <div className="flex items-center gap-2 text-gray-900">
                    <Sparkles className="text-orange-500 w-3.5 h-3.5" />
                    <span className="font-bold text-xs">Insights Summary</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">
                    Video A shows stronger engagement and clearer pacing.
                  </p>
                  <div className="mt-2.5 inline-flex items-center bg-orange-50 border border-orange-100 text-orange-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    Higher Engagement
                  </div>
                </motion.div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    { icon: Link2, title: "Compare any two videos", desc: "Paste two video links and see how they differ in reach, audience retention, and core message." },
    { icon: Eye, title: "Understand the message", desc: "Instantly analyze which video has a stronger hook, clearer tone, and better storytelling structure." },
    { icon: Sparkles, title: "Ask questions", desc: "Ask follow-up questions about the videos and get direct, verified answers backed by source timestamps." },
    { icon: BarChart3, title: "Benchmark performance", desc: "Compare views, likes, comments, and engagement rates side-by-side in a single clean layout." }
  ];

  return (
    <section id="features" className="bg-white/40 py-32 border-y border-orange-100/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-xs font-bold tracking-widest text-orange-500 uppercase">FEATURES</div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-3 tracking-tight">Built for Deep Content Understanding</h2>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 mt-20">
          {features.map((f, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="glass-card p-8 hover:border-orange-200 transition-all hover:shadow-[0_12px_40px_rgba(249,115,22,0.06)]"
            >
              <div className="bg-orange-50 flex items-center justify-center w-12 h-12 rounded-xl">
                <f.icon className="text-orange-500 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mt-5">{f.title}</h3>
              <p className="text-slate-500 mt-2.5 leading-relaxed text-sm md:text-base">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PipelineSection() {
  const steps = [
    { label: 'Paste video links', icon: Link2 },
    { label: 'Transcript alignment', icon: Eye },
    { label: 'Compare metrics & pacing', icon: BarChart3 },
    { label: 'Ask questions with sources', icon: Sparkles }
  ];

  return (
    <section id="how-it-works" className="py-32 relative overflow-hidden bg-white/20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-xs font-bold tracking-widest text-orange-500 uppercase">HOW IT WORKS</div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-3 tracking-tight">Simple steps to clear insights</h2>
        </div>

        <div className="mt-20 overflow-x-auto pb-8 -mx-6 px-6 lg:overflow-visible lg:px-0 lg:mx-0 hidden md:block">
          <div className="flex items-start min-w-max lg:min-w-0">
            {steps.map((step, i) => (
              <div key={i} className="flex-1 flex flex-col items-center relative min-w-[120px]">
                <div className="w-10 h-10 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center relative z-10 shadow-lg shadow-orange-500/20">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <step.icon className="text-orange-500 w-5 h-5 mt-4" />
                <div className="font-semibold text-gray-900 text-sm mt-3 text-center px-4 max-w-[180px] leading-snug">{step.label}</div>
                
                {i < steps.length - 1 && (
                  <div className="absolute top-5 left-[50%] w-full h-0 border-t-2 border-dashed border-orange-200 z-0">
                    <div className="absolute -top-[5px] w-2 h-2 bg-orange-400 rounded-full" style={{ animation: `travel-dot 3s linear infinite ${i * 0.4}s` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Mobile vertical timeline fallback */}
        <div className="md:hidden flex flex-col mt-12 space-y-8">
           {steps.map((step, i) => (
             <div key={i} className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center shadow-lg flex-shrink-0">
                 {String(i + 1).padStart(2, '0')}
               </div>
               <div>
                 <div className="font-semibold text-gray-900 text-sm">{step.label}</div>
               </div>
             </div>
           ))}
        </div>

        {/* ── Premium AI + Human Flow Section ── */}
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="mt-28"
        >
          {/* Section heading */}
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold tracking-[0.18em] text-orange-400 uppercase mb-3">Powered by AI</span>
            <h3 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
              Human creativity meets AI clarity
            </h3>
            <p className="text-slate-500 mt-4 text-base max-w-lg mx-auto leading-relaxed">
              Paste two videos. DualView AI turns them into clear, source-backed insights.
            </p>
          </div>

          {/* Flow layout */}
          <div className="relative flex flex-col md:flex-row items-center justify-center gap-8 md:gap-0">

            {/* ── SVG connector with particles — desktop only ── */}
            <div className="absolute inset-0 hidden md:block pointer-events-none" aria-hidden>
              <svg
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl"
                height="4"
                viewBox="0 0 800 4"
                fill="none"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <linearGradient id="connGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0" />
                    <stop offset="30%" stopColor="#f97316" stopOpacity="0.6" />
                    <stop offset="70%" stopColor="#f97316" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                  </linearGradient>
                  <filter id="particleGlow" x="-50%" y="-500%" width="200%" height="1100%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                {/* Dashed connector line */}
                <line x1="160" y1="2" x2="640" y2="2"
                  stroke="url(#connGrad)" strokeWidth="1.5" strokeDasharray="5 5"
                />
                {/* Particle 1 */}
                <circle r="4" fill="#f97316" opacity="0.85" filter="url(#particleGlow)">
                  <animateMotion dur="2.6s" repeatCount="indefinite" begin="0s">
                    <mpath href="#pPath" />
                  </animateMotion>
                </circle>
                {/* Particle 2 */}
                <circle r="3" fill="#fb923c" opacity="0.65" filter="url(#particleGlow)">
                  <animateMotion dur="2.6s" repeatCount="indefinite" begin="0.85s">
                    <mpath href="#pPath" />
                  </animateMotion>
                </circle>
                {/* Particle 3 */}
                <circle r="2.5" fill="#fed7aa" opacity="0.5">
                  <animateMotion dur="2.6s" repeatCount="indefinite" begin="1.7s">
                    <mpath href="#pPath" />
                  </animateMotion>
                </circle>
                <path id="pPath" d="M 160 2 L 640 2" fill="none" />
              </svg>
            </div>

            {/* ── CARD 1: Creator ── */}
            <motion.div
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="relative z-10 flex flex-col items-center bg-white/80 backdrop-blur-md border border-orange-100 rounded-3xl shadow-[0_8px_32px_rgba(249,115,22,0.07)] px-8 pt-6 pb-7 w-64 flex-shrink-0"
            >
              {/* Lottie */}
              <div className="w-36 h-36 flex items-center justify-center">
                <Lottie animationData={creatorAnimation} loop style={{ width: '100%', height: '100%' }} />
              </div>
              {/* Divider */}
              <div className="w-10 h-px bg-orange-100 my-4" />
              <div className="text-center">
                <div className="font-bold text-gray-900 text-base tracking-tight">Creator</div>
                <div className="text-gray-400 text-xs mt-1 leading-relaxed">Shares two video links</div>
              </div>
            </motion.div>

            {/* ── Vertical connector — mobile only ── */}
            <div className="md:hidden flex flex-col items-center gap-1 py-1">
              {[0, 0.4, 0.8].map((d, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-300 opacity-70" style={{ animationDelay: `${d}s` }} />
              ))}
            </div>

            {/* ── CARD 2: DualView AI ── */}
            <div className="relative z-20 flex flex-col items-center mx-0 md:mx-10 flex-shrink-0">
              {/* Glow ring */}
              <div className="relative">
                <div
                  className="absolute -inset-4 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%)',
                    animation: 'pulse 3s ease-in-out infinite',
                  }}
                />
                <div
                  className="absolute -inset-8 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(249,115,22,0.07) 0%, transparent 70%)',
                    animation: 'pulse 3s ease-in-out infinite 0.5s',
                  }}
                />
                {/* Card */}
                <motion.div
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative z-10 bg-white border-2 border-orange-200/60 rounded-3xl shadow-[0_16px_48px_rgba(249,115,22,0.12)] px-8 pt-6 pb-7 flex flex-col items-center w-72"
                >
                  <div className="w-40 h-40 flex items-center justify-center">
                    <Lottie animationData={aiHumanAnimation} loop style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div className="w-10 h-px bg-orange-200 my-4" />
                  <div className="text-center">
                    <div className="font-extrabold text-orange-500 text-base tracking-tight">DualView AI</div>
                    <div className="text-gray-400 text-xs mt-1 leading-relaxed">Compares content and engagement</div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* ── Vertical connector — mobile only ── */}
            <div className="md:hidden flex flex-col items-center gap-1 py-1">
              {[0, 0.4, 0.8].map((d, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-300 opacity-70" style={{ animationDelay: `${d}s` }} />
              ))}
            </div>

            {/* ── CARD 3: Insights ── */}
            <motion.div
              animate={{ y: [0, 7, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
              className="relative z-10 flex flex-col items-center bg-white/80 backdrop-blur-md border border-orange-100 rounded-3xl shadow-[0_8px_32px_rgba(249,115,22,0.07)] px-8 pt-6 pb-7 w-64 flex-shrink-0"
            >
              <div className="w-36 h-36 flex items-center justify-center">
                <Lottie animationData={insightAnimation} loop style={{ width: '100%', height: '100%' }} />
              </div>
              <div className="w-10 h-px bg-orange-100 my-4" />
              <div className="text-center">
                <div className="font-bold text-gray-900 text-base tracking-tight">Insights</div>
                <div className="text-gray-400 text-xs mt-1 leading-relaxed">Clear answers with sources</div>
              </div>
            </motion.div>

          </div>
        </motion.div>
      </div>
    </section>
  );
}

function TechnologySection() {
  return (
    <section id="technology" className="py-32 bg-gradient-to-b from-orange-50/30 to-transparent border-t border-orange-100/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">From links to video insights</h2>
          <p className="text-slate-500 mt-4 text-base md:text-lg leading-relaxed">DualView AI parses both videos, benchmarks engagement, and compares scripting and hook pacing to deliver clear, timestamped comparison answers.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Card 1 */}
          <div className="glass-card p-8 flex flex-col justify-between min-h-[220px] shadow-sm hover:border-orange-200 transition-all duration-300">
            <div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 mb-5">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Compare Performance</h3>
              <p className="text-sm text-slate-500 mt-2.5 leading-relaxed">Benchmark views, likes, and comments side-by-side to understand creator performance differences.</p>
            </div>
            <div className="text-xs text-orange-600 font-semibold mt-6">Clear metrics comparison</div>
          </div>

          {/* Card 2 */}
          <div className="glass-card p-8 flex flex-col justify-between min-h-[220px] shadow-sm hover:border-orange-200 transition-all duration-300">
            <div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 mb-5">
                <Eye className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Understand Pacing & Tone</h3>
              <p className="text-sm text-slate-500 mt-2.5 leading-relaxed">Analyze the script pacing, structure, and audience hook patterns to extract content strategy details.</p>
            </div>
            <div className="text-xs text-orange-600 font-semibold mt-6">Content strategy insights</div>
          </div>

          {/* Card 3 */}
          <div className="glass-card p-8 flex flex-col justify-between min-h-[220px] shadow-sm hover:border-orange-200 transition-all duration-300">
            <div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 mb-5">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Ask Follow-up Questions</h3>
              <p className="text-sm text-slate-500 mt-2.5 leading-relaxed">Interact conversationally with the video content and retrieve instant answers connected directly to timestamped transcript citations.</p>
            </div>
            <div className="text-xs text-orange-600 font-semibold mt-6">Source-backed chat</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  const values = [
    { icon: Scissors, title: "Content Pacing", desc: "Identify key hooks and scripting flow" },
    { icon: BarChart3, title: "Engagement Benchmarks", desc: "Compare likes, comments, and views" },
    { icon: Sparkles, title: "Interactive Chat", desc: "Ask questions about both videos" },
    { icon: Quote, title: "Verified Citations", desc: "Answers linked directly to the transcript" }
  ];

  return (
    <section id="about" className="py-32 border-t border-orange-100/50 bg-white/40">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-6 tracking-tight">Designed for Video Intelligence</h2>
        <p className="text-base md:text-lg text-slate-500 leading-relaxed max-w-2xl mx-auto">
          DualView AI is built for creators, students, marketers, and teams who want to quickly understand why one video performs better than another. By connecting audience engagement indicators with script structures, we provide a clean, side-by-side analysis experience.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-3xl mx-auto">
          {values.map((item, i) => (
            <div key={i} className="glass-card p-6 flex flex-col items-center text-center hover:border-orange-200 transition-colors shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 mb-4 flex-shrink-0">
                <item.icon className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0f0a05] pt-20 pb-12 relative">
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex flex-col gap-3 max-w-sm">
            <img src={fullLogo} alt="DualView AI" className="h-8 w-auto object-contain self-start brightness-0 invert" />
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              DualView AI helps you compare videos, understand engagement, and ask AI-powered questions with source-backed answers.
            </p>
          </div>
          <div className="flex flex-wrap gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-orange-400 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-orange-400 transition-colors">How It Works</a>
            <a href="#about" className="hover:text-orange-400 transition-colors">About</a>
            <Link href="/dashboard" className="hover:text-orange-400 transition-colors">Get Started</Link>
          </div>
        </div>
        <div className="border-t border-white/5 pt-8 mt-12 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-600">
          <div>© 2026 DualView AI. All rights reserved.</div>
          <div className="flex gap-4">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-gray-400 transition-colors">GitHub</a>
            <span>·</span>
            <span>Premium Video Insights</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#fffbf5] selection:bg-orange-200 selection:text-orange-900">
      <FloatingNavbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <PipelineSection />
        <TechnologySection />
        <AboutSection />
      </main>
      <Footer />
    </div>
  );
}
