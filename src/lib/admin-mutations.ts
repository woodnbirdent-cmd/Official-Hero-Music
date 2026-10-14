import "server-only";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/admin";
import { clearAdminStripeCache } from "@/lib/admin-data";
import { ensureAdminTables, recordActivity, writeActivity } from "@/lib/admin-store";
import { getPool } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SESSION_ID = /^cs_[A-Za-z0-9]+$/;
const USER_ID = /^[A-Za-z0-9_-]{1,128}$/;

function stripeClient(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret);
}

function stripeError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && error.code === "resource_missing") {
    return "missing";
  }
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message.slice(0, 300);
  }
  return "Stripe request failed.";
}

async function cancelSubscriptions(stripe: Stripe, customerId: string): Promise<string[]> {
  const canceled: string[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < 5; page += 1) {
    const listed = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      starting_after: startingAfter,
    });
    for (const subscription of listed.data) {
      if (subscription.status === "canceled" || subscription.status === "incomplete_expired") continue;
      await stripe.subscriptions.cancel(subscription.id, { prorate: false, invoice_now: false });
      canceled.push(subscription.id);
    }
    if (!listed.has_more || listed.data.length === 0) break;
    startingAfter = listed.data[listed.data.length - 1]?.id;
  }
  return canceled;
}

export async function deleteMemberAccount(input: {
  userId: string;
  confirmEmail: string;
  deleteStripeCustomer: boolean;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!USER_ID.test(input.userId)) return { ok: false, error: "Unknown member." };

  const pool = getPool();
  if (!pool) return { ok: false, error: "Database is not configured." };
  await ensureAdminTables();

  const found = await pool.query<{ id: string; email: string; name: string; stripeCustomerId: string | null }>(
    `SELECT id, email, name, "stripeCustomerId" FROM "user" WHERE id = $1`,
    [input.userId],
  );
  const member = found.rows[0];
  if (!member) return { ok: false, error: "That member is already gone." };

  const typed = input.confirmEmail.trim().toLowerCase();
  if (!typed || typed !== member.email.trim().toLowerCase()) {
    return { ok: false, error: "Type the member's email to confirm." };
  }
  if (member.id === admin.id || member.email.trim().toLowerCase() === admin.email.trim().toLowerCase()) {
    return { ok: false, error: "You can't delete your own admin account." };
  }

  const stripe = stripeClient();
  if (member.stripeCustomerId && !stripe) {
    return { ok: false, error: "Stripe is not configured, so this member's subscription cannot be canceled." };
  }

  let canceled: string[] = [];
  let customerDeleted = false;
  if (stripe && member.stripeCustomerId) {
    try {
      canceled = await cancelSubscriptions(stripe, member.stripeCustomerId);
    } catch (error) {
      console.error("Subscription cancel failed", error);
      const message = stripeError(error);
      return { ok: false, error: message === "missing" ? "Stripe customer was not found." : message };
    }
    if (input.deleteStripeCustomer) {
      try {
        await stripe.customers.del(member.stripeCustomerId);
        customerDeleted = true;
      } catch (error) {
        const message = stripeError(error);
        if (message !== "missing") {
          console.error("Stripe customer delete failed", error);
          return {
            ok: false,
            error: `Subscriptions were canceled, but the Stripe customer was not deleted. ${message}`,
          };
        }
        customerDeleted = true;
      }
    }
  }

  const detail = [
    canceled.length ? `Canceled ${canceled.join(", ")}.` : "No subscription to cancel.",
    customerDeleted ? "Stripe customer deleted." : "Stripe customer kept.",
  ].join(" ");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM "session" WHERE "userId" = $1`, [member.id]);
    await client.query(`DELETE FROM "account" WHERE "userId" = $1`, [member.id]);
    const removed = await client.query(`DELETE FROM "user" WHERE id = $1`, [member.id]);
    if (removed.rowCount !== 1) throw new Error("Member was not deleted.");
    await writeActivity(client, admin, "Deleted member", member.email, detail);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_")) {
      throw error;
    }
    console.error("Member delete failed", error);
    return { ok: false, error: "The account could not be deleted." };
  } finally {
    client.release();
  }

  clearAdminStripeCache();
  return { ok: true };
}

export async function refundMerchOrder(sessionId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!SESSION_ID.test(sessionId)) return { ok: false, error: "Unknown order." };
  const stripe = stripeClient();
  if (!stripe) return { ok: false, error: "Stripe is not configured." };
  const pool = getPool();
  if (!pool) return { ok: false, error: "Database is not configured." };
  await ensureAdminTables();

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.latest_charge"],
    });
  } catch (error) {
    console.error("Checkout lookup failed", error);
    return { ok: false, error: stripeError(error) === "missing" ? "That order was not found in Stripe." : "Stripe could not load the order." };
  }

  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return { ok: false, error: "This checkout is not a paid merch order." };
  }

  const paymentIntent = session.payment_intent;
  if (!paymentIntent) return { ok: false, error: "This order has no Stripe payment to refund." };
  const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
  let charge = typeof paymentIntent === "string" ? null : paymentIntent.latest_charge;
  if (typeof charge === "string") {
    charge = await stripe.charges.retrieve(charge);
  }
  const stored = await pool.query<{ refunded_cents: number }>(
    `SELECT refunded_cents FROM order_fulfillment WHERE session_id = $1`,
    [sessionId],
  );
  const already = Math.max(
    charge && typeof charge !== "string" ? charge.amount_refunded || 0 : 0,
    Number(stored.rows[0]?.refunded_cents) || 0,
  );
  const total = session.amount_total ?? 0;
  const remaining = total - already;
  if (remaining <= 0) return { ok: false, error: "This payment is already refunded." };

  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId, amount: remaining },
      { idempotencyKey: `admin-refund-${sessionId}-${remaining}` },
    );
  } catch (error) {
    console.error("Stripe refund failed", error);
    return { ok: false, error: stripeError(error) };
  }

  const refundedCents = already + (refund.amount ?? remaining);
  await pool.query(
    `INSERT INTO order_fulfillment (session_id, fulfilled, refunded_cents, updated_at)
     VALUES ($1, false, $2, NOW())
     ON CONFLICT (session_id) DO UPDATE
       SET refunded_cents = GREATEST(order_fulfillment.refunded_cents, EXCLUDED.refunded_cents),
           updated_at = NOW()`,
    [sessionId, refundedCents],
  );
  await recordActivity(admin, "Refunded order", sessionId, `${refundedCents} cents refunded. The Stripe payment was not deleted.`);
  clearAdminStripeCache();
  return { ok: true };
}
