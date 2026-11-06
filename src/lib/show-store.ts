import "server-only";
import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getPool } from "@/lib/auth";
import { checkinFlags, formatChicagoTime, formatTicketBody, parsePerkIds, parseTicketCode, ticketCodeAlphabet } from "@/lib/show-codes";
import { TICKET_HOLD_MINUTES, TICKET_MAX_QUANTITY, perkStorage, ticketCapacity } from "@/lib/show-config";
import type { LogoDelivery, RedeemResult, ShowKind, ShowOrder, ShowStatus, ShowTicket, SponsorType, TicketAvailability } from "@/lib/show-types";

const SHOW_LOCK_KEY = 20270109;

const ORDER_FIELDS = `
  id, kind, sponsor_type, status, stripe_session_id, stripe_payment_intent_id,
  buyer_name, buyer_email, tier_id, tier_name, perks, quantity, unit_amount_cents,
  amount_cents, shirt_size, phone, business_name, logo_delivery, logo_filename,
  availability, role_interest, notes,
  site_origin, buyer_email_sent_at, owner_notified_at, created_at, expires_at, paid_at
`;

export class ShowError extends Error {
  readonly code: "capacity" | "sold-out" | "remaining" | "email-limit" | "database" | "conflict" | "amount" | "missing";

  constructor(code: ShowError["code"], message: string) {
    super(message);
    this.name = "ShowError";
    this.code = code;
  }
}

export function showErrorStatus(error: ShowError): number {
  if (error.code === "database" || error.code === "capacity") return 503;
  return 409;
}

type OrderRow = {
  id: number;
  kind: string;
  sponsor_type: string;
  status: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string;
  buyer_name: string;
  buyer_email: string;
  tier_id: string;
  tier_name: string;
  perks: string;
  quantity: number;
  unit_amount_cents: number;
  amount_cents: number;
  shirt_size: string;
  phone: string;
  business_name: string;
  logo_delivery: string;
  logo_filename: string;
  availability: string;
  role_interest: string;
  notes: string;
  site_origin: string;
  buyer_email_sent_at: Date | null;
  owner_notified_at: Date | null;
  created_at: Date;
  expires_at: Date | null;
  paid_at: Date | null;
};

type TicketRow = {
  order_id: number;
  code: string;
  tier_id: string;
  tier_name: string;
  perks: string;
  shirt_size: string;
  redeemed_at: Date | null;
};

let ready: Promise<void> | null = null;

export function resolvePool(pool?: Pool): Pool {
  const chosen = pool ?? getPool();
  if (!chosen) throw new ShowError("database", "Database is not configured.");
  return chosen;
}

