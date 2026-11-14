import "server-only";

import type { Pool } from "pg";
import { requireAdmin } from "@/lib/admin";
import { getPool } from "@/lib/auth";
import {
  parseBookingFields,
  sendBookingNotification,
  type BookingFields,
  type BookingInput,
} from "@/lib/bookings";

/**
 * Booking requests from /booking.
 * Created on first use with CREATE TABLE IF NOT EXISTS, same as mailing_list.
 * Additive only: no drops, renames, or column changes.
 */
const CREATE_BOOKING_REQUESTS = `CREATE TABLE IF NOT EXISTS booking_requests (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  org text NOT NULL DEFAULT '',
  event_date date,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_requests_name_length CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT booking_requests_email_length CHECK (char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT booking_requests_org_length CHECK (char_length(org) <= 200),
  CONSTRAINT booking_requests_message_length CHECK (char_length(message) BETWEEN 1 AND 4000)
)`;

export type BookingRow = {
  id: string;
  name: string;
  email: string;
  org: string;
  eventDate: string;
  message: string;
  createdAt: Date;
};

let ready: Promise<void> | null = null;

export async function ensureBookingRequests(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  if (!ready) {
    ready = applyBookingRequests(pool).catch((error: unknown) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

async function applyBookingRequests(pool: Pool): Promise<void> {
  await pool.query(CREATE_BOOKING_REQUESTS);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS booking_requests_created_at_idx ON booking_requests (created_at DESC)`,
  );
}

async function insertBooking(booking: BookingFields): Promise<Date | null> {
  const pool = getPool();
  if (!pool) {
    console.error("Booking save failed");
    return null;
  }
  try {
    await ensureBookingRequests();
    const result = await pool.query<{ created_at: Date }>(
      `INSERT INTO booking_requests (name, email, org, event_date, message)
       VALUES ($1, $2, $3, NULLIF($4, '')::date, $5)
       RETURNING created_at`,
      [booking.name, booking.email, booking.org, booking.eventDate, booking.message],
    );
    const createdAt = result.rows[0]?.created_at;
    if (!createdAt) {
      console.error("Booking save failed");
      return null;
    }
    return new Date(createdAt);
  } catch {
    console.error("Booking save failed");
    return null;
  }
}

/** Save first. A mail failure still counts as received. */
export async function acceptBooking(
  input: BookingInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = parseBookingFields(input);
  if (!parsed.ok) return parsed;
  if (parsed.spam) return { ok: true };
  const createdAt = await insertBooking(parsed.value);
  if (!createdAt) return { ok: false, error: "Something went wrong" };
  try {
    await sendBookingNotification({ ...parsed.value, submittedAt: createdAt });
  } catch {
    console.error("Booking notification failed");
  }
  console.log("[#Hero form:booking] received");
  return { ok: true };
}

export async function listBookingRequests(): Promise<{ rows: BookingRow[]; error: string }> {
  await requireAdmin();
  const pool = getPool();
  if (!pool) return { rows: [], error: "Database is not configured." };
  try {
    await ensureBookingRequests();
    const result = await pool.query<{
      id: string;
      name: string;
      email: string;
      org: string;
      event_date: string;
      message: string;
      created_at: Date;
    }>(
      `SELECT id::text AS id, name, email, org,
              COALESCE(to_char(event_date, 'YYYY-MM-DD'), '') AS event_date,
              message, created_at
       FROM booking_requests
       ORDER BY created_at DESC
       LIMIT 200`,
    );
    return {
      error: "",
      rows: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        org: row.org,
        eventDate: row.event_date,
        message: row.message,
        createdAt: new Date(row.created_at),
      })),
    };
  } catch {
    console.error("Booking list failed");
    return { rows: [], error: "Booking requests could not be loaded." };
  }
}
