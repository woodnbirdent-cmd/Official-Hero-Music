import "server-only";
import { notFound } from "next/navigation";
import type { Pool, PoolClient } from "pg";
import { isAdminEmail, requireAdmin } from "@/lib/admin";
import { getPool } from "@/lib/auth";
import type { Member } from "@/lib/members";

export type AdminActivity = {
  id: string;
  adminEmail: string;
  action: string;
  target: string;
  detail: string;
  createdAt: Date;
};

type Queryable = Pick<Pool | PoolClient, "query">;

let ready: Promise<void> | null = null;

export async function ensureAdminTables(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  if (!ready) {
    ready = applyAdminTables(pool).catch((error: unknown) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

async function applyAdminTables(pool: Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS order_fulfillment (
       session_id text PRIMARY KEY,
       fulfilled boolean NOT NULL DEFAULT false,
       updated_at timestamptz NOT NULL DEFAULT NOW()
     )`,
  );
  await pool.query(
    `ALTER TABLE order_fulfillment ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false`,
  );
  await pool.query(
    `ALTER TABLE order_fulfillment ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0`,
  );
  await pool.query(
    `ALTER TABLE order_fulfillment ADD COLUMN IF NOT EXISTS shippo_order_id text`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS admin_activity (
       id bigserial PRIMARY KEY,
       admin_user_id text NOT NULL,
       admin_email text NOT NULL,
       action text NOT NULL,
       target text NOT NULL DEFAULT '',
       detail text NOT NULL DEFAULT '',
       created_at timestamptz NOT NULL DEFAULT NOW()
     )`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS admin_activity_created_at_idx ON admin_activity (created_at DESC)`,
  );
}

export async function writeActivity(
  db: Queryable,
  admin: Member,
  action: string,
  target: string,
  detail: string,
): Promise<void> {
  if (!isAdminEmail(admin.email)) notFound();
  await db.query(
    `INSERT INTO admin_activity (admin_user_id, admin_email, action, target, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [admin.id, admin.email, action.slice(0, 200), target.slice(0, 500), detail.slice(0, 1000)],
  );
}

export async function recordActivity(admin: Member, action: string, target: string, detail: string): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  await ensureAdminTables();
  await writeActivity(pool, admin, action, target, detail);
}

export async function storedShippoOrderId(sessionId: string): Promise<string | null> {
  const pool = getPool();
  if (!pool) return null;
  await ensureAdminTables();
  const result = await pool.query<{ shippo_order_id: string | null }>(
    `SELECT shippo_order_id FROM order_fulfillment WHERE session_id = $1`,
    [sessionId],
  );
  const id = result.rows[0]?.shippo_order_id?.trim() || "";
  return id || null;
}

export async function rememberShippoOrderId(sessionId: string, shippoOrderId: string): Promise<void> {
  const pool = getPool();
  if (!pool || !shippoOrderId) return;
  await ensureAdminTables();
  await pool.query(
    `INSERT INTO order_fulfillment (session_id, fulfilled, shippo_order_id, updated_at)
     VALUES ($1, false, $2, NOW())
     ON CONFLICT (session_id) DO UPDATE
       SET shippo_order_id = COALESCE(NULLIF(order_fulfillment.shippo_order_id, ''), EXCLUDED.shippo_order_id),
           updated_at = NOW()`,
    [sessionId, shippoOrderId],
  );
}

export async function listAdminActivity(): Promise<AdminActivity[]> {
  await requireAdmin();
  const pool = getPool();
  if (!pool) return [];
  await ensureAdminTables();
  const result = await pool.query<{
    id: string;
    admin_email: string;
    action: string;
    target: string;
    detail: string;
    created_at: Date;
  }>(
    `SELECT id::text AS id, admin_email, action, target, detail, created_at
     FROM admin_activity
     ORDER BY created_at DESC
     LIMIT 200`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    adminEmail: row.admin_email,
    action: row.action,
    target: row.target,
    detail: row.detail,
    createdAt: new Date(row.created_at),
  }));
}
