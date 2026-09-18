"use client";

import Script from "next/script";
import { BANDSINTOWN } from "@/lib/constants";

export default function BandsintownWidget() {
  return (
    <div className="bandsintown-shell border border-hero-surface bg-black p-4 md:p-6">
      <Script
        src="https://widgetv3.bandsintown.com/main.min.js"
        strategy="lazyOnload"
        charSet="utf-8"
      />
      <a
        className="bit-widget-initializer"
        href={BANDSINTOWN.pageUrl}
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
