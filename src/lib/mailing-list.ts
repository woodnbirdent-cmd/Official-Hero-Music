import "server-only";

import type { Pool, PoolClient } from "pg";
import { getPool } from "@/lib/auth";
import { normalizeEmail } from "@/lib/broadcast";

/**
 * Join and merch waitlist addresses.
 * Created on first use with CREATE TABLE IF NOT EXISTS, same as member_broadcast
 * and the other app tables. No separate migration command.
 */
const CREATE_MAILING_LIST = `CREATE TABLE IF NOT EXISTS mailing_list (
  email text PRIMARY KEY,
  name text,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  unsubscribed boolean NOT NULL DEFAULT false,
  CONSTRAINT mailing_list_email_normalized CHECK (email = lower(btrim(email)) AND char_length(email) <= 254),
  CONSTRAINT mailing_list_name_length CHECK (name IS NULL OR char_length(name) <= 200),
  CONSTRAINT mailing_list_source_check CHECK (source IN ('join', 'waitlist'))
)`;

/** Same table as the broadcast store, so a signup can see an existing unsubscribe. */
const CREATE_EMAIL_UNSUBSCRIBE = `CREATE TABLE IF NOT EXISTS email_unsubscribe (
  email text PRIMARY KEY,
  "unsubscribedAt" timestamptz NOT NULL DEFAULT NOW()
)`;

export type MailingSource = "join" | "waitlist";

type Queryable = Pick<Pool | PoolClient, "query">;

let ready: Promise<void> | null = null;

export async function ensureMailingList(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  if (!ready) {
    ready = applyMailingList(pool).catch((error: unknown) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

async function applyMailingList(pool: Pool): Promise<void> {
  await pool.query(CREATE_EMAIL_UNSUBSCRIBE);
  await pool.query(CREATE_MAILING_LIST);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS mailing_list_active_email_idx ON mailing_list (email) WHERE unsubscribed = false`,
  );
}

function cleanName(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 200);
}

/** Insert or refresh one address. A previous unsubscribe stays unsubscribed. */
export async function saveMailingSignup(input: {
  email: string;
  name: string;
  source: MailingSource;
}): Promise<boolean> {
  const email = normalizeEmail(input.email);
  if (!email) return false;
  if (input.source !== "join" && input.source !== "waitlist") return false;
  const pool = getPool();
  if (!pool) return false;
  try {
    await ensureMailingList();
    await pool.query(
      `INSERT INTO mailing_list (email, name, source, unsubscribed)
       VALUES ($1, NULLIF($2, ''), $3, EXISTS (SELECT 1 FROM email_unsubscribe WHERE email = $1))
       ON CONFLICT (email) DO UPDATE
       SET name = COALESCE(EXCLUDED.name, mailing_list.name),
           unsubscribed = mailing_list.unsubscribed OR EXCLUDED.unsubscribed`,
      [email, cleanName(input.name), input.source],
    );
    return true;
  } catch {
    console.error("Mailing list save failed");
    return false;
  }
}

/** Caller must already have created the table. Safe inside the unsubscribe transaction. */
export async function markMailingListUnsubscribed(db: Queryable, email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  await db.query(`UPDATE mailing_list SET unsubscribed = true WHERE email = $1`, [normalized]);
}