export async function ensureShowTables(pool?: Pool): Promise<void> {
  const db = pool ?? getPool();
  if (!db) return;
  if (!ready) {
    ready = applyShowTables(db).catch((error: unknown) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

async function applyShowTables(pool: Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS show_orders (
       id serial PRIMARY KEY,
       kind text NOT NULL,
       sponsor_type text NOT NULL DEFAULT '',
       status text NOT NULL,
       stripe_session_id text UNIQUE,
       stripe_payment_intent_id text NOT NULL DEFAULT '',
       buyer_name text NOT NULL DEFAULT '',
       buyer_email text NOT NULL DEFAULT '',
       tier_id text NOT NULL DEFAULT '',
       tier_name text NOT NULL DEFAULT '',
       perks text NOT NULL DEFAULT '',
       quantity integer NOT NULL DEFAULT 1,
       unit_amount_cents integer NOT NULL DEFAULT 0,
       amount_cents integer NOT NULL DEFAULT 0,
       shirt_size text NOT NULL DEFAULT '',
       phone text NOT NULL DEFAULT '',
       business_name text NOT NULL DEFAULT '',
       logo_delivery text NOT NULL DEFAULT '',
       logo_filename text NOT NULL DEFAULT '',
       logo_bytes bytea,
       site_origin text NOT NULL DEFAULT '',
       buyer_email_sent_at timestamptz,
       owner_notified_at timestamptz,
       created_at timestamptz NOT NULL DEFAULT NOW(),
       expires_at timestamptz,
       paid_at timestamptz,
       availability text NOT NULL DEFAULT '',
       role_interest text NOT NULL DEFAULT '',
       notes text NOT NULL DEFAULT ''
     )`,
  );
  await pool.query(`ALTER TABLE show_orders ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE show_orders ADD COLUMN IF NOT EXISTS role_interest text NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE show_orders ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT ''`);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS show_tickets (
       id serial PRIMARY KEY,
       order_id integer NOT NULL REFERENCES show_orders(id) ON DELETE CASCADE,
       code text NOT NULL UNIQUE,
       tier_id text NOT NULL,
       tier_name text NOT NULL,
       perks text NOT NULL DEFAULT '',
       shirt_size text NOT NULL DEFAULT '',
       redeemed_at timestamptz,
       created_at timestamptz NOT NULL DEFAULT NOW()
     )`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS show_orders_capacity_idx ON show_orders (kind, status, expires_at)`,
  );
}

async function withLockedClient<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [SHOW_LOCK_KEY]);
    const value = await work(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection may already be aborted.
    }
    throw error;
  } finally {
    client.release();
  }
}

function asStatus(value: string): ShowStatus {
  if (value === "paid" || value === "unpaid" || value === "expired" || value === "pending" || value === "received") {
    return value;
  }
  return "pending";
}

function asKind(value: string): ShowKind {
  if (value === "sponsorship" || value === "volunteer") return value;
  return "ticket";
}

function asSponsorType(value: string): SponsorType {
  if (value === "community" || value === "business") return value;
  return "";
}

function asLogo(value: string): LogoDelivery {
  if (value === "upload" || value === "email") return value;
  return "";
}

function mapOrder(row: OrderRow, tickets: ShowTicket[]): ShowOrder {
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  let status = asStatus(row.status);
  if (status === "pending" && expiresAt && expiresAt.getTime() <= Date.now()) status = "expired";
  return {
    id: row.id,
    kind: asKind(row.kind),
    sponsorType: asSponsorType(row.sponsor_type),
    status,
    stripeSessionId: row.stripe_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id || "",
    buyerName: row.buyer_name,
    buyerEmail: row.buyer_email,
    tierId: row.tier_id,
    tierName: row.tier_name,
    perks: row.perks || "",
    quantity: row.quantity,
    unitAmountCents: row.unit_amount_cents,
    amountCents: row.amount_cents,
    shirtSize: row.shirt_size || "",
    phone: row.phone || "",
    businessName: row.business_name || "",
    logoDelivery: asLogo(row.logo_delivery),
    logoFilename: row.logo_filename || "",
    availability: row.availability || "",
    roleInterest: row.role_interest || "",
    notes: row.notes || "",
    siteOrigin: row.site_origin || "",
    buyerEmailSentAt: row.buyer_email_sent_at ? new Date(row.buyer_email_sent_at) : null,
    ownerNotifiedAt: row.owner_notified_at ? new Date(row.owner_notified_at) : null,
    createdAt: new Date(row.created_at),
    expiresAt,
    paidAt: row.paid_at ? new Date(row.paid_at) : null,
    tickets,
  };
}

function mapTicket(row: TicketRow): ShowTicket {
  return {
    code: row.code,
    tierId: row.tier_id,
    tierName: row.tier_name,
    perks: row.perks || "",
    shirtSize: row.shirt_size || "",
    redeemedAt: row.redeemed_at ? new Date(row.redeemed_at) : null,
  };
}

async function ticketsForOrders(pool: Pool, orderIds: number[]): Promise<Map<number, ShowTicket[]>> {
  const grouped = new Map<number, ShowTicket[]>();
  if (orderIds.length === 0) return grouped;
  const result = await pool.query<TicketRow>(
    `SELECT order_id, code, tier_id, tier_name, perks, shirt_size, redeemed_at
     FROM show_tickets
     WHERE order_id = ANY($1::int[])
     ORDER BY id`,
    [orderIds],
  );
  for (const row of result.rows) {
    const list = grouped.get(row.order_id) ?? [];
    list.push(mapTicket(row));
    grouped.set(row.order_id, list);
  }
  return grouped;
}

export async function ticketAvailability(pool?: Pool): Promise<TicketAvailability> {
  const capacity = ticketCapacity();
  const db = pool ?? getPool();
  if (!db) return { state: "unavailable", capacity, remaining: null, paid: 0, held: 0 };
  if (capacity == null) return { state: "closed", capacity: null, remaining: null, paid: 0, held: 0 };
  try {
    await ensureShowTables(db);
    const counts = await db.query<{ paid: number; held: number }>(
      `SELECT
         COALESCE(SUM(quantity) FILTER (WHERE status = 'paid'), 0)::int AS paid,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'pending' AND expires_at > NOW()), 0)::int AS held
       FROM show_orders
       WHERE kind = 'ticket'`,
    );
    const paid = Number(counts.rows[0]?.paid ?? 0);
    const held = Number(counts.rows[0]?.held ?? 0);
    const remaining = Math.max(0, capacity - paid - held);
    if (paid >= capacity) return { state: "sold-out", capacity, remaining: 0, paid, held };
    if (remaining <= 0) return { state: "reserved-out", capacity, remaining: 0, paid, held };
    return { state: "open", capacity, remaining, paid, held };
  } catch (error) {
    console.error("Ticket availability failed");
    void error;
    return { state: "unavailable", capacity, remaining: null, paid: 0, held: 0 };
  }
}

export type NewTicketOrder = {
  tierId: string;
  tierName: string;
  perks: readonly string[];
  quantity: number;
  unitAmountCents: number;
  shirtSize: string;
  buyerName: string;
  buyerEmail: string;
  siteOrigin: string;
};

export async function reserveTicketOrder(input: NewTicketOrder, pool?: Pool): Promise<{ id: number; expiresAt: Date }> {
  const db = resolvePool(pool);
  await ensureShowTables(db);
  const expiresAt = new Date(Date.now() + TICKET_HOLD_MINUTES * 60 * 1000);
  const id = await withLockedClient(db, async (client) => {
    const capacity = ticketCapacity();
    if (capacity == null) throw new ShowError("capacity", "Ticket capacity is not set.");
    const counts = await client.query<{ paid: number; held: number; email_held: number }>(
      `SELECT
         COALESCE(SUM(quantity) FILTER (WHERE status = 'paid'), 0)::int AS paid,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'pending' AND expires_at > NOW()), 0)::int AS held,
         COALESCE(SUM(quantity) FILTER (
           WHERE status = 'pending' AND expires_at > NOW() AND lower(buyer_email) = lower($1)
         ), 0)::int AS email_held
       FROM show_orders
       WHERE kind = 'ticket'`,
      [input.buyerEmail],
    );
    const paid = Number(counts.rows[0]?.paid ?? 0);
    const held = Number(counts.rows[0]?.held ?? 0);
    const emailHeld = Number(counts.rows[0]?.email_held ?? 0);
    if (emailHeld + input.quantity > TICKET_MAX_QUANTITY) {
      throw new ShowError("email-limit", "Finish the checkout already open for this email before starting another.");
    }
    const left = capacity - paid - held;
    if (input.quantity > left) {
      if (paid >= capacity || left <= 0) {
        throw new ShowError(
          "sold-out",
          paid >= capacity ? "Sold out." : "No tickets left to reserve right now.",
        );
      }
      throw new ShowError("remaining", `Only ${left} ${left === 1 ? "ticket is" : "tickets are"} left.`);
    }
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO show_orders (
         kind, sponsor_type, status, buyer_name, buyer_email, tier_id, tier_name, perks,
         quantity, unit_amount_cents, amount_cents, shirt_size, site_origin, expires_at
       ) VALUES (
         'ticket', '', 'pending', $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10, $11
       ) RETURNING id`,
      [
        input.buyerName,
        input.buyerEmail,
        input.tierId,
        input.tierName,
        perkStorage(input.perks),
        input.quantity,
        input.unitAmountCents,
        input.unitAmountCents * input.quantity,
        input.shirtSize,
        input.siteOrigin,
        expiresAt,
      ],
    );
    const orderId = inserted.rows[0]?.id;
    if (!orderId) throw new ShowError("database", "Could not reserve tickets.");
    return orderId;
  });
  return { id, expiresAt };
}

