"use client";

import { uploadPresigned } from "@vercel/blob/client";

/**
 * Sends the MP3 straight to the private Blob store.
 * The signed URL only allows the pathname the catalog row already owns.
 */
export async function uploadUnreleasedMp3(
  trackId: string,
  pathname: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  await uploadPresigned(pathname, file, {
    access: "private",
    handleUploadUrl: "/api/admin/unreleased",
    clientPayload: trackId,
    contentType: "audio/mpeg",
    multipart: false,
    onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
  });
}
