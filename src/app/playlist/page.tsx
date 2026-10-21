import type { Metadata } from "next";
import PlaylistSubmissionForm from "@/components/PlaylistSubmissionForm";
import { FIRE_PLAYLIST } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Playlist submissions",
  description: `Your song on ${FIRE_PLAYLIST.name}. $15 and he listens and decides, with no placement guaranteed. $40 and you get placed.`,
};

export default async function PlaylistPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const params = await searchParams;
  const canceled = params.canceled === "1";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="section-label mb-3">Submit</p>
      <h1 className="graffiti-heading mb-4">Playlist submissions</h1>
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-start">
        {/* Playlist cover lands here later. Swap this frame for the image. */}
        <div
          className="flex aspect-square w-40 shrink-0 items-center justify-center border border-dashed border-hero-gray bg-hero-dark p-4 sm:w-48"
          data-playlist-cover="pending"
          role="img"
          aria-label="Playlist cover image coming later"
        >
          <p className="text-center text-[11px] font-bold uppercase leading-relaxed tracking-wider text-hero-muted">
            Cover coming soon
          </p>
        </div>
        <div>
          <p className="text-hero-light">
            Your song on <span className="text-white">{FIRE_PLAYLIST.name}</span>. $15 and he
            listens and decides if it fits. Placement is not guaranteed. $40 and the placement
            is guaranteed: your song goes on the playlist.
          </p>
          <p className="mt-3 text-sm text-hero-muted">
            Your artist name, email, and Spotify track link are collected at checkout, and
            your confirmation follows right after payment.
          </p>
        </div>
      </div>

      {FIRE_PLAYLIST.spotifyUrl ? (
        <p className="mb-8">
          <a
            href={FIRE_PLAYLIST.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold uppercase tracking-wider text-hero-accent hover:underline"
          >
            Open the playlist on Spotify
          </a>
        </p>
      ) : (
        <div className="mb-8 border border-dashed border-hero-gray p-4" role="status">
          <p className="text-xs font-bold uppercase tracking-wider text-white">Spotify playlist</p>
          <p className="mt-2 text-sm text-hero-light">
            The public Spotify link for “{FIRE_PLAYLIST.name}” is not connected yet. Still
            needed: the playlist URL, which looks like https://open.spotify.com/playlist/…
          </p>
        </div>
      )}

      {canceled && (
        <p className="mb-6 text-sm text-hero-accent" role="status">
          Checkout was canceled. No charge was made.
        </p>
      )}

      <PlaylistSubmissionForm />
    </div>
  );
}
