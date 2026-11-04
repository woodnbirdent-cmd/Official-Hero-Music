"use server";

import { headers } from "next/headers";
import QRCode from "qrcode";
import { assertSameOrigin, setAdminMfaCookie } from "@/lib/admin";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { auth } from "@/lib/auth";

const CODE_ERROR = "That code was not accepted.";

export type Enrollment = { ok: true; qr: string; backupCodes: string[] } | { ok: false; error: string };

async function freshAdminSession(): Promise<{ id: string; email: string } | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true, disableRefresh: true },
  });
  if (!session?.session?.id || !isAdminEmail(session.user.email)) return null;
  return { id: session.session.id, email: session.user.email };
}

export async function beginAdminTotp(password?: string): Promise<Enrollment> {
  if (!(await assertSameOrigin())) return { ok: false, error: CODE_ERROR };
  if (!(await freshAdminSession())) return { ok: false, error: CODE_ERROR };
  try {
    const started = await auth.api.enableTwoFactor({
      body: password ? { method: "totp", password } : { method: "totp" },
      headers: await headers(),
    });
    if (started.method !== "totp" || !started.totpURI || !started.backupCodes?.length) {
      return { ok: false, error: CODE_ERROR };
    }
    const qr = await QRCode.toDataURL(started.totpURI, { margin: 1, width: 220, errorCorrectionLevel: "M" });
    return { ok: true, qr, backupCodes: started.backupCodes };
  } catch {
    console.error("Admin authenticator setup failed");
    return { ok: false, error: "Could not start authenticator setup." };
  }
}

async function finishChallenge(code: string, method: "totp" | "backup"): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await assertSameOrigin())) return { ok: false, error: CODE_ERROR };
  const trimmed = code.trim();
  try {
    if (method === "totp") {
      if (!/^\d{6}$/.test(trimmed)) return { ok: false, error: CODE_ERROR };
      await auth.api.verifyTOTP({ body: { code: trimmed, trustDevice: false }, headers: await headers() });
    } else {
      if (!/^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/.test(trimmed)) return { ok: false, error: CODE_ERROR };
      await auth.api.verifyBackupCode({ body: { code: trimmed, trustDevice: false }, headers: await headers() });
    }
    const session = await freshAdminSession();
    if (!session) {
      await auth.api.signOut({ headers: await headers() });
      return { ok: false, error: CODE_ERROR };
    }
    await setAdminMfaCookie(session.id);
    return { ok: true };
  } catch {
    return { ok: false, error: CODE_ERROR };
  }
}

export async function verifyAdminTotp(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return finishChallenge(code, "totp");
}

export async function verifyAdminBackupCode(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return finishChallenge(code, "backup");
}
