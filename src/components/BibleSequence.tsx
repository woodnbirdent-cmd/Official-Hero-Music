"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { SITE } from "@/lib/constants";
import type { BibleHandle } from "./bibleScene";
import styles from "./BibleSequence.module.css";

/**
 * Scroll-scrubbed leather Bible, rendered as one three.js mesh.
 * The #Hero logo and tagline stay above the book. Pages are scripture only.
 * prefers-reduced-motion: the mesh opens immediately and the section does not pin.
 */

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function segment(progress: number, start: number, end: number) {
  return clamp((progress - start) / (end - start));
}

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function BibleSequence() {
  const trackRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const scene = sceneRef.current;
    const canvas = canvasRef.current;
    if (!track || !scene || !canvas) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const api: { current: BibleHandle | null } = { current: null };
    let frame = 0;
    let running = false;
    let current = motion.matches ? 1 : 0;
    let target = current;
    let cancelled = false;

    const applyChrome = (progress: number) => {
      const hint = 1 - ease(segment(progress, 0.04, 0.18));
      const kicker = 1 - ease(segment(progress, 0.12, 0.34));
      scene.style.setProperty("--hint", hint.toFixed(4));
      scene.style.setProperty("--kicker", kicker.toFixed(4));
      scene.style.setProperty("--p", progress.toFixed(4));
    };

    const measure = () => {
      const sticky = track.firstElementChild;
      const topOffset =
        sticky instanceof HTMLElement ? Number.parseFloat(getComputedStyle(sticky).top) || 0 : 0;
      const view = sticky instanceof HTMLElement ? sticky.offsetHeight : window.innerHeight;
      const scrollable = Math.max(track.offsetHeight - view, 1);
      const start = track.getBoundingClientRect().top - topOffset;
      target = clamp(-start / scrollable);
    };

    const tick = () => {
      frame = 0;
      current += (target - current) * 0.18;
      if (Math.abs(target - current) < 0.0006) current = target;
      applyChrome(current);
      api.current?.setProgress(current);
      if (running && current !== target) {
        frame = window.requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    const stop = () => {
      running = false;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const clearInline = () => {
      ["--hint", "--kicker", "--p"].forEach((name) => scene.style.removeProperty(name));
    };

    const kick = () => {
      if (running) return;
      running = true;
      frame = window.requestAnimationFrame(tick);
    };

    const onScroll = () => {
      if (motion.matches) return;
      measure();
      kick();
    };

    const onMotion = () => {
      if (motion.matches) {
        stop();
        clearInline();
        current = 1;
        target = 1;
        api.current?.setProgress(1);
        return;
      }
      onScroll();
    };

    const boot = async () => {
      const { mountBible } = await import("./bibleScene");
      if (cancelled) return;
      const handle = mountBible(canvas, motion.matches ? 1 : 0);
      if (cancelled) {
        handle.dispose();
        return;
      }
      api.current = handle;
      if (motion.matches) {
        handle.setProgress(1);
        return;
      }
      onScroll();
    };

    void boot();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    motion.addEventListener("change", onMotion);

    return () => {
      cancelled = true;
      stop();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      motion.removeEventListener("change", onMotion);
      clearInline();
      api.current?.dispose();
      api.current = null;
    };
  }, []);

  return (
    <section ref={trackRef} className={styles.track} aria-labelledby="bible-title">
      <div className={styles.sticky}>
        <div ref={sceneRef} className={styles.scene}>
          <a className={styles.skip} href="#home-continue">
            Skip introduction
          </a>

          <p className={styles.kicker}>Official fan hub · Yahfamilia</p>
          <div className={styles.lockup}>
            <Image
              src="/logo-hero.png"
              alt="#Hero"
              width={352}
              height={318}
              priority
              className={styles.logo}
            />
            <h1 id="bible-title" className={styles.tagline}>
              {SITE.tagline}
            </h1>
          </div>

          <div className={styles.stage}>
            <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
          </div>

          <p className={styles.hint} aria-hidden>
            Scroll
            <span className={styles.hintBar} />
          </p>
          <div className={styles.meter} aria-hidden>
            <span />
          </div>
        </div>
      </div>
    </section>
  );
}
