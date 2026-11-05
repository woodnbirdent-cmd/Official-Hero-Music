/**
 * Unreleased member tracks. Audio bytes live in a private Vercel Blob store.
 * Never commit MP3s. Playback goes through GET /api/stream/[trackId].
 */
export type UnreleasedTrack = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  pathname: string;
};

export const UNRELEASED_TRACKS: readonly UnreleasedTrack[] = [
  {
    id: "listen",
    title: "Listen",
    artist: "#Hero",
    duration: "3:00",
    pathname: "unreleased/listen.mp3",
  },
  {
    id: "still-there",
    title: "Still There",
    artist: "#Hero",
    duration: "1:25",
    pathname: "unreleased/still-there.mp3",
  },
];

export const UNRELEASED_CONTENT_TYPES = ["audio/mpeg", "audio/mp3"] as const;

/** High-bitrate MP3s of these lengths stay well under this cap. */
export const MAX_UNRELEASED_BYTES = 30 * 1024 * 1024;

/** Short-lived admin upload grant. The stream route never hands this URL out. */
export const UNRELEASED_UPLOAD_TTL_MS = 10 * 60 * 1000;

const STREAM_TIERS = new Set(["supporter", "vip"]);

const tracksById = new Map(UNRELEASED_TRACKS.map((track) => [track.id, track]));

export function getUnreleasedTrack(id: string): UnreleasedTrack | undefined {
  return tracksById.get(id);
}

/** Both the track id and the pathname must match the catalog. */
export function unreleasedUploadTarget(trackId: string | null | undefined, pathname: string): UnreleasedTrack | null {
  if (!trackId) return null;
  const track = tracksById.get(trackId);
  if (!track || track.pathname !== pathname) return null;
  return track;
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