export type NewSponsorshipOrder = {
  status: "pending" | "unpaid";
  sponsorType: "community" | "business";
  tierId: string;
  tierName: string;
  amountCents: number;
  buyerName: string;
  buyerEmail: string;
  phone: string;
  businessName: string;
  logoDelivery: LogoDelivery;
  logoFilename: string;
  logoBytes: Buffer | null;
  siteOrigin: string;
  expiresAt: Date | null;
  perks?: string;
};

export async function createSponsorshipOrder(input: NewSponsorshipOrder, pool?: Pool): Promise<number> {
  const db = resolvePool(pool);
  await ensureShowTables(db);
  const inserted = await db.query<{ id: number }>(
    `INSERT INTO show_orders (
       kind, sponsor_type, status, buyer_name, buyer_email, tier_id, tier_name, perks,
       quantity, unit_amount_cents, amount_cents, phone, business_name,
       logo_delivery, logo_filename, logo_bytes, site_origin, expires_at
     ) VALUES (
       'sponsorship', $1, $2, $3, $4, $5, $6, $7,
       1, $8, $8, $9, $10,
       $11, $12, $13, $14, $15
     ) RETURNING id`,
    [
      input.sponsorType,
      input.status,
      input.buyerName,
      input.buyerEmail,
      input.tierId,
      input.tierName,
      input.perks ?? "",
      input.amountCents,
      input.phone,
      input.businessName,
      input.logoDelivery,
      input.logoFilename,
      input.logoBytes,
      input.siteOrigin,
      input.expiresAt,
    ],
  );
  const id = inserted.rows[0]?.id;
  if (!id) throw new ShowError("database", "Could not save the sponsorship.");
  return id;
}

