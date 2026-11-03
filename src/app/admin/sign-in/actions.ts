"use server";

import { headers } from "next/headers";
import { isAPIError } from "better-auth/api";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { accountsConfigured, auth } from "@/lib/auth";
import { adminMagicLinkConfigured } from "@/lib/admin-email";

export type SignInResult = { ok: true } | { ok: false; error: string };

const DENIED = "You do not have access to the admin area.";

export async function adminEmailAllowed(email: string): Promise<SignInResult> {
  if (!isAdminEmail(email)) return { ok: false, error: DENIED };
  return { ok: true };
}

export async function sendAdminMagicLink(email: string): Promise<SignInResult> {
  const normalized = email.trim().toLowerCase();
  if (!isAdminEmail(normalized)) return { ok: false, error: DENIED };
  if (!accountsConfigured()) return { ok: false, error: "Accounts are not configured." };
  if (!adminMagicLinkConfigured()) return { ok: false, error: "Email sign-in is not configured." };

  try {
    await auth.api.signInMagicLink({
      body: {
        email: normalized,
        callbackURL: "/admin",
        errorCallbackURL: "/admin/sign-in?error=link",
      },
      headers: await headers(),
    });
    return { ok: true };
  } catch (error) {
    console.error("Admin magic link request failed");
    if (isAPIError(error)) {
      return { ok: false, error: error.message || "Could not send the sign-in email." };
    }
    return { ok: false, error: "Could not send the sign-in email." };
  }
}
