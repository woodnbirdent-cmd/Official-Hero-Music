import { NextResponse } from "next/server";
import Stripe from "stripe";
import { accountsConfigured } from "@/lib/auth";
import { currentMember } from "@/lib/members";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const back = `${origin}/account`;
  if (!accountsConfigured()) {
    return NextResponse.redirect(`${back}?billing=unconfigured`);
  }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return NextResponse.redirect(`${back}?billing=unconfigured`);

  const member = await currentMember();
  if (!member) return NextResponse.redirect(`${origin}/sign-in?next=/account`);
  if (!member.stripeCustomerId) return NextResponse.redirect(`${back}?billing=none`);

  try {
    const stripe = new Stripe(secret);
    const portal = await stripe.billingPortal.sessions.create({
      customer: member.stripeCustomerId,
      return_url: back,
    });
    return NextResponse.redirect(portal.url);
  } catch (error) {
    console.error("Billing portal failed", error);
    return NextResponse.redirect(`${back}?billing=error`);
  }
}
