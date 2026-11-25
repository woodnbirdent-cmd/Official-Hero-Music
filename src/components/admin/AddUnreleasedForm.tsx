"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createUnreleasedSong } from "@/app/admin/unreleased/actions";
import { isMp3File } from "@/components/admin/mp3-file";
import { uploadUnreleasedMp3 } from "@/components/admin/upload-unreleased";
import { MAX_TRACK_NOTE_LENGTH, MAX_TRACK_TITLE_LENGTH, formatTrackDuration, maxUnreleasedLabel } from "@/lib/unreleased-tracks";

function readDuration(file: File): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    let timer = 0;
    let settled = false;
    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(value);
    };
    timer = window.setTimeout(() => finish(""), 2000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(formatTrackDuration(audio.duration));
    audio.onerror = () => finish("");
    audio.src = url;
  });
}

export default function AddUnreleasedForm({ enabled, maxBytes }: { enabled: boolean; maxBytes: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<"create" | "upload" | null>(null);
  const [progress, setProgress] = useState(0);
  const limit = maxUnreleasedLabel();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    setError("");
    setMessage("");
    setProgress(0);
    if (!(file instanceof File) || !isMp3File(file, maxBytes)) {
      setError(`Choose an MP3 under ${limit}.`);
      return;
    }
    setPending("create");
    let createdId = "";
    try {
      data.set("duration", await readDuration(file));
      const created = await createUnreleasedSong(data);
      if (!created.ok) {
        setError(created.error);
        return;
      }
      createdId = created.id;
      setPending("upload");
      await uploadUnreleasedMp3(created.id, created.pathname, file, setProgress);
      form.reset();
      setMessage("Added. Supporter and VIP members can stream it.");
    } catch {
      setError(
        createdId
          ? "The song was added, but the MP3 did not upload. Use Replace MP3 on the song below."
          : `Could not add that song. Use an MP3 under ${limit}.`,
      );
    } finally {
      setPending(null);
      if (createdId) router.refresh();
    }
  }

  const label = pending === "upload" ? `Uploading ${progress}%` : pending === "create" ? "Adding…" : "Add song";

  return (
    <form onSubmit={onSubmit} className="card-surface space-y-4">
      <div>
        <h2 className="text-lg font-black uppercase tracking-tight text-white">Add a song</h2>
        <p className="mt-1 text-sm text-hero-muted">
          Title and an MP3. A short note is optional. It shows on Early access as soon as the file finishes uploading.
        </p>
      </div>
      <label className="block">
        <span className="section-label mb-2 block">Title</span>
        <input name="title" required maxLength={MAX_TRACK_TITLE_LENGTH} disabled={pending !== null} className="input-field" />
      </label>
      <label className="block">
        <span className="section-label mb-2 block">Note</span>
        <textarea
          name="note"
          rows={3}
          maxLength={MAX_TRACK_NOTE_LENGTH}
          disabled={pending !== null}
          placeholder="Optional"
          className="input-field"
        />
      </label>
      <label className="block" htmlFor="unreleased-new-file">
        <span className="section-label mb-2 block">MP3</span>
        <input
          id="unreleased-new-file"
          name="file"
          type="file"
          accept="audio/mpeg,.mp3"
          required
          disabled={!enabled || pending !== null}
          className="block w-full text-sm text-hero-light file:mr-4 file:border file:border-hero-gray file:bg-black file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-wider file:text-white"
        />
      </label>
      <button type="submit" className="btn-primary" disabled={!enabled || pending !== null}>
        {label}
      </button>
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
