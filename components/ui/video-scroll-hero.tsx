"use client";

import { motion, useReducedMotion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

interface VideoScrollHeroProps {
  videoSrc?: string;
  enableAnimations?: boolean;
  className?: string;
  startScale?: number;
}

export function VideoScrollHero({
  videoSrc = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  enableAnimations = true,
  className = "",
  startScale = 0.55,
}: VideoScrollHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const [scrollScale, setScrollScale] = useState(startScale);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Fullscreen video modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Track scroll position to scale video
  useEffect(() => {
    if (!enableAnimations || shouldReduceMotion) return;

    const handleScroll = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerHeight = containerRef.current.offsetHeight;
      const windowHeight = window.innerHeight;

      // Calculate scroll progress based on container position
      const scrolled = Math.max(0, -rect.top);
      const maxScroll = Math.max(1, containerHeight - windowHeight);
      const progress = Math.min(scrolled / maxScroll, 1);

      // Scale from startScale to 1
      const newScale = startScale + progress * (1 - startScale);
      setScrollScale(newScale);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => window.removeEventListener("scroll", handleScroll);
  }, [enableAnimations, shouldReduceMotion, startScale]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  // Mouse move over video card for cursor tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setIsPlaying(true);
  };

  const handleCloseModal = () => {
    if (modalVideoRef.current) {
      modalVideoRef.current.pause();
    }
    setIsModalOpen(false);
  };

  const togglePlay = () => {
    if (!modalVideoRef.current) return;
    if (modalVideoRef.current.paused) {
      modalVideoRef.current.play();
      setIsPlaying(true);
    } else {
      modalVideoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!modalVideoRef.current) return;
    modalVideoRef.current.muted = !modalVideoRef.current.muted;
    setIsMuted(modalVideoRef.current.muted);
  };

  const handleTimeUpdate = () => {
    if (!modalVideoRef.current) return;
    setCurrentTime(modalVideoRef.current.currentTime);
    if (!duration && modalVideoRef.current.duration) {
      setDuration(modalVideoRef.current.duration);
    }
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!modalVideoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    modalVideoRef.current.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const toggleNativeFullscreen = () => {
    if (!modalVideoRef.current) return;
    const v = modalVideoRef.current as any;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (v.requestFullscreen) {
      v.requestFullscreen().catch(() => {});
    } else if (v.webkitRequestFullscreen) {
      v.webkitRequestFullscreen();
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const shouldAnimate = enableAnimations && !shouldReduceMotion;

  return (
    <div className={`relative ${className}`}>
      {/* Hero Section with Video */}
      <div ref={containerRef} className="relative h-[200vh] bg-background">
        {/* Fixed Video Container */}
        <div className="sticky top-0 z-10 flex h-screen w-full items-center justify-center">
          <div
            ref={cardRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseMove={handleMouseMove}
            onClick={handleOpenModal}
            className="group relative flex cursor-pointer items-center justify-center will-change-transform overflow-hidden rounded-2xl"
            style={{
              transform: shouldAnimate ? `scale(${scrollScale})` : "scale(1)",
              transformOrigin: "center center",
            }}
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              className="h-[60vh] w-[80vw] max-w-4xl rounded-2xl object-cover shadow-2xl transition-transform duration-300 group-hover:scale-[1.01]"
            >
              <source src={videoSrc} type="video/mp4" />
              Your browser does not support the video tag.
            </video>

            {/* Mouse Tracking Hover Button: "▶ Play intro" (Minimalist rectangular badge) */}
            <motion.div
              className="pointer-events-none absolute z-20 flex items-center gap-2 rounded-md border border-white/20 bg-white px-4 py-2 shadow-2xl transition-all"
              style={{
                left: `${mousePos.x || 180}px`,
                top: `${mousePos.y || 120}px`,
                transform: "translate(-50%, -50%)",
              }}
              initial={false}
              animate={{
                opacity: isHovered ? 1 : 0,
                scale: isHovered ? 1 : 0.75,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <svg
                className="h-3.5 w-3.5 fill-black"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-sm font-semibold tracking-tight text-black select-none">
                Play intro
              </span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Fullscreen Video Modal with Player Menus */}
      {isModalOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Full screen video player"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 md:p-8 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCloseModal}
        >
          <div
            className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-neutral-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              aria-label="Close dialog"
              onClick={handleCloseModal}
              className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Video Player Display */}
            <div className="relative aspect-video w-full bg-black">
              <video
                ref={modalVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={togglePlay}
              >
                <source src={videoSrc} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Player Menus, Tracker & Controls */}
            <div className="flex flex-col gap-3 border-t border-white/10 bg-neutral-900/95 p-4">
              {/* Seekable Progress Bar / Tracker */}
              <div
                role="progressbar"
                aria-label="Seek video progress"
                aria-valuenow={duration > 0 ? (currentTime / duration) * 100 : 0}
                className="group relative h-2 w-full cursor-pointer rounded-full bg-white/20 transition-all hover:h-2.5"
                onClick={handleScrub}
              >
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              {/* Controls Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Play/Pause Button */}
                  <button
                    type="button"
                    aria-label={isPlaying ? "Pause video" : "Play video"}
                    onClick={togglePlay}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {isPlaying ? (
                      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  {/* Volume/Mute Button */}
                  <button
                    type="button"
                    aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                    onClick={toggleMute}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {isMuted ? (
                      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                    )}
                  </button>

                  {/* Time Indicator */}
                  <span className="font-mono text-xs tabular-nums text-neutral-300">
                    {formatTime(currentTime)}&nbsp;/&nbsp;{formatTime(duration)}
                  </span>
                </div>

                {/* Fullscreen Toggle */}
                <button
                  type="button"
                  aria-label="Toggle fullscreen mode"
                  onClick={toggleNativeFullscreen}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
