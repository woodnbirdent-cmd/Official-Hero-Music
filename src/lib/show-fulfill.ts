import "server-only";
import type Stripe from "stripe";
import { sendOrderBuyerEmail, sendOrderOwnerEmail } from "@/lib/show-email";
import {
  ShowError,
  getShowOrder,
  markPaidFromCheckout,
  releaseShowHold,
  stampBuyerEmail,
  stampOwnerEmail,
} from "@/lib/show-store";
import type { ShowOrder } from "@/lib/show-types";

export function orderIdFromMetadata(metadata: Stripe.Metadata | null | undefined): number | null {
  const raw = metadata?.orderId;
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function paymentIntentId(session: Stripe.Checkout.Session): string {
  const value = session.payment_intent;
  if (!value) return "";
  return typeof value === "string" ? value : value.id;
}

export async function releaseShowCheckout(session: Stripe.Checkout.Session): Promise<void> {
  await releaseShowHold(session.id, orderIdFromMetadata(session.metadata));
}

async function deliverPaidEmails(order: ShowOrder): Promise<void> {
  if (!order.buyerEmailSentAt) {
    await sendOrderBuyerEmail(order);
    await stampBuyerEmail(order.id);
  }
  if (order.kind === "sponsorship" && !order.ownerNotifiedAt) {
    await sendOrderOwnerEmail(order);
    await stampOwnerEmail(order.id);
  }
}

export async function fulfillPaidCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const kind = session.metadata?.kind;
  if (kind !== "ticket" && kind !== "sponsorship") return;
  if (session.mode && session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;
  if (session.amount_total == null) throw new ShowError("amount", "Missing payment amount.");
  const order = await markPaidFromCheckout({
    sessionId: session.id,
    orderId: orderIdFromMetadata(session.metadata),
    kind,
    paymentIntentId: paymentIntentId(session),
    amountCents: session.amount_total,
    email: session.customer_details?.email || session.customer_email || "",
    name: session.customer_details?.name || session.metadata?.buyerName || "",
  });
  await deliverPaidEmails(order);
}

/** Saved sign-ups and invoice requests. Email failure stays visible on the admin row. */
export async function deliverSponsorshipNotice(orderId: number): Promise<void> {
  const order = await getShowOrder(orderId);
  if (!order) return;
  try {
    if (!order.buyerEmailSentAt) {
      await sendOrderBuyerEmail(order);
      await stampBuyerEmail(order.id);
    }
    if (!order.ownerNotifiedAt) {
      await sendOrderOwnerEmail(order);
      await stampOwnerEmail(order.id);
    }
  } catch (error) {
    console.error("Show notification email failed");
    void error;
  }
}

export async function deliverVolunteerNotice(orderId: number): Promise<void> {
  await deliverSponsorshipNotice(orderId);
}
