"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { SITE } from "@/lib/constants";
import styles from "./BibleSequence.module.css";

/**
 * Sticky scroll-scrubbed Bible.
 * 0.00–0.08 hold: closed book, logo + photo-1 centered in front
 * 0.06–0.42 cover opens while the camera eases from a 3/4 angle toward the spread
 * 0.14–0.50 a blank leaf, then the photo leaf, turn on a lag so it isn't one flip
 * 0.48–0.70 photo-2 glides onto the right page
 * 0.66–0.86 gold tagline settles on that page
 * 0.86–1.00 hold, then the section releases into the rest of the page
 *
 * prefers-reduced-motion: CSS pins the open still and this loop never starts.
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
      const open = ease(segment(progress, 0.06, 0.42));
      const blank = ease(segment(progress, 0.14, 0.46));
      const leaf = ease(segment(progress, 0.2, 0.52));
      const arrive = ease(segment(progress, 0.48, 0.7));
      const speak = ease(segment(progress, 0.66, 0.86));
      const front = 1 - ease(segment(progress, 0.18, 0.46));
      const kicker = 1 - ease(segment(progress, 0.08, 0.28));
      const hint = 1 - ease(segment(progress, 0.04, 0.16));

      scene.style.setProperty("--open", open.toFixed(4));
      scene.style.setProperty("--blank", blank.toFixed(4));
      scene.style.setProperty("--leaf", leaf.toFixed(4));
      scene.style.setProperty("--arrive", arrive.toFixed(4));
      scene.style.setProperty("--speak", speak.toFixed(4));
      scene.style.setProperty("--front", front.toFixed(4));
      scene.style.setProperty("--kicker", kicker.toFixed(4));
      scene.style.setProperty("--hint", hint.toFixed(4));
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

    const kick = () => {
      if (motion.matches) return;
      measure();
      if (!running) {
        running = true;
        frame = window.requestAnimationFrame(tick);
      }
    };

    const stop = () => {
      running = false;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const clearInline = () => {
      [
        "--open",
        "--blank",
        "--leaf",
        "--arrive",
        "--speak",
        "--front",
        "--kicker",
        "--hint",
        "--p",
      ].forEach((name) => scene.style.removeProperty(name));
    };

    const onMotion = () => {
      if (motion.matches) {
        stop();
        clearInline();
        return;
      }
      kick();
    };

    const onScroll = () => {
      if (motion.matches) return;
      measure();
      if (!running) {
        running = true;
        frame = window.requestAnimationFrame(tick);
      }
    };

    if (!motion.matches) kick();
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
    <section
      ref={trackRef}
      className={styles.track}
      aria-labelledby="bible-title"
    >
      <div className={styles.sticky}>
        <div ref={sceneRef} className={styles.scene}>
          <a className={styles.skip} href="#home-continue">
            Skip introduction
          </a>
          <div className={styles.glow} aria-hidden />
          <div className={styles.halo} aria-hidden />
          <p className={styles.kicker}>Official fan hub · Yahfamilia</p>

          <div className={styles.stage}>
            <div className={styles.floor} aria-hidden />
            <div className={styles.rig}>
              <div className={styles.book} aria-hidden>
                <div className={styles.backBoard} />
                <div className={styles.spine} />
                <div className={styles.pages}>
                  <div className={styles.pageFace}>
                    <div className={styles.rightPhoto}>
                      <Image
                        src="/photo-2.jpg"
                        alt=""
                        fill
                        sizes="240px"
                        className={styles.photo}
                      />
                    </div>
                    <div className={styles.plate}>
                      <span className={styles.rule} />
                      <p className={styles.line}>{SITE.tagline}</p>
                    </div>
                  </div>
                </div>
                <div className={styles.foreEdge} />
                <div className={styles.headEdge} />

                <div className={styles.blank}>
                  <div className={`${styles.face} ${styles.paper}`}>
                    <span className={`${styles.shade} ${styles.shadeBlank}`} />
                  </div>
                  <div className={`${styles.face} ${styles.faceBack} ${styles.paperBack}`} />
                </div>

                <div className={styles.leaf}>
                  <div className={`${styles.face} ${styles.paper}`}>
                    <span className={`${styles.shade} ${styles.shadeLeaf}`} />
                  </div>
                  <div className={`${styles.face} ${styles.faceBack} ${styles.paperBack}`}>
                    <div className={styles.leafPhoto}>
                      <Image
                        src="/photo-1.jpg"
                        alt=""
                        fill
                        sizes="240px"
                        className={styles.photo}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.cover}>
                  <div className={`${styles.face} ${styles.coverFront}`}>
                    <Image
                      src="/logo-mark.png"
                      alt=""
                      width={180}
                      height={180}
                      className={styles.mark}
                    />
                    <span className={styles.sheen} />
                    <span className={`${styles.shade} ${styles.shadeCover}`} />
                  </div>
                  <div className={`${styles.face} ${styles.faceBack} ${styles.coverIn}`}>
                    <span className={`${styles.shade} ${styles.shadeCover}`} />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.poster}>
              <Image
                src="/logo-hero.png"
                alt="#Hero"
                width={352}
                height={318}
                priority
                className={styles.logo}
              />
              <div className={styles.frontPhoto}>
                <Image
                  src="/photo-1.jpg"
                  alt="#Hero"
                  fill
                  priority
                  sizes="(max-width: 768px) 34vw, 180px"
                  className={styles.photo}
                />
              </div>
            </div>
          </div>

          <h1 id="bible-title" className="sr-only">
            {SITE.tagline}
          </h1>
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
