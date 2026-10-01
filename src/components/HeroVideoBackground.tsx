"use client";

import { useEffect, useRef, useState } from "react";
import { HERO_YOUTUBE_ID } from "@/lib/constants";

type Props = {
  videoId?: string;
};

/**
 * "YAHFAMILIA RECORDS PRESENTS" first appears at 4 seconds in Set Apart.
 * YouTube's loop=1 parameter restarts at 0:00 and drops `start`, so the
 * player seeks back here itself instead of using that parameter.
 */
const LOOP_FROM_SECONDS = 4;

type YouTubePlayer = {
  mute: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getIframe: () => HTMLIFrameElement;
  destroy: () => void;
};

type YouTubePlayerEvent = {
  data: number;
  target: YouTubePlayer;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          host?: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YouTubePlayer }) => void;
            onStateChange?: (event: YouTubePlayerEvent) => void;
          };
        },
      ) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApi: Promise<void> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (!youtubeApi) {
    youtubeApi = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    });
  }
  return youtubeApi;
}

/**
 * Muted looping YouTube cover for the home hero. Poster photo lives in the
 * parent. Skips autoplay entirely when prefers-reduced-motion is reduce.
 */
export default function HeroVideoBackground({ videoId = HERO_YOUTUBE_ID }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!loadVideo) return;
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let timer = 0;
    let player: YouTubePlayer | null = null;
    let sawPastStart = false;
    let seeking = false;

    const restartAtTitle = () => {
      if (!player || seeking) return;
      let time = 0;
      let duration = 0;
      let state = -1;
      try {
        time = player.getCurrentTime() || 0;
        duration = player.getDuration() || 0;
        state = player.getPlayerState();
      } catch {
        return;
      }

      if (time >= LOOP_FROM_SECONDS) sawPastStart = true;

      const ended = state === 0;
      const rewound = sawPastStart && time < LOOP_FROM_SECONDS - 0.25;
      const ending = duration > LOOP_FROM_SECONDS + 1 && time >= duration - 0.3;
      if (!ended && !rewound && !ending) return;

      seeking = true;
      player.seekTo(LOOP_FROM_SECONDS, true);
      player.mute();
      player.playVideo();
      window.setTimeout(() => {
        seeking = false;
      }, 500);
    };

    void loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT?.Player) return;
      player = new window.YT.Player(hostRef.current, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          start: LOOP_FROM_SECONDS,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          cc_load_policy: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            const next = event.target;
            next.mute();
            next.seekTo(LOOP_FROM_SECONDS, true);
            next.playVideo();
            const iframe = next.getIframe();
            iframe.classList.add("hero-video-frame");
            iframe.title = "Muted looping background video";
            iframe.tabIndex = -1;
            timer = window.setInterval(restartAtTitle, 250);
          },
          onStateChange: (event) => {
            if (event.data === 0) restartAtTitle();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      try {
        player?.destroy();
      } catch {
        /* player may already be gone */
      }
    };
  }, [loadVideo, videoId]);

  if (!loadVideo) return null;

  return (
    <div className="hero-video-bg" aria-hidden="true">
      <div ref={hostRef} />
    </div>
  );
}
