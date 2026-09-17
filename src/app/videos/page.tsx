import type { Metadata } from "next";
import { YOUTUBE_CHANNEL_ID, YOUTUBE_VIDEOS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Videos",
  description: "Watch official #Hero videos on YouTube.",
};

export default function VideosPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="section-label mb-3">Visuals</p>
      <h1 className="graffiti-heading mb-4">Videos</h1>
      <p className="mb-8 max-w-2xl text-hero-light">
        Official videos and visuals. Subscribe on YouTube to catch every drop.
      </p>
      <a
        href={`https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary mb-12 inline-flex"
      >
        YouTube channel
      </a>

      <div className="grid gap-10 md:grid-cols-2">
        {YOUTUBE_VIDEOS.map((v) => (
          <article key={v.id}>
            <div className="aspect-video overflow-hidden border border-hero-surface">
              <iframe
                title={v.title}
                src={`https://www.youtube.com/embed/${v.id}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
            <h2 className="mt-3 text-sm font-bold uppercase tracking-wider text-hero-light">
              {v.title}
            </h2>
          </article>
        ))}
      </div>
    </div>
  );
}
