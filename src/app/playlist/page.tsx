import type { Metadata } from "next";
import PlaylistSubmissionForm from "@/components/PlaylistSubmissionForm";
import { FIRE_PLAYLIST } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Playlist Submission",
  description: `Submit a track for #Hero's playlist “${FIRE_PLAYLIST.name}.” $15 to be considered, or $40 for guaranteed placement.`,
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
      <p className="section-label mb-3">Playlists</p>
      <h1 className="graffiti-heading mb-4">Playlist Submission</h1>
      <p className="mb-6 text-hero-light">
        Send a track for <span className="text-white">{FIRE_PLAYLIST.name}</span>. Pick a
        listen-and-decide submission, or pay for guaranteed placement.
      </p>

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
