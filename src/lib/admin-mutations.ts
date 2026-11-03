import "server-only";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/admin";
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
  await requireAdmin();
  if (!sessionId) return { ok: false, error: "Orders are read-only. Refunds are not available here." };
  return { ok: false, error: "Orders are read-only. Refunds are not available here." };
}
