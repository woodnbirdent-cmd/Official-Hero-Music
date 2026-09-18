"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { STREAMING } from "@/lib/constants";

export default function ListenBar() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };

    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="fixed bottom-4 right-4 z-40 flex flex-col items-end sm:bottom-6 sm:right-6"
    >
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Listen to #Hero"
          className="mb-3 w-[min(20rem,calc(100vw-2rem))] border border-hero-surface bg-black/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.65)] backdrop-blur"
        >
          <p className="section-label mb-3">Streaming</p>
          <ul className="space-y-2">
            {STREAMING.map((platform) => (
              <li key={platform.name}>
                <a
                  href={platform.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border border-hero-surface px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:border-hero-accent hover:text-hero-accent"
                >
                  {platform.name}
                </a>
              </li>
            ))}
            <li>
              <Link
                href="/music#players"
                className="btn-accent w-full"
                onClick={() => setOpen(false)}
              >
                On-site players
              </Link>
            </li>
          </ul>
        </div>
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        className="inline-flex items-center justify-center border-2 border-hero-accent bg-hero-accent px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-black shadow-[0_8px_30px_rgba(170,147,113,0.35)] transition hover:bg-transparent hover:text-hero-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-hero-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close" : "Listen"}
      </button>
    </div>
  );
}
