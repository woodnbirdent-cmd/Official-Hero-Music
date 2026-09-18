"use client";

import { useEffect, useState } from "react";
import { HERO_YOUTUBE_ID } from "@/lib/constants";

type Props = {
  videoId?: string;
};

/**
 * Muted looping YouTube cover for the home hero. Poster photo lives in the
 * parent. Skips autoplay entirely when prefers-reduced-motion is reduce.
 */
export default function HeroVideoBackground({ videoId = HERO_YOUTUBE_ID }: Props) {
  const [loadVideo, setLoadVideo] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const enable = () => {
      if (!motion.matches) setLoadVideo(true);
    };
    const disable = () => setLoadVideo(false);

    const onMotion = () => {
      if (motion.matches) disable();
      else enable();
    };

    let idleId = 0;
    let timeoutId = 0;

    if (motion.matches) {
      motion.addEventListener("change", onMotion);
      return () => motion.removeEventListener("change", onMotion);
    }

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(enable, { timeout: 1800 });
    } else {
      timeoutId = window.setTimeout(enable, 500);
    }

    motion.addEventListener("change", onMotion);

    return () => {
      motion.removeEventListener("change", onMotion);
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  if (!loadVideo) return null;

  const src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&cc_load_policy=0`;

  return (
    <div className="hero-video-bg" aria-hidden="true">
      <iframe
        src={src}
        title="Muted looping background video"
        allow="autoplay; encrypted-media"
        tabIndex={-1}
        loading="lazy"
        className="hero-video-frame"
      />
    </div>
  );
}
