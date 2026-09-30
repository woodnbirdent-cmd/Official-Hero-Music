"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { SITE } from "@/lib/constants";
import styles from "./BibleSequence.module.css";

/**
 * Sticky scroll-scrubbed Bible.
 * 0.00–0.10 hold: closed leather Bible, three-quarter, gilt block and ribbons
 * 0.08–0.50 cover and a leaf open onto scripture
 * 0.32–0.82 camera drops to the low, edge-on glowing spread
 * 0.82–1.00 hold, then the section releases
 *
 * The #Hero logo and tagline stay above the book. Pages are scripture only.
 * prefers-reduced-motion: CSS shows the open spread and this loop never starts.
 *
 * Page copy is King James Version (public domain), used as the printed page,
 * not as new copy about the artist.
 */

const VERSES = [
  "The LORD is my shepherd; I shall not want.",
  "He maketh me to lie down in green pastures: he leadeth me beside the still waters.",
  "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake.",
  "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.",
  "Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.",
  "Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.",
  "I will lift up mine eyes unto the hills, from whence cometh my help.",
  "My help cometh from the LORD, which made heaven and earth.",
  "He will not suffer thy foot to be moved: he that keepeth thee will not slumber.",
  "Behold, he that keepeth Israel shall neither slumber nor sleep.",
  "The LORD is thy keeper: the LORD is thy shade upon thy right hand.",
  "The sun shall not smite thee by day, nor the moon by night.",
  "The LORD shall preserve thee from all evil: he shall preserve thy soul.",
  "The LORD shall preserve thy going out and thy coming in from this time forth, and even for evermore.",
  "In the beginning was the Word, and the Word was with God, and the Word was God.",
  "The same was in the beginning with God.",
  "All things were made by him; and without him was not any thing made that was made.",
  "In him was life; and the life was the light of men.",
  "And the light shineth in darkness; and the darkness comprehended it not.",
  "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.",
] as const;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function segment(progress: number, start: number, end: number) {
  return clamp((progress - start) / (end - start));
}

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function ScripturePage({ offset }: { offset: number }) {
  const items = Array.from({ length: 22 }, (_, index) => VERSES[(offset + index) % VERSES.length]);
  return (
    <div className={styles.scripture}>
      {items.map((verse, index) => (
        <p key={`${offset}-${index}`}>
          <sup>{(index % 10) + 1}</sup>
          {verse}
        </p>
      ))}
    </div>
  );
}

export default function BibleSequence() {
  const trackRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const scene = sceneRef.current;
    if (!track || !scene) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let running = false;
    let current = 0;
    let target = 0;

    const apply = (progress: number) => {
      const open = ease(segment(progress, 0.08, 0.5));
      const leaf = ease(segment(progress, 0.16, 0.58));
      const low = ease(segment(progress, 0.34, 0.82));
      const hint = 1 - ease(segment(progress, 0.04, 0.16));
      const kicker = 1 - ease(segment(progress, 0.12, 0.34));

      scene.style.setProperty("--open", open.toFixed(4));
      scene.style.setProperty("--leaf", leaf.toFixed(4));
      scene.style.setProperty("--low", low.toFixed(4));
      scene.style.setProperty("--hint", hint.toFixed(4));
      scene.style.setProperty("--kicker", kicker.toFixed(4));
      scene.style.setProperty("--p", progress.toFixed(4));
    };

    const measure = () => {
      const sticky = track.firstElementChild;
      const topOffset =
        sticky instanceof HTMLElement
          ? Number.parseFloat(getComputedStyle(sticky).top) || 0
          : 0;
      const view = sticky instanceof HTMLElement ? sticky.offsetHeight : window.innerHeight;
      const scrollable = Math.max(track.offsetHeight - view, 1);
      const start = track.getBoundingClientRect().top - topOffset;
      target = clamp(-start / scrollable);
    };

    const tick = () => {
      frame = 0;
      current += (target - current) * 0.16;
      if (Math.abs(target - current) < 0.0006) current = target;
      apply(current);
      if (running && current !== target) {
        frame = window.requestAnimationFrame(tick);
      } else if (running) {
        running = false;
      }
    };

    const stop = () => {
      running = false;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const clearInline = () => {
      ["--open", "--leaf", "--low", "--hint", "--kicker", "--p"].forEach((name) => {
        scene.style.removeProperty(name);
      });
    };

    const onScroll = () => {
      if (motion.matches) return;
      measure();
      if (!running) {
        running = true;
        frame = window.requestAnimationFrame(tick);
      }
    };

    const onMotion = () => {
      if (motion.matches) {
        stop();
        clearInline();
        return;
      }
      onScroll();
    };

    if (!motion.matches) onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    motion.addEventListener("change", onMotion);

    return () => {
      stop();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      motion.removeEventListener("change", onMotion);
      clearInline();
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
            <div className={styles.floor} aria-hidden />
            <div className={styles.rig}>
              <div className={styles.book} aria-hidden>
                <div className={styles.backBoard} />
                <div className={styles.spine} />

                <div className={styles.pageBlock}>
                  <div className={styles.pageFace}>
                    <ScripturePage offset={7} />
                  </div>
                  <div className={styles.foreEdge} />
                  <div className={styles.headEdge} />
                  <div className={styles.tailEdge} />
                </div>

                <div className={styles.leaf}>
                  <div className={`${styles.face} ${styles.paperLines}`}>
                    <span className={`${styles.shade} ${styles.shadeLeaf}`} />
                  </div>
                  <div className={`${styles.face} ${styles.faceBack} ${styles.paper}`}>
                    <ScripturePage offset={0} />
                  </div>
                  <div className={styles.leafEdge} />
                  <div className={styles.leafHead} />
                  <div className={styles.leafTail} />
                </div>

                <div className={styles.cover}>
                  <div className={`${styles.face} ${styles.leather}`}>
                    <div className={styles.frame} />
                    <div className={styles.stamp}>
                      <span className={styles.stampRule} />
                      <p>Holy Bible</p>
                      <span className={styles.stampRule} />
                    </div>
                    <span className={styles.sheen} />
                    <span className={`${styles.shade} ${styles.shadeCover}`} />
                  </div>
                  <div className={`${styles.face} ${styles.faceBack} ${styles.leatherIn}`} />
                </div>

                <div className={styles.closedRibbons}>
                  <span className={styles.ribbonA} />
                  <span className={styles.ribbonB} />
                </div>
                <span className={styles.gutterRibbon} />
              </div>
            </div>
          </div>

          <div className={styles.vignette} aria-hidden />
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
