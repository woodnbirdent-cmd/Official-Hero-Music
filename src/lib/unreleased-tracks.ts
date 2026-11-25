/**
 * Unreleased member tracks. The live list is the unreleased_tracks table.
 * This array is only the one-time seed (Listen, Still There) and the fallback
 * when the database cannot be read. Audio bytes live in a private Vercel Blob
 * store. Never commit MP3s. Playback goes through GET /api/stream/[trackId].
 */
export type UnreleasedTrack = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  note: string;
  pathname: string;
};

export const UNRELEASED_TRACKS: readonly UnreleasedTrack[] = [
  {
    id: "listen",
    title: "Listen",
    artist: "#Hero",
    duration: "3:00",
    note: "",
    pathname: "unreleased/listen.mp3",
  },
  {
    id: "still-there",
    title: "Still There",
    artist: "#Hero",
    duration: "1:25",
    note: "",
    pathname: "unreleased/still-there.mp3",
  },
];

export const UNRELEASED_CONTENT_TYPES = ["audio/mpeg", "audio/mp3"] as const;

/** A long high-bitrate MP3 still fits. Single presigned PUT, not multipart. */
export const MAX_UNRELEASED_BYTES = 80 * 1024 * 1024;

export const MAX_TRACK_TITLE_LENGTH = 80;

export const MAX_TRACK_NOTE_LENGTH = 240;

export const MAX_TRACK_ID_LENGTH = 48;

export const MAX_UNRELEASED_TRACKS = 100;

/** Short-lived admin upload grant. The stream route never hands this URL out. */
export const UNRELEASED_UPLOAD_TTL_MS = 10 * 60 * 1000;

const STREAM_TIERS = new Set(["supporter", "vip"]);

const TRACK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DURATION = /^(?:\d{1,3}:[0-5]\d|[0-9]:[0-5]\d:[0-5]\d)$/;

const tracksById = new Map(UNRELEASED_TRACKS.map((track) => [track.id, track]));

export function getUnreleasedTrack(id: string): UnreleasedTrack | undefined {
  return tracksById.get(id);
}

export function isOriginalUnreleasedId(id: string): boolean {
  return tracksById.has(id);
}

/** Stable private pathname. Rejects traversal, suffixes, and mixed case. */
export function unreleasedPathname(id: string): string | null {
  if (!TRACK_ID.test(id) || id.length > MAX_TRACK_ID_LENGTH) return null;
  return `unreleased/${id}.mp3`;
}

export function isUnreleasedPathname(pathname: string): boolean {
  const match = /^unreleased\/([a-z0-9]+(?:-[a-z0-9]+)*)\.mp3$/.exec(pathname);
  if (!match?.[1]) return false;
  return unreleasedPathname(match[1]) === pathname;
}

/**
 * The signed upload may only target unreleased/{id}.mp3 for that same id.
 * The route still requires a matching database row before it signs.
 */
export function unreleasedUploadTarget(
  trackId: string | null | undefined,
  pathname: string,
): { id: string; pathname: string } | null {
  if (!trackId) return null;
  const expected = unreleasedPathname(trackId);
  if (!expected || expected !== pathname) return null;
  return { id: trackId, pathname: expected };
}

export function slugTrackTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
  return slug || "track";
}

/** suffix is 6 hex chars from the server. Callers cannot choose the id. */
export function buildTrackId(title: string, suffix: string): string | null {
  if (!/^[a-f0-9]{6}$/.test(suffix)) return null;
  const id = `${slugTrackTitle(title)}-${suffix}`;
  return unreleasedPathname(id) ? id : null;
}

export function cleanTrackTitle(value: string): string | null {
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  const title = value.replace(/\s+/g, " ").trim();
  if (!title || title.length > MAX_TRACK_TITLE_LENGTH) return null;
  return title;
}

