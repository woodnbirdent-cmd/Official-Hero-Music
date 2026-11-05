import { NextResponse } from "next/server";
import { openPrivateAudio, privateBlobConfigured } from "@/lib/private-audio";
import { currentMember } from "@/lib/members";
import {
  buildAudioStreamHeaders,
  getUnreleasedTrack,
  safeRangeHeader,
  streamAccessStatus,
  streamDeniedHeaders,
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

/**
 * Session and tier are checked on every request, including Range requests from the player.
 * The response proxies the private blob and never redirects to a blob URL.
 */
export async function GET(request: Request, { params }: { params: Promise<{ trackId: string }> }) {
  const member = await currentMember();
  const access = streamAccessStatus(member?.tier);
  if (access === 401) return denied(401, "Sign in required");
  if (access === 403) return denied(403, "Supporter or VIP required");

  const { trackId } = await params;
  const track = getUnreleasedTrack(trackId);
  if (!track) return denied(404, "Not found");
  if (!privateBlobConfigured()) return denied(503, "This track is not available yet");

  const range = safeRangeHeader(request.headers.get("range"));
  try {
    const result = await openPrivateAudio(track.pathname, range);
    if (!result || result.statusCode !== 200 || !result.stream) return denied(404, "Not found");

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
