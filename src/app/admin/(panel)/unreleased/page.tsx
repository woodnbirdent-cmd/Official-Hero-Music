import type { Metadata } from "next";
import UnreleasedUploadForm from "@/components/admin/UnreleasedUploadForm";
import { requireAdmin } from "@/lib/admin";
import { formatDay } from "@/lib/admin-csv";
import { privateAudioStatus, privateBlobConfigured } from "@/lib/private-audio";
import { MAX_UNRELEASED_BYTES, UNRELEASED_TRACKS } from "@/lib/unreleased-tracks";

export const dynamic = "force-dynamic";

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
  const statuses = await Promise.all(UNRELEASED_TRACKS.map((track) => privateAudioStatus(track.pathname)));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="section-heading text-3xl">Unreleased</h1>
        <p className="mt-2 text-sm text-hero-muted">
          Upload the MP3 for each track into private Blob. Files stay out of the repo. Members stream them from Early access. There is no public URL and no download button.
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
            Connecting the store adds BLOB_READ_WRITE_TOKEN. On Vercel, a private store can also use BLOB_STORE_ID with OIDC. Then come back here and upload each MP3.
          </p>
        </div>
      )}
      {UNRELEASED_TRACKS.map((track, index) => {
        const status = statuses[index];
        return (
          <UnreleasedUploadForm
            key={track.id}
            trackId={track.id}
            pathname={track.pathname}
            title={`${track.title} · ${track.duration}`}
            stored={status?.ready ? storedLabel(status.size, status.uploadedAt) : null}
            enabled={configured}
            maxBytes={MAX_UNRELEASED_BYTES}
          />
        );
      })}
    </div>
  );
}
