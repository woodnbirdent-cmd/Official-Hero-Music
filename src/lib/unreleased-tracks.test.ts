import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { TIERS, tierAtLeast } from "./tiers.ts";
import {
  MAX_UNRELEASED_BYTES,
  UNRELEASED_TRACKS,
  UNRELEASED_UPLOAD_TTL_MS,
  buildAudioStreamHeaders,
  getUnreleasedTrack,
  resolveByteRange,
  safeRangeHeader,
  streamAccessStatus,
  streamDeniedHeaders,
  unreleasedUploadTarget,
} from "./unreleased-tracks.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("catalog is the two unreleased #Hero tracks and no public URL", () => {
  assert.deepEqual(
    UNRELEASED_TRACKS.map((track) => [track.id, track.title, track.artist, track.duration]),
    [
      ["listen", "Listen", "#Hero", "3:00"],
      ["still-there", "Still There", "#Hero", "1:25"],
    ],
  );
  for (const track of UNRELEASED_TRACKS) {
    assert.equal(getUnreleasedTrack(track.id), track);
    assert.match(track.pathname, /^unreleased\/[a-z0-9-]+\.mp3$/);
    assert.equal(track.pathname.includes("://"), false);
    assert.equal(track.pathname.includes("blob.vercel-storage.com"), false);
  }
  assert.equal(getUnreleasedTrack("../unreleased/listen.mp3"), undefined);
  assert.equal(MAX_UNRELEASED_BYTES, 30 * 1024 * 1024);
  assert.equal(UNRELEASED_UPLOAD_TTL_MS, 10 * 60 * 1000);
});

test("stream access matches supporter and above, and an admin session at any tier", () => {
  assert.equal(streamAccessStatus(null), 401);
  assert.equal(streamAccessStatus(undefined), 401);
  assert.equal(streamAccessStatus(""), 401);
  assert.equal(streamAccessStatus("guest"), 401);
  for (const tier of TIERS) {
    const expected = tierAtLeast(tier, "supporter") ? 200 : 403;
    assert.equal(streamAccessStatus(tier), expected, tier);
    assert.equal(streamAccessStatus(tier, { admin: false }), expected, tier);
    assert.equal(streamAccessStatus(tier, { admin: true }), 200, tier);
  }
  assert.equal(streamAccessStatus(null, { admin: true }), 200);
  assert.equal(streamAccessStatus("free", { admin: true }), 200);
});

test("upload target is the catalog pathname only", () => {
  const listen = UNRELEASED_TRACKS[0];
  assert.equal(listen && unreleasedUploadTarget("listen", listen.pathname), listen);
  assert.equal(unreleasedUploadTarget("listen", "unreleased/still-there.mp3"), null);
  assert.equal(unreleasedUploadTarget("still-there", "https://evil.example/listen.mp3"), null);
  assert.equal(unreleasedUploadTarget(null, "unreleased/listen.mp3"), null);
  assert.equal(unreleasedUploadTarget("listen", "unreleased/../secret.mp3"), null);
});

test("range headers stay a single byte range", () => {
  assert.equal(safeRangeHeader(null), undefined);
  assert.equal(safeRangeHeader("bytes=0-"), "bytes=0-");
  assert.equal(safeRangeHeader("bytes=0-1023"), "bytes=0-1023");
  assert.equal(safeRangeHeader("bytes=500-"), "bytes=500-");
  assert.equal(safeRangeHeader("bytes=-1024"), "bytes=-1024");
  assert.equal(safeRangeHeader("bytes=10-5"), undefined);
  assert.equal(safeRangeHeader("bytes=-"), undefined);
  assert.equal(safeRangeHeader("bytes=0-1, 2-3"), undefined);
  assert.equal(safeRangeHeader("bytes=0-1\r\nX-Evil: 1"), undefined);
});

test("byte ranges resolve against the file size", () => {
  assert.deepEqual(resolveByteRange("bytes=0-1", 7202119), { start: 0, end: 1 });
  assert.deepEqual(resolveByteRange("bytes=0-", 3431146), { start: 0, end: 3431145 });
  assert.deepEqual(resolveByteRange("bytes=500-600", 1000), { start: 500, end: 600 });
  assert.deepEqual(resolveByteRange("bytes=-1024", 1000), { start: 0, end: 999 });
  assert.deepEqual(resolveByteRange("bytes=-10", 1000), { start: 990, end: 999 });
  assert.equal(resolveByteRange("bytes=7202119-", 7202119), null);
  assert.equal(resolveByteRange("bytes=10-5", 1000), null);
  assert.equal(resolveByteRange("bytes=0-1", 0), null);
});

