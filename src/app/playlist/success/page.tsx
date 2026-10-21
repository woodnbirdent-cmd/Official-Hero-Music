import type { Metadata } from "next";
import Link from "next/link";
import { FIRE_PLAYLIST, getPlaylistOption } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Submission received",
  description: `Playlist submission checkout for ${FIRE_PLAYLIST.name}.`,
};

export default async function PlaylistSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ option?: string }>;
}) {
  const params = await searchParams;
  const option = params.option ? getPlaylistOption(params.option) : undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="section-label mb-3">Playlists</p>
      <h1 className="graffiti-heading mb-4">Submission received</h1>
      <div className="card-surface">
        <p className="mb-4 text-hero-light">
          If the payment went through, Stripe will email a receipt. The checkout included the
          artist name, email, and track link for {FIRE_PLAYLIST.name}.
        </p>
        {option?.id === "listen" && (
          <p className="mb-4 text-hero-light">
            This was the listen-and-decide option. Placement is not guaranteed.
          </p>
        )}
        {option?.id === "guaranteed" && (
          <p className="mb-4 text-hero-light">
            This was the guaranteed placement option for {FIRE_PLAYLIST.name}.
          </p>
        )}
        <Link href="/playlist" className="btn-accent">
          Back to playlist submission
        </Link>
      </div>
    </div>
  );
}
