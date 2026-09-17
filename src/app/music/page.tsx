import type { Metadata } from "next";
import Link from "next/link";
import { SPOTIFY_ARTIST_ID } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Music",
  description: "Stream #Hero on Spotify, Apple Music, and more.",
};

export default function MusicPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="section-label mb-3">Discography</p>
      <h1 className="graffiti-heading mb-4">Music</h1>
      <p className="mb-10 max-w-2xl text-hero-light">
        Stream the latest from #Hero. Built on testimony — delivered from addiction,
        prison, and homelessness into purpose in Christ.
      </p>

      <div className="mb-12 flex flex-wrap gap-3">
        <a
          href={`https://open.spotify.com/artist/${SPOTIFY_ARTIST_ID}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
        >
          Open Spotify
        </a>
        <a
          href="https://music.apple.com/us/search?term=%23Hero%20Christopher%20James%20Killion"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
        >
          Open Apple Music
        </a>
        <Link href="/join" className="btn-ghost">
          Get drop alerts
        </Link>
      </div>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-bold uppercase tracking-wide">Spotify</h2>
        <iframe
          title="#Hero Spotify artist"
          src={`https://open.spotify.com/embed/artist/${SPOTIFY_ARTIST_ID}?utm_source=generator&theme=0`}
          width="100%"
          height="352"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="border-0"
        />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold uppercase tracking-wide">Apple Music</h2>
        <p className="mb-4 text-sm text-hero-muted">
          Embed player — search / artist link opens full catalog on Apple Music.
        </p>
        <iframe
          allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
          frameBorder={0}
          height={450}
          style={{ width: "100%", maxWidth: "660px", overflow: "hidden", background: "transparent" }}
          sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
          src="https://embed.music.apple.com/us/artist/hero/1780403510"
          title="#Hero on Apple Music"
          className="border border-hero-surface bg-black"
        />
      </section>
    </div>
  );
}
