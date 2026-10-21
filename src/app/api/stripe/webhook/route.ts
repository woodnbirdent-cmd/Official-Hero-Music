import { NextResponse } from "next/server";
import Stripe from "stripe";
import { accountsConfigured } from "@/lib/auth";
import { setMemberTier } from "@/lib/members";
import { syncMerchShippoOrder } from "@/lib/shippo-order";
import { TIER_RANK, isTier, tierFromPriceCents, type Tier } from "@/lib/tiers";

export const runtime = "nodejs";

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string {
  return typeof customer === "string" ? customer : customer.id;
}

function paidTier(subscription: Stripe.Subscription): Tier | null {
  const amount = subscription.items.data[0]?.price?.unit_amount;
  const fromPrice = tierFromPriceCents(amount);
  if (fromPrice) return fromPrice;
  const metadataTier = subscription.metadata?.tier;
  if (isTier(metadataTier) && metadataTier !== "free") return metadataTier;
  return null;
}

function entitled(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

async function syncCustomer(stripe: Stripe, subscription: Stripe.Subscription) {
  const stripeCustomerId = customerId(subscription.customer);
  const listed = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 20,
  });
  const subscriptions = [
    subscription,
    ...listed.data.filter((item) => item.id !== subscription.id),
  ];
  let tier: Tier = "free";
  let userId = subscription.metadata?.userId || null;
  for (const item of subscriptions) {
    if (!userId && item.metadata?.userId) userId = item.metadata.userId;
    if (!entitled(item.status)) continue;
    const paid = paidTier(item);
    if (paid && TIER_RANK[paid] > TIER_RANK[tier]) tier = paid;
  }
  await setMemberTier(tier, { userId, stripeCustomerId });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const stripe = new Stripe(secret);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    if (!accountsConfigured()) {
      return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });
    }
    try {
      await syncCustomer(stripe, event.data.object);
    } catch (error) {
      console.error("Stripe webhook failed", error);
      return NextResponse.json({ error: "Webhook failed." }, { status: 500 });
    }
  }

  if (event.type === "checkout.session.completed" && event.data.object.mode === "payment") {
    const session = event.data.object;
    if (session.metadata?.kind === "playlist") {
      console.log(
        "[#Hero form:playlist]",
        JSON.stringify({
          sessionId: session.id,
          option: session.metadata.option,
          artistName: session.metadata.artistName,
          email: session.metadata.email,
          trackUrl: session.metadata.trackUrl,
        }),
      );
    } else {
      await syncMerchShippoOrder(stripe, session.id);
    }
  }

  return NextResponse.json({ received: true });
}
