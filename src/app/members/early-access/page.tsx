import type { Metadata } from "next";
import Link from "next/link";
import UnreleasedTrackCard from "@/components/membership/UnreleasedTrackCard";
import { privateAudioStatus } from "@/lib/private-audio";
import { requireTier } from "@/lib/members";
import { tierAtLeast } from "@/lib/tiers";
import { listMemberUnreleasedTracks } from "@/lib/unreleased-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Early access",
  description: "Unreleased music for Supporter and VIP members.",
};

export default async function EarlyAccessPage() {
  const member = await requireTier("free", "/members/early-access");
  const canStream = tierAtLeast(member.tier, "supporter");
  const tracks = await listMemberUnreleasedTracks();
  const readyById = new Map<string, boolean>();
  if (canStream) {
    const statuses = await Promise.all(
      tracks.map(async (track) => [track.id, (await privateAudioStatus(track.pathname)).ready] as const),
    );
    for (const [id, ready] of statuses) readyById.set(id, ready);
  }

  return (
    <>
      <h1 className="graffiti-heading mb-4">Early access</h1>
      <p className="mb-8 text-hero-light">Unreleased songs for Supporter and VIP. Playback stays on this site.</p>
      {canStream ? null : (
        <div className="card-surface mb-6">
          <p className="text-hero-light">Free members can see the list. Streaming starts at Supporter.</p>
          <Link href="/join" className="btn-accent mt-4">
            Upgrade
          </Link>
        </div>
      )}
      {tracks.length === 0 ? <p className="text-hero-muted">No unreleased songs right now.</p> : null}
      <ul className="space-y-4">
        {tracks.map((track) => (
          <UnreleasedTrackCard
            key={track.id}
            track={{
              id: track.id,
              title: track.title,
              artist: track.artist,
              duration: track.duration,
              note: track.note,
            }}
            canStream={canStream}
            ready={readyById.get(track.id) === true}
          />
        ))}
      </ul>
    </>
  );
}
