import { ADMIN_SESSION_SECONDS } from "@/lib/admin-security";

const VERSION = "v1";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

async function hmac(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return new Uint8Array(signed);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index]! ^ right[index]!;
  return mismatch === 0;
}

/** Binds a completed authenticator check to one session. The cookie value does not contain the TOTP secret. */
export async function sealAdminMfa(sessionId: string, secret: string, now = Date.now()): Promise<string> {
  if (!sessionId || !secret) throw new Error("Missing session.");
  const exp = now + ADMIN_SESSION_SECONDS * 1000;
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ v: VERSION, sid: sessionId, exp })));
  const mac = bytesToBase64Url(await hmac(secret, payload));
  return `${payload}.${mac}`;
}

export async function openAdminMfa(token: string, secret: string, now = Date.now()): Promise<string | null> {
  const [payload, mac] = token.split(".");
  if (!payload || !mac || token.split(".").length !== 2 || !secret) return null;
  const expected = await hmac(secret, payload);
  const actual = base64UrlToBytes(mac);
  if (!actual || !sameBytes(expected, actual)) return null;
  const decoded = base64UrlToBytes(payload);
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decoded)) as { v?: string; sid?: string; exp?: number };
    if (parsed.v !== VERSION || typeof parsed.sid !== "string" || !parsed.sid) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
    return parsed.sid;
  } catch {
    return null;
  }
}
