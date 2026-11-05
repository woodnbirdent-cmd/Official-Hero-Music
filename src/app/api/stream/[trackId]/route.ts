import { NextResponse } from "next/server";
import { adminGate } from "@/lib/admin";
import { openPrivateAudio, privateAudioStatus, privateBlobConfigured } from "@/lib/private-audio";
import { currentMember } from "@/lib/members";
import {
  buildAudioStreamHeaders,
  getUnreleasedTrack,
  resolveByteRange,
  safeRangeHeader,
  streamAccessStatus,
  streamDeniedHeaders,
  type UnreleasedTrack,
} from "@/lib/unreleased-tracks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function denied(status: 401 | 403 | 404 | 416 | 502 | 503, message: string, extra?: HeadersInit) {
  const headers = streamDeniedHeaders();
  if (extra) {
    for (const [key, value] of new Headers(extra)) headers.set(key, value);
  }
  return new NextResponse(message, { status, headers });
}

function rangeNotSatisfiable(error: unknown): boolean {
  return error instanceof Error && /\b416\b/.test(error.message);
}

type StreamContext = { params: Promise<{ trackId: string }> };

/**
 * Supporter and VIP, or a signed-in ADMIN_EMAILS admin.
 * adminGate reads the allowlist from ADMIN_EMAILS on every call.
 */
async function streamPermission(): Promise<200 | 401 | 403> {
  const gate = await adminGate();
  if (gate.ok) return streamAccessStatus(gate.member.tier, { admin: true });
  const member = await currentMember();
  return streamAccessStatus(member?.tier);
}

async function authorizedTrack(
  params: Promise<{ trackId: string }>,
): Promise<{ track: UnreleasedTrack } | NextResponse> {
  const access = await streamPermission();
  if (access === 401) return denied(401, "Sign in required");
  if (access === 403) return denied(403, "Supporter or VIP required");

  const { trackId } = await params;
  const track = getUnreleasedTrack(trackId);
  if (!track) return denied(404, "Not found");
  if (!privateBlobConfigured()) return denied(503, "This track is not available yet");
  return { track };
}

/**
 * Safari asks for metadata before it plays. Answer with the same type, length,
 * and range headers as GET, and no body.
 */
export async function HEAD(request: Request, { params }: StreamContext) {
  const authorized = await authorizedTrack(params);
  if (authorized instanceof NextResponse) return authorized;

  const status = await privateAudioStatus(authorized.track.pathname);
  if (!status.ready || status.size == null) return denied(404, "Not found");

  const range = safeRangeHeader(request.headers.get("range"));
  if (!range) {
    const full = buildAudioStreamHeaders(new Headers({ "content-length": String(status.size) }), false);
    return new NextResponse(null, full);
  }

  const resolved = resolveByteRange(range, status.size);
  if (!resolved) {
    return denied(416, "Range not satisfiable", {
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes */${status.size}`,
    });
  }
  const length = resolved.end - resolved.start + 1;
  const partial = buildAudioStreamHeaders(
    new Headers({
      "content-length": String(length),
      "content-range": `bytes ${resolved.start}-${resolved.end}/${status.size}`,
    }),
    true,
  );
  return new NextResponse(null, partial);
}

/**
 * Session and tier, or the admin allowlist, are checked on every request, including Range requests.
 * The response proxies the private blob and never redirects to a blob URL.
 * @vercel/blob get() reports statusCode 200 for a partial body. The 206 comes from Content-Range.
 */
export async function GET(request: Request, { params }: StreamContext) {
  const authorized = await authorizedTrack(params);
  if (authorized instanceof NextResponse) return authorized;

  const range = safeRangeHeader(request.headers.get("range"));
  try {
    const result = await openPrivateAudio(authorized.track.pathname, range);
    // 304 and a missing object have no stream. A partial read still has one;
    // get() labels that body 200 even when the store answered 206.
    if (!result?.stream) return denied(404, "Not found");

    const { status, headers } = buildAudioStreamHeaders(result.headers, Boolean(range));
    return new NextResponse(result.stream, { status, headers });
  } catch (error) {
    if (rangeNotSatisfiable(error)) {
      return denied(416, "Range not satisfiable", { "Accept-Ranges": "bytes" });
    }
    console.error("Private audio stream failed");
    return denied(502, "This track is not available yet");
  }
}
