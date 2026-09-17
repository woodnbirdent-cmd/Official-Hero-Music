"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll-driven transform parallax. Measures a static host and moves an inner
 * layer so layout does not feed back into the next frame. Disabled when
 * prefers-reduced-motion is set.
 */
export function ParallaxRoot({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let enabled = !motionQuery.matches;
    let ticking = false;
    let idleTimer = 0;
    let frame = 0;
    const hosts = Array.from(root.querySelectorAll<HTMLElement>("[data-parallax-host]"));

    const reset = () => {
      hosts.forEach((host) => {
        const layer = host.querySelector<HTMLElement>("[data-parallax-layer]");
        if (!layer) return;
        layer.style.transform = "none";
        layer.style.willChange = "auto";
      });
    };

    const update = () => {
      ticking = false;
      if (!enabled) return;

      const viewH = window.innerHeight;
      const intensity = window.innerWidth < 768 ? 0.45 : 1;

      hosts.forEach((host) => {
        const layer = host.querySelector<HTMLElement>("[data-parallax-layer]");
        if (!layer) return;

        const rect = host.getBoundingClientRect();
        if (rect.bottom < -120 || rect.top > viewH + 120) return;

        const speed = Number(layer.dataset.speed ?? "0") * intensity;
        const delta = (rect.top + rect.height / 2 - viewH / 2) * speed;
        layer.style.transform = `translate3d(0, ${delta.toFixed(2)}px, 0)`;
        layer.style.willChange = "transform";
      });

      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        hosts.forEach((host) => {
          const layer = host.querySelector<HTMLElement>("[data-parallax-layer]");
          if (layer) layer.style.willChange = "auto";
        });
      }, 180);
    };

    const onScroll = () => {
      if (!enabled || ticking) return;
      ticking = true;
      frame = window.requestAnimationFrame(update);
    };

    const onMotionChange = () => {
      enabled = !motionQuery.matches;
      if (!enabled) {
        window.cancelAnimationFrame(frame);
        ticking = false;
        reset();
        return;
      }
      update();
    };

    if (enabled) update();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      motionQuery.removeEventListener("change", onMotionChange);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(idleTimer);
      reset();
    };
  }, []);

  return <div ref={rootRef}>{children}</div>;
}

type LayerProps = {
  speed: number;
  className?: string;
  innerClassName?: string;
  children?: ReactNode;
};

export function ParallaxLayer({
  speed,
  className,
  innerClassName,
  children,
}: LayerProps) {
  return (
    <div data-parallax-host className={className}>
      <div data-parallax-layer data-speed={speed} className={innerClassName}>
        {children}
      </div>
    </div>
  );
}
