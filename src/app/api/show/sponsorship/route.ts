import { NextResponse } from "next/server";
import Stripe from "stripe";
import { SHOW, TICKET_HOLD_MINUTES } from "@/lib/show-config";
import { requestIsSameOrigin, siteOriginFromRequest } from "@/lib/show-http";
import { parseSponsorshipFields } from "@/lib/show-input";
import { MAX_LOGO_BYTES, detectLogo, safeLogoFilename } from "@/lib/show-logo";
import { showStripeSecret } from "@/lib/show-stripe";
import { deliverSponsorshipNotice } from "@/lib/show-fulfill";
import {
  ShowError,
  attachStripeSession,
  cancelPendingOrder,
  createSponsorshipOrder,
  showErrorStatus,
} from "@/lib/show-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 403 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const logoDelivery = form.get("logoDelivery") === "email" ? "email" : "upload";
  const file = form.get("logo");
  const upload = logoDelivery === "upload" && file instanceof File && file.size > 0 ? file : null;
  let logoBytes: Buffer | null = null;
  let logoFilename = "";
  if (upload) {
    if (upload.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Logo must be 2 MB or smaller." }, { status: 400 });
    }
    const bytes = Buffer.from(await upload.arrayBuffer());
    if (!detectLogo(bytes)) {
      return NextResponse.json({ error: "Logo must be a PNG, JPEG, or WebP image." }, { status: 400 });
    }
    logoBytes = bytes;
    logoFilename = safeLogoFilename(upload.name);
  }

  const parsed = parseSponsorshipFields({
    tierId: form.get("tierId"),
    payment: form.get("payment"),
    amount: form.get("amount"),
    name: form.get("name"),
    email: form.get("email"),
    phone: form.get("phone"),
    businessName: form.get("businessName"),
    logoDelivery,
    hasLogo: Boolean(logoBytes),
  });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const value = parsed.value;
  const origin = siteOriginFromRequest(request.url);
  const expiresAt = value.payment === "card" ? new Date(Date.now() + TICKET_HOLD_MINUTES * 60 * 1000) : null;
  let orderId: number | null = null;
  try {
    orderId = await createSponsorshipOrder({
      status: value.payment === "card" ? "pending" : "unpaid",
      sponsorType: value.sponsorType,
      tierId: value.tierId,
      tierName: value.tierName,
      amountCents: value.amountCents,
      buyerName: value.buyerName,
      buyerEmail: value.buyerEmail,
      phone: value.phone,
      businessName: value.businessName,
      logoDelivery: value.logoDelivery,
      logoFilename: value.logoDelivery === "upload" ? logoFilename : "",
      logoBytes: value.logoDelivery === "upload" ? logoBytes : null,
      siteOrigin: origin,
      expiresAt,
    });
  } catch (error) {
    if (error instanceof ShowError) {
      return NextResponse.json({ error: error.message }, { status: showErrorStatus(error) });
    }
    console.error("Sponsorship save failed");
    return NextResponse.json({ error: "Could not save the sponsorship." }, { status: 500 });
  }

  if (value.payment === "invoice") {
    await deliverSponsorshipNotice(orderId);
    return NextResponse.json({ ok: true, next: "/tickets/success?kind=sponsorship&method=invoice" });
  }

  const secret = showStripeSecret();
  if (!secret) {
    await cancelPendingOrder(orderId).catch(() => undefined);
    if (process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") && process.env.VERCEL_ENV !== "production") {
      console.error("Show checkout refused a live Stripe key outside production.");
    }
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 503 });
  }

  const stripe = new Stripe(secret);
  let sessionId: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: value.buyerEmail,
      expires_at: Math.floor((expiresAt ?? new Date()).getTime() / 1000),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: value.amountCents,
            product_data: {
              name: `${SHOW.name} sponsorship — ${value.tierName}`,
              description: value.businessName
                ? `${value.tierName} sponsorship for ${value.businessName}`.slice(0, 400)
                : `${value.tierName} sponsorship`.slice(0, 400),
            },
          },
        },
      ],
      metadata: {
        kind: "sponsorship",
        orderId: String(orderId),
        tier: value.tierId,
        buyerName: value.buyerName,
      },
      success_url: `${origin}/tickets/success?kind=sponsorship&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/tickets?canceled=1`,
    });
    sessionId = session.id;
    await attachStripeSession(orderId, session.id);
    if (!session.url) throw new Error("Missing checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (sessionId) await stripe.checkout.sessions.expire(sessionId).catch(() => undefined);
    await cancelPendingOrder(orderId).catch(() => undefined);
    if (error instanceof ShowError) {
      return NextResponse.json({ error: error.message }, { status: showErrorStatus(error) });
    }
    console.error("Sponsorship checkout failed");
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
