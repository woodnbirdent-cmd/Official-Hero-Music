import "server-only";
import Stripe from "stripe";
import { adminGate, requireAdmin } from "@/lib/admin";
import {
  ADMIN_REAUTH_SECONDS,
  CANCEL_SUBSCRIPTION_PHRASE,
  DELETE_CUSTOMER_PHRASE,
  phraseMatches,
  sessionIsFresh,
} from "@/lib/admin-security";
import { clearAdminStripeCache } from "@/lib/admin-data";
import { ensureAdminTables, writeActivity } from "@/lib/admin-store";
import { getPool } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

const USER_ID = /^[A-Za-z0-9_-]{1,128}$/;

function stripeClient(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret);
}

function stripeMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "resource_missing");
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
  cancelSubscription: boolean;
  cancelPhrase: string;
  deleteStripeCustomer: boolean;
  deleteCustomerPhrase: string;
}): Promise<ActionResult> {
  const gate = await adminGate();
  if (!gate.ok || !sessionIsFresh(gate.sessionCreatedAt, ADMIN_REAUTH_SECONDS)) {
    return { ok: false, error: "Sign in again before changing a member or a Stripe subscription." };
  }
  const admin = gate.member;
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

  const wantsCancel = input.cancelSubscription;
  if (wantsCancel && !phraseMatches(input.cancelPhrase, CANCEL_SUBSCRIPTION_PHRASE)) {
    return { ok: false, error: "Type CANCEL SUBSCRIPTION to cancel the Stripe subscription." };
  }
  const wantsDeleteCustomer = input.deleteStripeCustomer;
  if (wantsDeleteCustomer && !phraseMatches(input.deleteCustomerPhrase, DELETE_CUSTOMER_PHRASE)) {
    return { ok: false, error: "Type DELETE STRIPE CUSTOMER to delete the Stripe customer." };
  }

  const stripe = wantsCancel || wantsDeleteCustomer ? stripeClient() : null;
  if ((wantsCancel || wantsDeleteCustomer) && member.stripeCustomerId && !stripe) {
    return { ok: false, error: "Stripe is not configured, so this member's subscription was left unchanged." };
  }

  let canceled: string[] = [];
  let customerDeleted = false;
  if (stripe && member.stripeCustomerId && wantsCancel) {
    try {
      canceled = await cancelSubscriptions(stripe, member.stripeCustomerId);
    } catch (error) {
      console.error("Subscription cancel failed", stripeMissing(error) ? "missing" : "stripe_error");
      return {
        ok: false,
        error: stripeMissing(error) ? "Stripe customer was not found." : "Stripe could not cancel the subscription.",
      };
    }
  }
  if (stripe && member.stripeCustomerId && wantsDeleteCustomer) {
    try {
      await stripe.customers.del(member.stripeCustomerId);
      customerDeleted = true;
    } catch (error) {
      if (!stripeMissing(error)) {
        console.error("Stripe customer delete failed", "stripe_error");
        return { ok: false, error: "The Stripe customer was not deleted. The member account was not removed." };
      }
      customerDeleted = true;
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
    console.error("Member delete failed");
    return { ok: false, error: "The account could not be deleted." };
  } finally {
    client.release();
  }

  clearAdminStripeCache();
  return { ok: true };
}

export async function refundMerchOrder(sessionId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!sessionId) return { ok: false, error: "Orders are read-only. Refunds are not available here." };
  return { ok: false, error: "Orders are read-only. Refunds are not available here." };
}
