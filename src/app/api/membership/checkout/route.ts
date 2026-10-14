import { NextResponse } from "next/server";
import Stripe from "stripe";
import { accountsConfigured } from "@/lib/auth";
import { currentMember, saveStripeCustomerId } from "@/lib/members";
import { TIER_DETAILS, isTier, tierAtLeast } from "@/lib/tiers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!accountsConfigured()) {
    return NextResponse.json({ error: "Accounts are not configured." }, { status: 503 });
  }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const tier =
    body && typeof body === "object" && "tier" in body && isTier(body.tier) ? body.tier : null;
  if (tier !== "supporter" && tier !== "vip") {
    return NextResponse.json({ error: "Choose Supporter or VIP." }, { status: 400 });
  }

  const member = await currentMember();
  if (!member) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (tierAtLeast(member.tier, tier)) {
    return NextResponse.json({ error: "You already have this plan." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const stripe = new Stripe(secret);
  const details = TIER_DETAILS[tier];

  try {
    let customerId = member.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: member.email,
        name: member.name || undefined,
        metadata: { userId: member.id },
      });
      customerId = customer.id;
      await saveStripeCustomerId(member.id, customerId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: member.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: details.priceCents,
            recurring: { interval: "month" },
            product_data: { name: `${details.name} membership` },
          },
        },
      ],
      metadata: { userId: member.id, tier },
      subscription_data: {
        metadata: { userId: member.id, tier },
      },
      success_url: `${origin}/account?checkout=success`,
      cancel_url: `${origin}/join`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Membership checkout failed", error);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
