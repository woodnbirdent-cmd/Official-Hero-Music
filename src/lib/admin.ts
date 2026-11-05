import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isAdminEmail, safeAdminPath } from "@/lib/admin-allowlist";
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
  | { ok: false; reason: "anonymous" | "forbidden" | "stale" };

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
  const result = await pool.query<{
    tier: string;
    email: string;
    name: string;
    stripeCustomerId: string | null;
  }>(`SELECT tier, email, name, "stripeCustomerId" FROM "user" WHERE id = $1`, [session.user.id]);
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

/** Origin check plus the allowlist. Sensitive changes also need a recent sign-in. */
export async function guardAdminMutation(options?: {
  recent?: boolean;
  recentError?: string;
}): Promise<{ ok: true; member: Member; sessionCreatedAt: Date } | { ok: false; error: string }> {
  if (!(await assertSameOrigin())) return { ok: false, error: "Could not confirm this request." };
  const gate = await adminGate();
  if (!gate.ok) {
    if (gate.reason === "stale") return { ok: false, error: "Sign in again to continue." };
    return { ok: false, error: "Could not confirm this request." };
  }
  if (options?.recent && !sessionIsFresh(gate.sessionCreatedAt, ADMIN_REAUTH_SECONDS)) {
    return {
      ok: false,
      error: options.recentError ?? "Sign in again before changing a member or a Stripe subscription.",
    };
  }
  return { ok: true, member: gate.member, sessionCreatedAt: gate.sessionCreatedAt };
}
