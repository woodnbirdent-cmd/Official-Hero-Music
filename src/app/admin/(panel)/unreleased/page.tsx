import type { Metadata } from "next";
import AddUnreleasedForm from "@/components/admin/AddUnreleasedForm";
import BroadcastPanel from "@/components/admin/BroadcastPanel";
import UnreleasedTrackAdmin from "@/components/admin/UnreleasedTrackAdmin";
import { requireAdmin } from "@/lib/admin";
import { formatDay } from "@/lib/admin-csv";
import { getPool } from "@/lib/auth";
import { privateAudioStatus, privateBlobConfigured } from "@/lib/private-audio";
import { listAdminUnreleasedTracks } from "@/lib/unreleased-store";
import { MAX_UNRELEASED_BYTES, isOriginalUnreleasedId, maxUnreleasedLabel } from "@/lib/unreleased-tracks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: "Unreleased" };
}

function storedLabel(size: number | null, uploadedAt: string | null): string | null {
  const parts: string[] = [];
  if (typeof size === "number") {
    parts.push(size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`);
  }
  if (uploadedAt) {
    const day = formatDay(new Date(uploadedAt));
    if (day) parts.push(day);
  }
  return parts.length > 0 ? parts.join(" · ") : "Yes";
}

export default async function AdminUnreleasedPage() {
  await requireAdmin();
  const configured = privateBlobConfigured();
  const databaseReady = Boolean(getPool());
  let loadError = "";
  const tracks = databaseReady
    ? await listAdminUnreleasedTracks().catch((error: unknown) => {
        console.error("Unreleased catalog lookup failed");
        loadError = error instanceof Error ? "The song list could not be loaded." : "The song list could not be loaded.";
        return [];
      })
    : [];
  const statuses = await Promise.all(tracks.map((track) => privateAudioStatus(track.pathname)));
  const limit = maxUnreleasedLabel();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="section-heading text-3xl">Unreleased</h1>
        <p className="mt-2 text-sm text-hero-muted">
          Add a song, replace its MP3, hide it, or remove it. Supporter and VIP members see visible songs on Early
          access right away. Playback stays on this site. There is no public URL and no download button. MP3s can be up
          to {limit}.
        </p>
      </div>
      {configured ? null : (
        <div className="card-surface space-y-3 text-sm text-hero-light">
          <p>Private Blob is not connected, so uploads cannot start.</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Open the{" "}
              <a
                href="https://vercel.com/woodnbirdent-cmd/official-hero-music/stores"
                className="font-bold text-hero-accent underline"
              >
                official-hero-music Storage tab
              </a>
              .
            </li>
            <li>Select Create Storage, then choose Blob.</li>
            <li>Select Continue, then set the access to Private.</li>
            <li>Connect the store to this project for Preview and Production.</li>
          </ol>
          <p className="text-hero-muted">
            Connecting the store adds BLOB_READ_WRITE_TOKEN. On Vercel, a private store can also use BLOB_STORE_ID with
            OIDC. Then come back here and upload each MP3.
          </p>
        </div>
      )}
      {databaseReady ? null : (
        <p className="card-surface text-sm text-hero-light">Database is not configured, so songs cannot be added.</p>
      )}
      {loadError ? <p className="card-surface text-sm text-hero-accent">{loadError}</p> : null}
      {databaseReady && !loadError ? <AddUnreleasedForm enabled={configured} maxBytes={MAX_UNRELEASED_BYTES} /> : null}
      {databaseReady && !loadError && tracks.length === 0 ? (
        <p className="text-sm text-hero-muted">No songs yet.</p>
      ) : null}
      {tracks.map((track, index) => {
        const status = statuses[index];
        return (
          <UnreleasedTrackAdmin
            key={track.id}
            track={{
              id: track.id,
              title: track.title,
              artist: track.artist,
              duration: track.duration,
              note: track.note,
              pathname: track.pathname,
              hidden: track.hidden,
              stored: status?.ready ? storedLabel(status.size, status.uploadedAt) : null,
              original: isOriginalUnreleasedId(track.id),
              first: index === 0,
              last: index === tracks.length - 1,
              enabled: configured,
              maxBytes: MAX_UNRELEASED_BYTES,
            }}
          />
        );
      })}
      <BroadcastPanel heading="Notify by email" />
    </div>
  );
}
