"use server";

import { headers } from "next/headers";
import { assertSameOrigin } from "@/lib/admin";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { accountsConfigured, auth } from "@/lib/auth";
import { GENERIC_LINK_MESSAGE, GENERIC_SIGN_IN_ERROR } from "@/lib/admin-security";

export type SignInResult = { ok: true; message?: string; step?: "totp" } | { ok: false; error: string };

export async function sendAdminMagicLink(email: string): Promise<SignInResult> {
  if (!(await assertSameOrigin())) return { ok: true, message: GENERIC_LINK_MESSAGE };
  if (!accountsConfigured()) return { ok: true, message: GENERIC_LINK_MESSAGE };
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return { ok: true, message: GENERIC_LINK_MESSAGE };
  try {
    await auth.api.signInMagicLink({
      body: {
        email: normalized,
        callbackURL: "/admin",
        errorCallbackURL: "/admin/sign-in?error=link",
        newUserCallbackURL: "/admin",
      },
      headers: await headers(),
    });
  } catch {
    console.error("Admin magic link request failed");
  }
  return { ok: true, message: GENERIC_LINK_MESSAGE };
}

export async function signInAdmin(email: string, password: string): Promise<SignInResult> {
  if (!(await assertSameOrigin()) || !accountsConfigured()) {
    return { ok: false, error: GENERIC_SIGN_IN_ERROR };
  }
  try {
    const normalized = email.trim().toLowerCase();
    const result = await auth.api.signInEmail({
      body: { email: normalized, password },
      headers: await headers(),
    });
    if (result && typeof result === "object" && "twoFactorRedirect" in result && result.twoFactorRedirect === true) {
      return isAdminEmail(normalized) ? { ok: true, step: "totp" } : { ok: false, error: GENERIC_SIGN_IN_ERROR };
    }
    const signedInEmail = result?.user?.email;
    if (!isAdminEmail(signedInEmail)) {
      await auth.api.signOut({ headers: await headers() });
      return { ok: false, error: GENERIC_SIGN_IN_ERROR };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC_SIGN_IN_ERROR };
  }
}
