"use client";

import { useEffect } from "react";
import { BANDSINTOWN } from "@/lib/constants";

const WIDGET_SRC = "https://widgetv3.bandsintown.com/main.min.js";

export default function BandsintownWidget() {
  useEffect(() => {
    if (document.querySelector(`script[src="${WIDGET_SRC}"]`)) return;

    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.async = true;
    script.setAttribute("charset", "utf-8");
    document.body.appendChild(script);
  }, []);

  return (
    <div className="bandsintown-shell min-h-[160px] border border-hero-surface bg-black p-4 md:p-6">
      <a
        className="bit-widget-initializer text-sm text-hero-accent underline-offset-4 hover:underline"
        data-artist-name={BANDSINTOWN.widgetArtist}
        data-display-local-dates="false"
        data-display-past-dates="false"
        data-auto-style="false"
        data-text-color="#FFFFFF"
        data-link-color="#aa9371"
        data-background-color="rgba(0,0,0,1)"
        data-display-limit="15"
        data-display-start-time="true"
        data-link-text-color="#000000"
        data-display-lineup="false"
        data-display-play-my-city="true"
        data-separator-color="rgba(73,77,84,1)"
        data-widget-width="100%"
        data-font="Helvetica"
        data-language="en"
        data-display-logo="false"
        data-display-track-button="true"
        data-border-color="rgba(73,77,84,1)"
        data-app-id={BANDSINTOWN.appId}
      >
        View {BANDSINTOWN.artistName} tour dates on Bandsintown
      </a>
    </div>
  );
}