export type NewVolunteer = {
  buyerName: string;
  buyerEmail: string;
  phone: string;
  availability: string;
  roleInterest: string;
  shirtSize: string;
  notes: string;
  siteOrigin: string;
};

export async function createVolunteerOrder(input: NewVolunteer, pool?: Pool): Promise<number> {
  const db = resolvePool(pool);
  await ensureShowTables(db);
  const existing = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM show_orders
     WHERE kind = 'volunteer'
       AND lower(buyer_email) = lower($1)
       AND created_at > NOW() - INTERVAL '1 day'`,
    [input.buyerEmail],
  );
  if (Number(existing.rows[0]?.count ?? 0) >= 3) {
    throw new ShowError("email-limit", "You're already on the volunteer list.");
  }
  const inserted = await db.query<{ id: number }>(
    `INSERT INTO show_orders (
       kind, status, buyer_name, buyer_email, tier_id, tier_name, phone, shirt_size,
       availability, role_interest, notes, site_origin
     ) VALUES (
       'volunteer', 'received', $1, $2, 'volunteer', 'Volunteer', $3, $4,
       $5, $6, $7, $8
     ) RETURNING id`,
    [
      input.buyerName,
      input.buyerEmail,
      input.phone,
      input.shirtSize,
      input.availability,
      input.roleInterest,
      input.notes,
      input.siteOrigin,
    ],
  );
  const id = inserted.rows[0]?.id;
  if (!id) throw new ShowError("database", "Could not save the volunteer sign-up.");
  return id;
}

export async function attachStripeSession(orderId: number, sessionId: string, pool?: Pool): Promise<void> {
  const db = resolvePool(pool);
  await ensureShowTables(db);
  await db.query(`UPDATE show_orders SET stripe_session_id = $2 WHERE id = $1 AND status = 'pending'`, [
    orderId,
    sessionId,
  ]);
}

export async function cancelPendingOrder(orderId: number, pool?: Pool): Promise<void> {
  const db = resolvePool(pool);
  await ensureShowTables(db);
  await db.query(`UPDATE show_orders SET status = 'expired' WHERE id = $1 AND status = 'pending'`, [orderId]);
}

export async function releaseShowHold(sessionId: string, orderId: number | null, pool?: Pool): Promise<void> {
  const db = resolvePool(pool);
  await ensureShowTables(db);
  await withLockedClient(db, async (client) => {
    await client.query(
      `UPDATE show_orders
       SET status = 'expired'
       WHERE status = 'pending'
         AND (stripe_session_id = $1 OR ($2::int IS NOT NULL AND id = $2))`,
      [sessionId, orderId],
    );
  });
}

export type PaidCheckout = {
  sessionId: string;
  orderId: number | null;
  kind: ShowKind;
  paymentIntentId: string;
  amountCents: number;
  email: string;
  name: string;
};

function newTicketCode(): string {
  const alphabet = ticketCodeAlphabet();
  const bytes = randomBytes(16);
  let body = "";
  for (const byte of bytes) body += alphabet[byte % alphabet.length];
  return formatTicketBody(body);
}

export async function markPaidFromCheckout(input: PaidCheckout, pool?: Pool): Promise<ShowOrder> {
  const db = resolvePool(pool);
  await ensureShowTables(db);
  return withLockedClient(db, async (client) => {
    const found = await client.query<OrderRow>(
      `SELECT ${ORDER_FIELDS}
       FROM show_orders
       WHERE stripe_session_id = $1 OR ($2::int IS NOT NULL AND id = $2)
       ORDER BY CASE WHEN stripe_session_id = $1 THEN 0 ELSE 1 END
       LIMIT 1
       FOR UPDATE`,
      [input.sessionId, input.orderId],
    );
    const row = found.rows[0];
    if (!row) throw new ShowError("missing", "Order was not found.");
    if (asKind(row.kind) !== input.kind) throw new ShowError("conflict", "Order type does not match this payment.");
    if (row.stripe_session_id && row.stripe_session_id !== input.sessionId) {
      throw new ShowError("conflict", "Order is tied to another payment.");
    }
    if (row.amount_cents !== input.amountCents) throw new ShowError("amount", "Payment amount does not match the order.");
    const status = asStatus(row.status);
    if (status === "paid") {
      const existing = await client.query<TicketRow>(
        `SELECT order_id, code, tier_id, tier_name, perks, shirt_size, redeemed_at
         FROM show_tickets WHERE order_id = $1 ORDER BY id`,
        [row.id],
      );
      return mapOrder(row, existing.rows.map(mapTicket));
    }
    if (status !== "pending" && status !== "expired") throw new ShowError("conflict", "Order cannot be marked paid.");
    // A hold that already expired can still be paid because the card was charged.
    // That is the remaining oversell window if another buyer took the seats first.
    const name = input.name.trim() || row.buyer_name;
    const email = input.email.trim() || row.buyer_email;
    const updated = await client.query<OrderRow>(
      `UPDATE show_orders
       SET status = 'paid',
           stripe_session_id = $2,
           stripe_payment_intent_id = $3,
           buyer_name = $4,
           buyer_email = $5,
           paid_at = NOW()
       WHERE id = $1
       RETURNING ${ORDER_FIELDS}`,
      [row.id, input.sessionId, input.paymentIntentId, name, email],
    );
    const paid = updated.rows[0];
    if (!paid) throw new ShowError("missing", "Order was not found.");
    const existing = await client.query<TicketRow>(
      `SELECT order_id, code, tier_id, tier_name, perks, shirt_size, redeemed_at
       FROM show_tickets WHERE order_id = $1 ORDER BY id`,
      [paid.id],
    );
    const issued = existing.rows.map(mapTicket);
    if (paid.kind === "ticket") {
      let attempts = 0;
      while (issued.length < paid.quantity && attempts < paid.quantity + 5) {
        attempts += 1;
        const code = newTicketCode();
        const inserted = await client.query<TicketRow>(
          `INSERT INTO show_tickets (order_id, code, tier_id, tier_name, perks, shirt_size)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (code) DO NOTHING
           RETURNING order_id, code, tier_id, tier_name, perks, shirt_size, redeemed_at`,
          [paid.id, code, paid.tier_id, paid.tier_name, paid.perks, paid.shirt_size],
        );
        if (inserted.rows[0]) issued.push(mapTicket(inserted.rows[0]));
      }
      if (issued.length < paid.quantity) throw new ShowError("conflict", "Could not issue tickets.");
    }
    return mapOrder(paid, issued);
  });
}

export async function getShowOrder(orderId: number, pool?: Pool): Promise<ShowOrder | null> {
  const db = resolvePool(pool);
  await ensureShowTables(db);
  const result = await db.query<OrderRow>(`SELECT ${ORDER_FIELDS} FROM show_orders WHERE id = $1`, [orderId]);
  const row = result.rows[0];
  if (!row) return null;
  const tickets = await ticketsForOrders(db, [row.id]);
  return mapOrder(row, tickets.get(row.id) ?? []);
}

export async function listShowOrders(pool?: Pool): Promise<ShowOrder[]> {
  const db = resolvePool(pool);
  await ensureShowTables(db);
  const result = await db.query<OrderRow>(`SELECT ${ORDER_FIELDS} FROM show_orders ORDER BY created_at DESC, id DESC`);
  const tickets = await ticketsForOrders(
    db,
    result.rows.map((row) => row.id),
  );
  return result.rows.map((row) => mapOrder(row, tickets.get(row.id) ?? []));
}

export async function readLogo(orderId: number, pool?: Pool): Promise<{ filename: string; bytes: Buffer } | null> {
  const db = resolvePool(pool);
  await ensureShowTables(db);
  const result = await db.query<{ logo_filename: string; logo_bytes: Buffer | null }>(
    `SELECT logo_filename, logo_bytes FROM show_orders WHERE id = $1`,
    [orderId],
  );
  const row = result.rows[0];
  if (!row?.logo_bytes || row.logo_bytes.length === 0) return null;
  return { filename: row.logo_filename || "logo", bytes: row.logo_bytes };
}

export async function stampBuyerEmail(orderId: number, pool?: Pool): Promise<void> {
  const db = resolvePool(pool);
  await db.query(`UPDATE show_orders SET buyer_email_sent_at = NOW() WHERE id = $1 AND buyer_email_sent_at IS NULL`, [
    orderId,
  ]);
}

export async function stampOwnerEmail(orderId: number, pool?: Pool): Promise<void> {
  const db = resolvePool(pool);
  await db.query(
    `UPDATE show_orders SET owner_notified_at = NOW() WHERE id = $1 AND owner_notified_at IS NULL`,
    [orderId],
  );
}

export async function redeemTicket(rawCode: string, pool?: Pool): Promise<RedeemResult> {
  const code = parseTicketCode(rawCode);
  if (!code) return { status: "not_found" };
  const db = resolvePool(pool);
  await ensureShowTables(db);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query<TicketRow>(
      `UPDATE show_tickets
       SET redeemed_at = NOW()
       WHERE code = $1 AND redeemed_at IS NULL
       RETURNING order_id, code, tier_id, tier_name, perks, shirt_size, redeemed_at`,
      [code],
    );
    const row =
      updated.rows[0] ??
      (
        await client.query<TicketRow>(
          `SELECT order_id, code, tier_id, tier_name, perks, shirt_size, redeemed_at
           FROM show_tickets WHERE code = $1`,
          [code],
        )
      ).rows[0];
    await client.query("COMMIT");
    if (!row?.redeemed_at) return { status: "not_found" };
    const redeemedAt = new Date(row.redeemed_at);
    return {
      status: updated.rows[0] ? "valid" : "used",
      tierName: row.tier_name,
      shirtSize: row.shirt_size || "",
      flags: checkinFlags(parsePerkIds(row.perks || ""), row.shirt_size || ""),
      redeemedAt: redeemedAt.toISOString(),
      redeemedLabel: formatChicagoTime(redeemedAt),
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // already aborted
    }
    throw error;
  } finally {
    client.release();
  }
}
