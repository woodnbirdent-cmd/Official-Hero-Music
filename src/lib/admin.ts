import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isAdminEmail, safeAdminPath } from "@/lib/admin-allowlist";
import { openAdminMfa, sealAdminMfa } from "@/lib/admin-mfa";
import { accountsConfigured, auth, getPool } from "@/lib/auth";
import { ensureSchema, type Member } from "@/lib/members";
import { isTier } from "@/lib/tiers";
import {
  ADMIN_REAUTH_SECONDS,
  ADMIN_SESSION_SECONDS,
  sameOrigin,
  sessionIsFresh,
} from "@/lib/admin-security";

export { adminEmails, isAdminEmail } from "@/lib/admin-allowlist";

export type AdminGate =
  | { ok: true; member: Member; sessionCreatedAt: Date }
  | { ok: false; reason: "anonymous" | "forbidden" | "stale" | "needs-enroll" | "needs-totp" };

const MFA_COOKIE = "admin_totp";

async function mfaMatches(sessionId: string): Promise<boolean> {
  const secret = process.env.BETTER_AUTH_SECRET;
  const token = (await cookies()).get(MFA_COOKIE)?.value;
  if (!secret || !token) return false;
  return (await openAdminMfa(token, secret)) === sessionId;
}

export async function setAdminMfaCookie(sessionId: string): Promise<void> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return;
  (await cookies()).set(MFA_COOKIE, await sealAdminMfa(sessionId, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: ADMIN_SESSION_SECONDS,
  });
}

export async function adminGate(): Promise<AdminGate> {
  if (!accountsConfigured()) return { ok: false, reason: "anonymous" };
  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  try {
    await ensureSchema();
    session = await auth.api.getSession({
      headers: await headers(),
      query: { disableCookieCache: true, disableRefresh: true },
    });
  } catch {
    console.error("Admin session lookup failed");
    return { ok: false, reason: "anonymous" };
  }
  if (!session?.user?.id || !session.user.email || !session.session?.createdAt) {
    return { ok: false, reason: "anonymous" };
  }

  const pool = getPool();
  if (!pool) return { ok: false, reason: "anonymous" };
  let result: { rows: Array<{
    tier: string;
    email: string;
    name: string;
    stripeCustomerId: string | null;
    twoFactorEnabled: boolean | null;
  }> };
  try {
    result = await pool.query<{
    tier: string;
    email: string;
    name: string;
    stripeCustomerId: string | null;
    twoFactorEnabled: boolean | null;
  }>(
    `SELECT tier, email, name, "stripeCustomerId", "twoFactorEnabled" FROM "user" WHERE id = $1`,
    [session.user.id],
    );
  } catch {
    console.error("Admin user lookup failed");
    return { ok: false, reason: "anonymous" };
  }
  const row = result.rows[0];
  if (!row?.email) return { ok: false, reason: "anonymous" };

  const email = row.email.trim().toLowerCase();
  if (email !== session.user.email.trim().toLowerCase() || !isAdminEmail(email)) {
    return { ok: false, reason: "forbidden" };
  }
  const createdAt = new Date(session.session.createdAt);
  if (!sessionIsFresh(createdAt, ADMIN_SESSION_SECONDS)) {
    return { ok: false, reason: "stale" };
  }
  if (row.twoFactorEnabled !== true) return { ok: false, reason: "needs-enroll" };
  if (!(await mfaMatches(session.session.id))) return { ok: false, reason: "needs-totp" };
  return {
    ok: true,
    sessionCreatedAt: createdAt,
    member: {
      id: session.user.id,
      email: row.email,
      name: row.name || "",
      tier: isTier(row.tier) ? row.tier : "free",
      stripeCustomerId: row.stripeCustomerId,
    },
  };
}

/** Signed-in allowlisted admins with a fresh session pass. Everyone else is denied. */
export async function requireAdmin(): Promise<Member> {
  const gate = await adminGate();
  if (!gate.ok) {
    if (gate.reason === "forbidden") notFound();
    if (gate.reason === "needs-enroll") redirect("/admin/sign-in/setup");
    if (gate.reason === "needs-totp") redirect("/admin/sign-in/totp");
    const path = safeAdminPath((await headers()).get("x-pathname"));
    const error = gate.reason === "stale" ? "expired" : "";
    const params = new URLSearchParams({ next: path });
    if (error) params.set("error", error);
    redirect(`/admin/sign-in?${params.toString()}`);
  }
  return gate.member;
}

export async function assertSameOrigin(): Promise<boolean> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  return sameOrigin(headerList.get("origin"), host);
}

/** Origin check plus the allowlist. Sensitive Stripe changes also need a recent sign-in. */
export async function guardAdminMutation(options?: {
  recent?: boolean;
}): Promise<{ ok: true; member: Member } | { ok: false; error: string }> {
  if (!(await assertSameOrigin())) return { ok: false, error: "Could not confirm this request." };
  const gate = await adminGate();
  if (!gate.ok) {
    if (gate.reason === "stale") return { ok: false, error: "Sign in again to continue." };
    return { ok: false, error: "Could not confirm this request." };
  }
  if (options?.recent && !sessionIsFresh(gate.sessionCreatedAt, ADMIN_REAUTH_SECONDS)) {
    return { ok: false, error: "Sign in again before changing a member or a Stripe subscription." };
  }
  return { ok: true, member: gate.member };
}
