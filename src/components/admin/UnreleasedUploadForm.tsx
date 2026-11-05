"use client";

import { uploadPresigned } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

function isMp3(file: File, maxBytes: number): boolean {
  if (!file.name.toLowerCase().endsWith(".mp3")) return false;
  if (file.type && file.type !== "audio/mpeg" && file.type !== "audio/mp3") return false;
  if (file.size <= 0 || file.size > maxBytes) return false;
  return true;
}

export default function UnreleasedUploadForm({
  trackId,
  pathname,
  title,
  stored,
  enabled,
  maxBytes,
}: {
  trackId: string;
  pathname: string;
  title: string;
  stored: string | null;
  enabled: boolean;
  maxBytes: number;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputId = `unreleased-${trackId}`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    setError("");
    setMessage("");
    setProgress(0);
    if (!(file instanceof File) || !isMp3(file, maxBytes)) {
      setError("Choose an MP3 under 30 MB.");
      return;
    }
    setPending(true);
    try {
      await uploadPresigned(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/admin/unreleased",
        clientPayload: trackId,
        contentType: "audio/mpeg",
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      form.reset();
      setMessage("Uploaded. Supporter and VIP members can stream it.");
      router.refresh();
    } catch {
      setError("Upload failed. Use an MP3 under 30 MB, and confirm the private Blob store is connected.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card-surface space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight text-white">{title}</h2>
          <p className="mt-1 text-xs text-hero-muted">{pathname}</p>
        </div>
        <p className="text-sm text-hero-light">{stored ? `Stored · ${stored}` : "Not uploaded"}</p>
      </div>
      <label className="block" htmlFor={inputId}>
        <span className="section-label mb-2 block">MP3</span>
        <input
          id={inputId}
          name="file"
          type="file"
          accept="audio/mpeg,.mp3"
          required
          disabled={!enabled || pending}
          className="block w-full text-sm text-hero-light file:mr-4 file:border file:border-hero-gray file:bg-black file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-wider file:text-white"
        />
      </label>
      <button type="submit" className="btn-primary" disabled={!enabled || pending}>
        {pending ? `Uploading ${progress}%` : "Upload MP3"}
      </button>
      {stored ? (
        <div className="space-y-2">
          <p className="text-sm text-hero-muted">Preview. Playback stays on this site.</p>
          <audio
            controls
            controlsList="nodownload"
            preload="none"
            src={`/api/stream/${trackId}`}
            aria-label={`Preview ${title}`}
            className="h-10 w-full accent-hero-accent"
          >
            Your browser cannot play this audio.
          </audio>
        </div>
      ) : null}
      {message ? (
        <p className="text-sm text-hero-accent" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-hero-accent" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