/** Empty is allowed. Newlines stay; other control characters do not. */
export function cleanTrackNote(value: string): string | null {
  const note = value.replace(/\r\n/g, "\n").trim();
  if (note.length > MAX_TRACK_NOTE_LENGTH) return null;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note)) return null;
  return note;
}

export function cleanTrackDuration(value: string): string | null {
  const duration = value.trim();
  if (!duration) return "";
  if (!DURATION.test(duration)) return null;
  return duration;
}

/** m:ss, or h:mm:ss past an hour. Empty when the browser cannot read it. */
export function formatTrackDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3 * 60 * 60) return "";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remain = total % 60;
  const ss = String(remain).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

export function maxUnreleasedLabel(): string {
  return `${Math.round(MAX_UNRELEASED_BYTES / (1024 * 1024))} MB`;
}

/**
 * Signed-out and unknown tiers are 401. Free is 403. Supporter and VIP are 200.
 * A fresh ADMIN_EMAILS session is 200 at any tier. The route re-checks that
 * allowlist on every request before passing admin: true.
 * Kept in lockstep with tierAtLeast(..., "supporter") by unreleased-tracks.test.ts.
 */
export function streamAccessStatus(
  tier: string | null | undefined,
  options?: { admin?: boolean },
): 401 | 403 | 200 {
  if (options?.admin) return 200;
  if (!tier) return 401;
  if (tier === "free") return 403;
  if (STREAM_TIERS.has(tier)) return 200;
  return 401;
}

const BYTE_RANGE = /^bytes=(\d*)-(\d*)$/;

export type ResolvedByteRange = { start: number; end: number };

/**
 * Map one safe range onto a known file size.
 * Returns null when the range starts past the end or the file is empty.
 */
export function resolveByteRange(range: string, size: number): ResolvedByteRange | null {
  const match = BYTE_RANGE.exec(range);
  if (!match || !Number.isSafeInteger(size) || size <= 0) return null;
  const startRaw = match[1] ?? "";
  const endRaw = match[2] ?? "";
  if (!startRaw && !endRaw) return null;

  if (!startRaw) {
    const suffix = Number(endRaw);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    const take = Math.min(suffix, size);
    return { start: size - take, end: size - 1 };
  }

  const start = Number(startRaw);
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) return null;
  const end = endRaw ? Number(endRaw) : size - 1;
  if (!Number.isSafeInteger(end) || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

/** A single byte range, or undefined when the header is missing or unsafe. */
export function safeRangeHeader(value: string | null): string | undefined {
  if (!value || value.length > 40) return undefined;
  const match = BYTE_RANGE.exec(value.trim());
  if (!match) return undefined;
  const start = match[1] ?? "";
  const end = match[2] ?? "";
  if (!start && !end) return undefined;
  if (start && end && BigInt(start) > BigInt(end)) return undefined;
  return `bytes=${start}-${end}`;
}

export function streamDeniedHeaders(): Headers {
  const headers = new Headers();
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", "text/plain; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return headers;
}

const CONTENT_RANGE = /^bytes \d+-\d+\/(\d+|\*)$/;

/**
 * Headers for a proxied private MP3. Copies length and range only.
 * Never forwards a blob URL, download disposition, or public cache policy.
 */
export function buildAudioStreamHeaders(
  upstream: { get(name: string): string | null },
  requestedRange: boolean,
): { status: 200 | 206; headers: Headers } {
  const headers = new Headers();
  headers.set("Content-Type", "audio/mpeg");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Disposition", "inline");
  headers.set("Accept-Ranges", "bytes");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Robots-Tag", "noindex, nofollow");

  const length = upstream.get("content-length");
  if (length && /^\d+$/.test(length)) headers.set("Content-Length", length);

  const contentRange = upstream.get("content-range");
  const partial = Boolean(requestedRange && contentRange && CONTENT_RANGE.test(contentRange));
  if (partial && contentRange) headers.set("Content-Range", contentRange);

  return { status: partial ? 206 : 200, headers };
}
