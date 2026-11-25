"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  moveUnreleasedSong,
  removeUnreleasedSong,
  setUnreleasedHidden,
  updateUnreleasedSong,
} from "@/app/admin/unreleased/actions";
import UnreleasedUploadForm from "@/components/admin/UnreleasedUploadForm";
import { MAX_TRACK_NOTE_LENGTH, MAX_TRACK_TITLE_LENGTH } from "@/lib/unreleased-tracks";

export type AdminUnreleasedTrack = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  note: string;
  pathname: string;
  hidden: boolean;
  stored: string | null;
  original: boolean;
  first: boolean;
  last: boolean;
  enabled: boolean;
  maxBytes: number;
};

export default function UnreleasedTrackAdmin({ track }: { track: AdminUnreleasedTrack }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(track.title);
  const [note, setNote] = useState(track.note);
  const [duration, setDuration] = useState(track.duration);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  useEffect(() => {
    setTitle(track.title);
    setNote(track.note);
    setDuration(track.duration);
  }, [track.title, track.note, track.duration]);

  async function run(action: string, work: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError("");
    setPending(action);
    try {
      const result = await work();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (action === "remove") dialog.current?.close();
      router.refresh();
    } catch {
      setError("Could not update that song.");
    } finally {
      setPending("");
    }
  }

  function formData(fields: Record<string, string>) {
    const data = new FormData();
    data.set("id", track.id);
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run("save", () => updateUnreleasedSong(formData({ title, note, duration })));
  }

  async function onRemove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm.trim() !== track.title || pending) return;
    await run("remove", () => removeUnreleasedSong(formData({ confirm })));
  }

  return (
    <article className="card-surface space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight text-white">{track.title}</h2>
          <p className="mt-1 text-sm text-hero-light">
            {track.artist}
            {track.duration ? <span className="text-hero-muted"> · {track.duration}</span> : null}
            <span className="text-hero-muted"> · {track.hidden ? "Hidden" : "On Early access"}</span>
          </p>
          <p className="mt-1 text-xs text-hero-muted">{track.pathname}</p>
        </div>
        <p className="text-sm text-hero-light">{track.stored ? `Stored · ${track.stored}` : "Not uploaded"}</p>
      </div>
      {track.note ? <p className="whitespace-pre-wrap break-words text-sm text-hero-light">{track.note}</p> : null}
      <form onSubmit={onSave} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <label className="block">
            <span className="section-label mb-2 block">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={MAX_TRACK_TITLE_LENGTH}
              required
              className="input-field"
            />
          </label>
          <label className="block">
            <span className="section-label mb-2 block">Duration</span>
            <input
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              placeholder="3:00"
              inputMode="numeric"
              className="input-field"
            />
          </label>
        </div>
        <label className="block">
          <span className="section-label mb-2 block">Note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={MAX_TRACK_NOTE_LENGTH}
            className="input-field"
          />
        </label>
        <button type="submit" className="btn-ghost px-4 py-2 text-xs" disabled={pending !== ""}>
          {pending === "save" ? "Saving…" : "Save details"}
        </button>
      </form>
      <UnreleasedUploadForm
        trackId={track.id}
        pathname={track.pathname}
        title={track.title}
        stored={track.stored}
        enabled={track.enabled}
        maxBytes={track.maxBytes}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost px-4 py-2 text-xs"
          disabled={track.first || pending !== ""}
          onClick={() => void run("up", () => moveUnreleasedSong(formData({ direction: "up" })))}
        >
          {pending === "up" ? "Moving…" : "Move up"}
        </button>
        <button
          type="button"
          className="btn-ghost px-4 py-2 text-xs"
          disabled={track.last || pending !== ""}
          onClick={() => void run("down", () => moveUnreleasedSong(formData({ direction: "down" })))}
        >
          {pending === "down" ? "Moving…" : "Move down"}
        </button>
        <button
          type="button"
          className="btn-ghost px-4 py-2 text-xs"
          disabled={pending !== ""}
          onClick={() =>
            void run("hide", () => setUnreleasedHidden(formData({ hidden: track.hidden ? "false" : "true" })))
          }
        >
          {pending === "hide" ? "Saving…" : track.hidden ? "Show" : "Hide"}
        </button>
        <button
          type="button"
          className="btn-ghost px-4 py-2 text-xs"
          disabled={pending !== ""}
          onClick={() => {
            setConfirm("");
            setError("");
            dialog.current?.showModal();
          }}
        >
          Remove
        </button>
      </div>
      {error ? (
        <p className="text-sm text-hero-accent" role="alert">
          {error}
        </p>
      ) : null}
      <dialog ref={dialog} className="w-[min(100%-2rem,32rem)] border border-hero-gray bg-black p-6 text-white">
        <form onSubmit={onRemove} className="space-y-4">
          <h3 className="text-lg font-black uppercase tracking-tight">Remove {track.title}</h3>
          <p className="text-sm text-hero-light">This takes the song off Early access and deletes its audio file.</p>
          {track.original ? (
            <p className="text-sm text-hero-accent">
              Listen and Still There are on the live site today. This preview uses that same audio store, so removing
              one of them deletes the file the live site streams.
            </p>
          ) : null}
          <label className="block">
            <span className="section-label mb-2 block">Type {track.title} to confirm</span>
            <input value={confirm} onChange={(event) => setConfirm(event.target.value)} className="input-field" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={pending !== "" || confirm.trim() !== track.title}>
              {pending === "remove" ? "Removing…" : "Remove song"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </article>
  );
}
