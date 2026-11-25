"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isMp3File } from "@/components/admin/mp3-file";
import { uploadUnreleasedMp3 } from "@/components/admin/upload-unreleased";
import { maxUnreleasedLabel } from "@/lib/unreleased-tracks";

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
  const limit = maxUnreleasedLabel();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    setError("");
    setMessage("");
    setProgress(0);
    if (!(file instanceof File) || !isMp3File(file, maxBytes)) {
      setError(`Choose an MP3 under ${limit}.`);
      return;
    }
    setPending(true);
    try {
      await uploadUnreleasedMp3(trackId, pathname, file, setProgress);
      form.reset();
      setMessage("Uploaded. Supporter and VIP members can stream it.");
      router.refresh();
    } catch {
      setError(`Upload failed. Use an MP3 under ${limit}, and confirm the private Blob store is connected.`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block" htmlFor={inputId}>
        <span className="section-label mb-2 block">{stored ? "Replace MP3" : "MP3"}</span>
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
        {pending ? `Uploading ${progress}%` : stored ? "Replace MP3" : "Upload MP3"}
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
