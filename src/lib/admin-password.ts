import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { isAdminEmail } from "@/lib/admin-allowlist";
import {
  ADMIN_PASSWORD_RATE_MAX,
  ADMIN_PASSWORD_RATE_WINDOW_SECONDS,
  PASSWORD_COMMON,
  PASSWORD_DENIED,
  PASSWORD_DIFFERENT,
  PASSWORD_RATE_LIMITED,
  PASSWORD_STALE,
  adminPasswordIssue,
  nextPasswordRate,
  passwordBreachStatus,
  passwordFailureMessage,
} from "@/lib/admin-password-policy";
import { ADMIN_SESSION_SECONDS, sessionIsFresh } from "@/lib/admin-security";
import { auth, getPool } from "@/lib/auth";
import { ensureSchema } from "@/lib/members";

const USER_ID = /^[A-Za-z0-9]{1,128}$/;

const passwordAttempt = new AsyncLocalStorage<{ done: boolean }>();

/** One policy check per request, even when the auth hook runs it again. */
export function withAdminPasswordAttempt<T>(work: () => Promise<T>): Promise<T> {
  return passwordAttempt.run({ done: false }, work);
}

export type PasswordChangeContext = {
  userId: string;
  sessionEmail: string;
  sessionCreatedAt: Date | string | number;
  newPassword: string;
  currentPassword: string;
};

/** True when this admin already has a credential password. Null when the lookup failed. */
export async function adminHasPassword(userId: string): Promise<boolean | null> {
  if (!USER_ID.test(userId)) return false;
  const pool = getPool();
  if (!pool) return null;
  try {
    await ensureSchema();
    const result = await pool.query<{ password: string | null }>(
      `SELECT password FROM "account"
       WHERE "userId" = $1 AND "providerId" = 'credential' AND "accountId" = $1
       LIMIT 1`,
      [userId],
    );
    const password = result.rows[0]?.password;
    return typeof password === "string" && password.length > 0;
  } catch {
    console.error("Admin password lookup failed");
    return null;
  }
}

/**
 * Allowlist, 8-hour session, rate limit, length, and breached-password check.
 * Returns true when the account is an allowlisted admin. Non-admins return false
 * without extra rules. Throws APIError for an admin failure. The password is not logged.
 */
export async function enforceAdminPasswordChange(input: PasswordChangeContext): Promise<boolean> {
  const attempt = passwordAttempt.getStore();
  if (attempt?.done) return true;

  const sessionEmail = input.sessionEmail.trim().toLowerCase();
  const dbEmail = await databaseEmail(input.userId);
  if (dbEmail === null) throw new APIError("BAD_REQUEST", { message: PASSWORD_DENIED });
  const normalizedDb = dbEmail.trim().toLowerCase();
  const sessionAdmin = isAdminEmail(sessionEmail);
  const dbAdmin = isAdminEmail(normalizedDb);
  if (!sessionAdmin && !dbAdmin) return false;
  if (!sessionAdmin || !dbAdmin || sessionEmail !== normalizedDb) {
    throw new APIError("BAD_REQUEST", { message: PASSWORD_DENIED });
  }
  if (!sessionIsFresh(input.sessionCreatedAt, ADMIN_SESSION_SECONDS)) {
    throw new APIError("FORBIDDEN", { message: PASSWORD_STALE });
  }

  const rate = await consumeAdminPasswordRateLimit(input.userId);
  if (!rate.allowed) {
    throw new APIError(rate.reason === "limited" ? "TOO_MANY_REQUESTS" : "BAD_REQUEST", {
      message: rate.reason === "limited" ? PASSWORD_RATE_LIMITED : PASSWORD_DENIED,
    });
  }

  if (input.currentPassword && input.currentPassword === input.newPassword) {
    throw new APIError("BAD_REQUEST", { message: PASSWORD_DIFFERENT });
  }
  const issue = adminPasswordIssue(input.newPassword, normalizedDb);
  if (issue) throw new APIError("BAD_REQUEST", { message: issue });

  const breach = await passwordBreachStatus(input.newPassword);
  if (breach === "breached") throw new APIError("BAD_REQUEST", { message: PASSWORD_COMMON });
  if (attempt) attempt.done = true;
  return true;
}

export async function consumeAdminPasswordRateLimit(
  userId: string,
): Promise<{ allowed: true } | { allowed: false; reason: "limited" | "unavailable"; retryAfterSeconds: number }> {
  const unavailable = {
    allowed: false as const,
    reason: "unavailable" as const,
    retryAfterSeconds: ADMIN_PASSWORD_RATE_WINDOW_SECONDS,
  };
  if (!USER_ID.test(userId)) return unavailable;
  const pool = getPool();
  if (!pool) return unavailable;
  const key = `admin-password:${userId}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ count: number; lastRequest: string }>(
      `SELECT count, "lastRequest" FROM "rateLimit" WHERE "key" = $1 FOR UPDATE`,
      [key],
    );
    const row = existing.rows[0];
    const current = row ? { count: Number(row.count), lastRequest: Number(row.lastRequest) } : null;
    const decision = nextPasswordRate(
      current,
      Date.now(),
      ADMIN_PASSWORD_RATE_WINDOW_SECONDS * 1000,
      ADMIN_PASSWORD_RATE_MAX,
    );
    const lastRequest = decision.lastRequest.toString();
    if (!row) {
      await client.query(`INSERT INTO "rateLimit" (id, "key", count, "lastRequest") VALUES ($1, $2, $3, $4)`, [
        randomUUID(),
        key,
        decision.count,
        lastRequest,
      ]);
    } else {
      await client.query(`UPDATE "rateLimit" SET count = $2, "lastRequest" = $3 WHERE "key" = $1`, [
        key,
        decision.count,
        lastRequest,
      ]);
    }
    await client.query("COMMIT");
    if (!decision.allowed) {
      return { allowed: false, reason: "limited", retryAfterSeconds: decision.retryAfterSeconds };
    }
    return { allowed: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Admin password rate limit failed");
    return unavailable;
  } finally {
    client.release();
  }
}

/** Drop every session except the one on this request. */
export async function revokeOtherAdminSessions(userId: string): Promise<boolean> {
  try {
    await auth.api.revokeOtherSessions({ headers: await headers() });
    return true;
  } catch {
    console.error("Admin password session revoke failed");
  }
  const pool = getPool();
  if (!pool || !USER_ID.test(userId)) return false;
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
      query: { disableCookieCache: true, disableRefresh: true },
    });
    const token = session?.session?.token;
    if (!token) return false;
    await pool.query(`DELETE FROM "session" WHERE "userId" = $1 AND token <> $2`, [userId, token]);
    return true;
  } catch {
    console.error("Admin password session revoke failed");
    return false;
  }
}

export function authFailureMessage(error: unknown): string {
  const body =
    error && typeof error === "object" && "body" in error && error.body && typeof error.body === "object"
      ? (error.body as { code?: unknown; message?: unknown })
      : null;
  const code = typeof body?.code === "string" ? body.code : undefined;
  const bodyMessage = typeof body?.message === "string" ? body.message : undefined;
  const ownMessage =
    error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : undefined;
  return passwordFailureMessage(code, bodyMessage ?? ownMessage);
}

async function databaseEmail(userId: string): Promise<string | null> {
  if (!USER_ID.test(userId)) return null;
  const pool = getPool();
  if (!pool) return null;
  try {
    const result = await pool.query<{ email: string }>(`SELECT email FROM "user" WHERE id = $1`, [userId]);
    return result.rows[0]?.email ?? null;
  } catch {
    console.error("Admin password account lookup failed");
    return null;
  }
}
