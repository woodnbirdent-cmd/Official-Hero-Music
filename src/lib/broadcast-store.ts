import "server-only";

import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  broadcastFromAddress,
  broadcastId,
  broadcastRateDecision,
  composeRecipientList,
  decideClaim,
  emailFromUnsubscribeToken,
  publicCounts,
  type AudienceGroups,
  type BroadcastClaim,
  type MemberCounts,
} from "@/lib/broadcast";
import { alreadySentMessage, DEFAULT_AUDIENCES, DEFAULT_BODY, DEFAULT_SUBJECT, type MemberAudience } from "@/lib/broadcast-copy";
import { getPool } from "@/lib/auth";
import { ensureSchema } from "@/lib/members";
import { isTier } from "@/lib/tiers";

const USER_ID = /^[A-Za-z0-9_-]{1,128}$/;

export type BroadcastPageData = {
  counts: MemberCounts;
  total: number;
  newsletterStored: false;
  fromAddress: string | null;
  configured: boolean;
  databaseConfigured: boolean;
  alreadySent: string | null;
};

let ready: Promise<void> | null = null;

export async function ensureBroadcastTables(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  if (!ready) {
    ready = applyBroadcastTables(pool).catch((error: unknown) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

async function applyBroadcastTables(pool: Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS member_broadcast (
       id text PRIMARY KEY,
       "sentAt" timestamptz NOT NULL DEFAULT NOW(),
       "sentBy" text NOT NULL,
       "recipientCount" integer NOT NULL,
       subject text NOT NULL
     )`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS email_unsubscribe (
       email text PRIMARY KEY,
       "unsubscribedAt" timestamptz NOT NULL DEFAULT NOW()
     )`,
  );
}

export function broadcastDeliveryConfig(): { from: string | null; configured: boolean } {
  const from = broadcastFromAddress(process.env.ADMIN_EMAIL_FROM);
  const configured = Boolean(from && process.env.RESEND_API_KEY && process.env.BETTER_AUTH_SECRET);
  return { from, configured };
}

const EMPTY_GROUPS: AudienceGroups = { free: [], supporter: [], vip: [], newsletter: [] };

/** Member rows from "user", plus unsubscribe addresses. The Join list is not queried: it is not stored. */
export async function loadAudienceGroups(): Promise<{
  groups: AudienceGroups;
  unsubscribed: string[];
  newsletterStored: false;
  databaseConfigured: boolean;
}> {
  const pool = getPool();
  if (!pool) {
    return { groups: EMPTY_GROUPS, unsubscribed: [], newsletterStored: false, databaseConfigured: false };
  }
  await ensureSchema();
  await ensureBroadcastTables();
  const members = await pool.query<{ email: string; tier: string }>(
    `SELECT lower(btrim(email)) AS email, tier
     FROM "user"
     WHERE tier IN ('free', 'supporter', 'vip')
       AND email IS NOT NULL
       AND btrim(email) <> ''`,
  );
  const groups: AudienceGroups = { free: [], supporter: [], vip: [], newsletter: [] };
  for (const row of members.rows) {
    if (!isTier(row.tier) || !row.email) continue;
    groups[row.tier].push(row.email);
  }
  const removed = await pool.query<{ email: string }>(`SELECT email FROM email_unsubscribe`);
  return {
    groups,
    unsubscribed: removed.rows.map((row) => row.email),
    newsletterStored: false,
    databaseConfigured: true,
  };
}

export async function previewAudience(audiences: readonly MemberAudience[]): Promise<{
  counts: MemberCounts;
  total: number;
  newsletterStored: false;
  databaseConfigured: boolean;
}> {
  const loaded = await loadAudienceGroups();
  const composed = composeRecipientList({
    groups: loaded.groups,
    unsubscribed: loaded.unsubscribed,
    selected: audiences,
  });
  return {
    counts: publicCounts(composed.counts),
    total: composed.total,
    newsletterStored: false,
    databaseConfigured: loaded.databaseConfigured,
  };
}

export async function getBroadcastPageData(): Promise<BroadcastPageData> {
  const { from, configured } = broadcastDeliveryConfig();
  const [preview, existing] = await Promise.all([
    previewAudience(DEFAULT_AUDIENCES),
    findCompletedBroadcast(broadcastId(DEFAULT_SUBJECT, DEFAULT_BODY, DEFAULT_AUDIENCES)),
  ]);
  if (!preview.databaseConfigured) {
    return {
      counts: preview.counts,
      total: 0,
      newsletterStored: false,
      fromAddress: from,
      configured,
      databaseConfigured: false,
      alreadySent: null,
    };
  }
  return {
    counts: preview.counts,
    total: preview.total,
    newsletterStored: false,
    fromAddress: from,
    configured,
    databaseConfigured: true,
    alreadySent: existing ? alreadySentMessage(existing.sentAt) : null,
  };
}

async function findCompletedBroadcast(id: string): Promise<{ sentAt: Date } | null> {
  const pool = getPool();
  if (!pool) return null;
  await ensureBroadcastTables();
  const result = await pool.query<{ sentAt: Date; recipientCount: number }>(
    `SELECT "sentAt", "recipientCount" FROM member_broadcast WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row || Number(row.recipientCount) <= 0) return null;
  return { sentAt: new Date(row.sentAt) };
}

export async function claimBroadcast(input: {
  id: string;
  sentBy: string;
  subject: string;
  now: Date;
}): Promise<BroadcastClaim> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  await ensureBroadcastTables();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ sentAt: Date; recipientCount: number }>(
      `SELECT "sentAt", "recipientCount" FROM member_broadcast WHERE id = $1 FOR UPDATE`,
      [input.id],
    );
    const row = existing.rows[0];
    const current = row
      ? { sentAt: new Date(row.sentAt), recipientCount: Number(row.recipientCount) }
      : null;
    const decision = decideClaim(current, input.now.getTime());
    if (decision === "already" && current) {
      await client.query("COMMIT");
      return { status: "already", sentAt: current.sentAt };
    }
    if (decision === "in_progress" && current) {
      await client.query("COMMIT");
      return { status: "in_progress", sentAt: current.sentAt };
    }
    if (decision === "reclaim") {
      await client.query(`DELETE FROM member_broadcast WHERE id = $1 AND "recipientCount" = 0`, [input.id]);
    }
    await client.query(
      `INSERT INTO member_broadcast (id, "sentAt", "sentBy", "recipientCount", subject)
       VALUES ($1, $2, $3, 0, $4)`,
      [input.id, input.now.toISOString(), input.sentBy.slice(0, 320), input.subject.slice(0, 200)],
    );
    await client.query("COMMIT");
    return { status: "claimed" };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (!isUniqueViolation(error)) throw error;
    // Stay on this connection. The pool allows one client, so a new query would wait forever.
    const raced = await client.query<{ sentAt: Date; recipientCount: number }>(
      `SELECT "sentAt", "recipientCount" FROM member_broadcast WHERE id = $1`,
      [input.id],
    );
    const row = raced.rows[0];
    const sentAt = row ? new Date(row.sentAt) : input.now;
    if (row && Number(row.recipientCount) > 0) return { status: "already", sentAt };
    return { status: "in_progress", sentAt };
  } finally {
    client.release();
  }
}

export async function releaseBroadcast(id: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await ensureBroadcastTables();
  await pool.query(`DELETE FROM member_broadcast WHERE id = $1 AND "recipientCount" = 0`, [id]);
}

export async function completeBroadcast(id: string, recipientCount: number): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  await ensureBroadcastTables();
  const updated = await pool.query(
    `UPDATE member_broadcast
     SET "recipientCount" = $2, "sentAt" = NOW()
     WHERE id = $1 AND "recipientCount" = 0`,
    [id, recipientCount],
  );
  if (updated.rowCount !== 1) {
    console.error("Broadcast record update failed");
  }
}

export async function consumeBroadcastRateLimit(
  userId: string,
): Promise<{ allowed: true } | { allowed: false; reason: "limited" | "unavailable" }> {
  if (!USER_ID.test(userId)) return { allowed: false, reason: "unavailable" };
  const pool = getPool();
  if (!pool) return { allowed: false, reason: "unavailable" };
  try {
    await ensureSchema();
  } catch {
    console.error("Broadcast rate limit failed");
    return { allowed: false, reason: "unavailable" };
  }
  const key = `admin-broadcast:${userId}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ count: number; lastRequest: string }>(
      `SELECT count, "lastRequest" FROM "rateLimit" WHERE "key" = $1 FOR UPDATE`,
      [key],
    );
    const row = existing.rows[0];
    const current = row ? { count: Number(row.count), lastRequest: Number(row.lastRequest) } : null;
    const decision = broadcastRateDecision(current, Date.now());
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
    if (!decision.allowed) return { allowed: false, reason: "limited" };
    return { allowed: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Broadcast rate limit failed");
    return { allowed: false, reason: "unavailable" };
  } finally {
    client.release();
  }
}

export async function unsubscribeFromBroadcast(token: string): Promise<"ok" | "invalid" | "unavailable"> {
  const secret = process.env.BETTER_AUTH_SECRET || "";
  if (!secret) return "unavailable";
  const email = emailFromUnsubscribeToken(token, secret);
  if (!email) return "invalid";
  const pool = getPool();
  if (!pool) return "unavailable";
  try {
    await ensureBroadcastTables();
    await pool.query(
      `INSERT INTO email_unsubscribe (email, "unsubscribedAt")
       VALUES ($1, NOW())
       ON CONFLICT (email) DO NOTHING`,
      [email],
    );
    return "ok";
  } catch {
    console.error("Unsubscribe failed");
    return "unavailable";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
