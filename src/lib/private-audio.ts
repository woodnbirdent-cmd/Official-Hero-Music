import "server-only";
import { BlobNotFoundError, get, head } from "@vercel/blob";

export function privateBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export type PrivateAudioStatus = {
  ready: boolean;
  size: number | null;
  uploadedAt: string | null;
};

const EMPTY_STATUS: PrivateAudioStatus = { ready: false, size: null, uploadedAt: null };

/** Metadata only. The private URL from Blob is never returned. */
export async function privateAudioStatus(pathname: string): Promise<PrivateAudioStatus> {
  if (!privateBlobConfigured()) return EMPTY_STATUS;
  try {
    const meta = await head(pathname);
    return {
      ready: true,
      size: typeof meta.size === "number" ? meta.size : null,
      uploadedAt: meta.uploadedAt instanceof Date ? meta.uploadedAt.toISOString() : null,
    };
  } catch (error) {
    if (!(error instanceof BlobNotFoundError)) console.error("Private audio lookup failed");
    return EMPTY_STATUS;
  }
}

/**
 * Reads a private blob. Pass a Range header so seeking can return 206.
 * useCache is off so a replacement upload is heard on the next request.
 */
export async function openPrivateAudio(pathname: string, range: string | undefined) {
  return get(pathname, {
    access: "private",
    useCache: false,
    headers: range ? { range } : undefined,
  });
}
