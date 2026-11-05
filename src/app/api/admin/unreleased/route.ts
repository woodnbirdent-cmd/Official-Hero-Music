import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { NextResponse } from "next/server";
import { guardAdminMutation } from "@/lib/admin";
import { privateBlobConfigured } from "@/lib/private-audio";
import {
  MAX_UNRELEASED_BYTES,
  UNRELEASED_CONTENT_TYPES,
  UNRELEASED_UPLOAD_TTL_MS,
  unreleasedUploadTarget,
} from "@/lib/unreleased-tracks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Admin-only presigned upload into the private Blob store.
 * The browser sends the MP3 straight to Blob. This route only checks the allowlist
 * and signs a 10-minute write for one catalog pathname.
 */
export async function POST(request: Request) {
  let body: HandleUploadPresignedBody;
  try {
    body = (await request.json()) as HandleUploadPresignedBody;
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 400, headers: NO_STORE });
  }

  try {
    const json = await handleUploadPresigned({
      body,
      request,
      // Issuing a write URL does not use a callback. The SDK still requires a key up front.
      webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY || "unreleased-upload-has-no-callback",
      getSignedToken: async (pathname, clientPayload, multipart) => {
        if (multipart) throw new Error("Upload failed");
        const gate = await guardAdminMutation();
        if (!gate.ok) throw new Error("Forbidden");
        if (!privateBlobConfigured()) throw new Error("Upload failed");
        const track = unreleasedUploadTarget(clientPayload, pathname);
        if (!track) throw new Error("Upload failed");

        const validUntil = Date.now() + UNRELEASED_UPLOAD_TTL_MS;
        const token = await issueSignedToken({
          pathname: track.pathname,
          operations: ["put"],
          allowedContentTypes: [...UNRELEASED_CONTENT_TYPES],
          maximumSizeInBytes: MAX_UNRELEASED_BYTES,
          validUntil,
        });
        return {
          token,
          urlOptions: {
            allowedContentTypes: [...UNRELEASED_CONTENT_TYPES],
            maximumSizeInBytes: MAX_UNRELEASED_BYTES,
            addRandomSuffix: false,
            allowOverwrite: true,
            cacheControlMaxAge: 60,
            validUntil,
          },
        };
      },
    });
    return NextResponse.json(json, { headers: NO_STORE });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "Forbidden";
    if (!forbidden) console.error("Unreleased upload grant failed");
    return NextResponse.json(
      { error: forbidden ? "Forbidden" : "Upload failed" },
      { status: forbidden ? 403 : 400, headers: NO_STORE },
    );
  }
}
