import type { Metadata } from "next";
import Image from "next/image";
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
        <div className="relative w-fit shrink-0">
          <a
            href={FIRE_PLAYLIST.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Image
              src={FIRE_PLAYLIST.cover}
              alt={`${FIRE_PLAYLIST.name} playlist cover`}
              width={FIRE_PLAYLIST.coverWidth}
              height={FIRE_PLAYLIST.coverHeight}
              className="h-auto w-40 border border-hero-gray sm:w-48"
              sizes="192px"
              priority
            />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a
            href={FIRE_PLAYLIST.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${FIRE_PLAYLIST.name} on Spotify`}
            className="absolute bottom-2 right-2 block rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
              <circle cx="12" cy="12" r="12" fill="#191414" />
              <path
                fill="#1DB954"
                fillRule="evenodd"
                d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
              />
            </svg>
          </a>
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