test("stream responses are private, inline, and do not leak blob URLs", () => {
  const upstream = new Headers({
    "content-length": "1200",
    "content-range": "bytes 0-1199/1200",
    "content-type": "text/html",
    "content-disposition": 'attachment; filename="listen.mp3"',
    "cache-control": "public, max-age=31536000",
    location: "https://store.private.blob.vercel-storage.com/unreleased/listen.mp3",
  });
  const partial = buildAudioStreamHeaders(upstream, true);
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("Content-Type"), "audio/mpeg");
  assert.equal(partial.headers.get("Cache-Control"), "private, no-store");
  assert.equal(partial.headers.get("Content-Disposition"), "inline");
  assert.equal(partial.headers.get("Accept-Ranges"), "bytes");
  assert.equal(partial.headers.get("Content-Length"), "1200");
  assert.equal(partial.headers.get("Content-Range"), "bytes 0-1199/1200");
  assert.equal(partial.headers.get("location"), null);
  assert.equal([...partial.headers.values()].some((value) => value.includes("blob.vercel-storage.com")), false);

  const full = buildAudioStreamHeaders(upstream, false);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("Content-Range"), null);

  const denied = streamDeniedHeaders();
  assert.equal(denied.get("Cache-Control"), "private, no-store");
});

test("a private blob bytes=0-1 read becomes 206 even when the SDK reports 200", () => {
  // get() keeps the store headers and sets statusCode 200 for a partial body.
  const upstream = new Headers({
    "content-type": "audio/mpeg",
    "content-length": "2",
    "content-range": "bytes 0-1/7202119",
    "accept-ranges": "bytes",
    "content-disposition": 'inline; filename="listen.mp3"',
  });
  const probe = buildAudioStreamHeaders(upstream, true);
  assert.equal(probe.status, 206);
  assert.equal(probe.headers.get("Content-Type"), "audio/mpeg");
  assert.equal(probe.headers.get("Content-Length"), "2");
  assert.equal(probe.headers.get("Content-Range"), "bytes 0-1/7202119");
  assert.equal(probe.headers.get("Accept-Ranges"), "bytes");
  assert.equal(probe.headers.get("Content-Disposition"), "inline");
  assert.equal(probe.headers.get("Cache-Control"), "private, no-store");
  assert.equal(probe.headers.get("Content-Disposition")?.includes("filename"), false);
});

test("playback and upload stay on private routes", () => {
  const stream = readFileSync(join(root, "src/app/api/stream/[trackId]/route.ts"), "utf8");
  const audio = readFileSync(join(root, "src/lib/private-audio.ts"), "utf8");
  const player = readFileSync(join(root, "src/components/membership/UnreleasedTrackCard.tsx"), "utf8");
  const upload = readFileSync(join(root, "src/app/api/admin/unreleased/route.ts"), "utf8");
  const form = readFileSync(join(root, "src/components/admin/UnreleasedUploadForm.tsx"), "utf8");
  const page = readFileSync(join(root, "src/app/members/early-access/page.tsx"), "utf8");
  const adminPage = readFileSync(join(root, "src/app/admin/(panel)/unreleased/page.tsx"), "utf8");
  const middleware = readFileSync(join(root, "src/middleware.ts"), "utf8");
  const membersLayout = readFileSync(join(root, "src/app/members/layout.tsx"), "utf8");
  const rootLayout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");

  const catalog = readFileSync(join(root, "src/lib/unreleased-tracks.ts"), "utf8");
  assert.match(stream, /adminGate/);
  assert.match(stream, /currentMember/);
  assert.match(stream, /streamAccessStatus/);
  assert.match(stream, /buildAudioStreamHeaders/);
  assert.match(stream, /streamDeniedHeaders/);
  assert.match(stream, /export async function HEAD/);
  assert.equal(stream.includes("statusCode !== 200"), false);
  assert.match(catalog, /private, no-store/);
  assert.equal(stream.includes("downloadUrl"), false);
  assert.equal(stream.includes("blob.vercel-storage.com"), false);
  assert.equal(stream.includes("redirect("), false);
  assert.equal(stream.includes("presignUrl"), false);
  assert.match(audio, /access: "private"/);
  assert.match(audio, /useCache: false/);
  assert.equal(audio.includes("downloadUrl"), false);

  assert.match(player, /controlsList="nodownload"/);
  assert.match(player, /Unreleased/);
  assert.match(player, /\/api\/stream\//);
  assert.equal(player.includes("download="), false);
  assert.equal(player.includes("blob.vercel-storage.com"), false);

  assert.match(page, /requireTier\("free"/);
  assert.match(page, /tierAtLeast\(member\.tier, "supporter"\)/);
  assert.match(page, /href="\/join"/);

  assert.match(upload, /guardAdminMutation/);
  assert.match(upload, /access is private|operations: \["put"\]/);
  assert.match(upload, /addRandomSuffix: false/);
  assert.match(upload, /allowOverwrite: true/);
  assert.match(form, /access: "private"/);
  assert.match(form, /controlsList="nodownload"/);
  assert.match(form, /\/api\/stream\//);
  assert.equal(form.includes("download="), false);
  assert.equal(form.includes("downloadUrl"), false);
  assert.match(adminPage, /requireAdmin/);

  assert.match(middleware, /pathname !== "\/admin" && !pathname.startsWith\("\/admin\/"\)/);
  assert.equal(middleware.includes("media-src"), false);
  assert.equal(membersLayout.includes("Content-Security-Policy"), false);
  assert.equal(membersLayout.includes("media-src"), false);
  assert.equal(rootLayout.includes("Content-Security-Policy"), false);
  assert.equal(rootLayout.includes("media-src"), false);
});
