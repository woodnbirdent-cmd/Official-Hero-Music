"use client";

import { useState, type FormEvent } from "react";
import { PLAYLIST_OPTIONS, type PlaylistOptionId } from "@/lib/constants";
import { formatMoney } from "@/lib/merch";

export default function PlaylistSubmissionForm() {
  const [option, setOption] = useState<PlaylistOptionId>("listen");
  const [artistName, setArtistName] = useState("");
  const [email, setEmail] = useState("");
  const [trackUrl, setTrackUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const selected = PLAYLIST_OPTIONS.find((item) => item.id === option) ?? PLAYLIST_OPTIONS[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/playlist/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option,
          artistName,
          email,
          trackUrl,
        }),
      });
      const data: unknown = await response.json();
      const url =
        data && typeof data === "object" && "url" in data && typeof data.url === "string"
          ? data.url
          : "";
      const message =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Could not start checkout.";
      if (!response.ok || !url.startsWith("https://")) {
        setError(message);
        return;
      }
      window.location.assign(url);
    } catch {
      setError("Could not start checkout.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset>
        <legend className="section-label mb-3">Choose one</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PLAYLIST_OPTIONS.map((item) => {
            const active = item.id === option;
            return (
              <label
                key={item.id}
                className={`card-surface block cursor-pointer ${
                  active ? "border-hero-accent ring-1 ring-hero-accent" : ""
                }`}
              >
                <input
                  type="radio"
                  name="option"
                  value={item.id}
                  checked={active}
                  onChange={() => setOption(item.id)}
                  className="sr-only"
                />
                <p className="text-xs font-bold uppercase tracking-wider text-hero-muted">
                  {item.id === "listen" ? "Option A" : "Option B"}
                </p>
                <p className="mt-2 text-2xl font-black text-white">{formatMoney(item.priceCents)}</p>
                <p className="mt-1 font-bold uppercase tracking-wide text-hero-accent">{item.name}</p>
                <p className="mt-3 text-sm text-hero-light">{item.summary}</p>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="card-surface space-y-4">
        <div>
          <label htmlFor="playlist-artist" className="mb-2 block text-xs font-bold uppercase tracking-wider">
            Artist name
          </label>
          <input
            id="playlist-artist"
            name="artistName"
            required
            maxLength={80}
            value={artistName}
            onChange={(event) => setArtistName(event.target.value)}
            className="input-field"
            autoComplete="name"
          />
        </div>
        <div>
          <label htmlFor="playlist-email" className="mb-2 block text-xs font-bold uppercase tracking-wider">
            Email
          </label>
          <input
            id="playlist-email"
            name="email"
            type="email"
            required
            maxLength={200}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input-field"
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="playlist-track" className="mb-2 block text-xs font-bold uppercase tracking-wider">
            Track link
          </label>
          <input
            id="playlist-track"
            name="trackUrl"
            type="url"
            required
            inputMode="url"
            placeholder="https://"
            maxLength={500}
            value={trackUrl}
            onChange={(event) => setTrackUrl(event.target.value)}
            className="input-field"
          />
        </div>
        {error && (
          <p className="text-sm text-hero-accent" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
          {pending ? "Starting checkout…" : `Continue to checkout · ${formatMoney(selected.priceCents)}`}
        </button>
      </div>
    </form>
  );
}
