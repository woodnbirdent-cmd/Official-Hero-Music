import { NextResponse } from "next/server";
import Stripe from "stripe";
import { describePerks } from "@/lib/show-codes";
import { SHOW, perkStorage } from "@/lib/show-config";
import { requestIsSameOrigin, siteOriginFromRequest } from "@/lib/show-http";
import { parseTicketFields } from "@/lib/show-input";
import { showStripeSecret } from "@/lib/show-stripe";
import {
  ShowError,
  attachStripeSession,
  cancelPendingOrder,
  reserveTicketOrder,
  showErrorStatus,
} from "@/lib/show-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const parsed = parseTicketFields({
    tierId: record.tierId,
    quantity: record.quantity,
    shirtSize: record.shirtSize,
    name: record.name,
    email: record.email,
  });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const secret = showStripeSecret();
  if (!secret) {
    if (process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") && process.env.VERCEL_ENV !== "production") {
      console.error("Show checkout refused a live Stripe key outside production.");
    }
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 503 });
  }

  const { tier, quantity, shirtSize, name, email } = parsed.value;
  const origin = siteOriginFromRequest(request.url);
  const stripe = new Stripe(secret);
  let orderId: number | null = null;
  let sessionId: string | null = null;
  try {
    const reserved = await reserveTicketOrder({
      tierId: tier.id,
      tierName: tier.name,
      perks: tier.perks,
      quantity,
      unitAmountCents: tier.priceCents,
      shirtSize,
      buyerName: name,
      buyerEmail: email,
      siteOrigin: origin,
    });
    orderId = reserved.id;
    const perks = describePerks(tier.perks, shirtSize).join(", ");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      expires_at: Math.floor(reserved.expiresAt.getTime() / 1000),
      line_items: [
        {
          quantity,
          price_data: {
            currency: "usd",
            unit_amount: tier.priceCents,
            product_data: {
              name: `${SHOW.name} — ${tier.name}`,
              description: (perks || tier.summary).slice(0, 400),
            },
          },
        },
      ],
      metadata: {
        kind: "ticket",
        orderId: String(orderId),
        tier: tier.id,
        quantity: String(quantity),
        shirtSize,
        perks: perkStorage(tier.perks),
        buyerName: name,
      },
      success_url: `${origin}/tickets/success?kind=ticket&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/tickets?canceled=1`,
    });
    sessionId = session.id;
    await attachStripeSession(orderId, session.id);
    if (!session.url) throw new Error("Missing checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (sessionId) await stripe.checkout.sessions.expire(sessionId).catch(() => undefined);
    if (orderId) await cancelPendingOrder(orderId).catch(() => undefined);
    if (error instanceof ShowError) {
      return NextResponse.json({ error: error.message }, { status: showErrorStatus(error) });
    }
    console.error("Ticket checkout failed");
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
