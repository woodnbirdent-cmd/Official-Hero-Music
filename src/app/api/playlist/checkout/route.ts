import { NextResponse } from "next/server";
import Stripe from "stripe";
import { FIRE_PLAYLIST, getPlaylistOption } from "@/lib/constants";

export const runtime = "nodejs";

const META_LIMIT = 500;

function cleanLine(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > max) return null;
  return cleaned;
}

function trackUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > META_LIMIT) return null;
  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const href = url.toString();
  if (href.length > META_LIMIT) return null;
  return href;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const optionId = typeof record.option === "string" ? record.option : "";
  const option = getPlaylistOption(optionId);
  if (!option) return NextResponse.json({ error: "Choose a submission option." }, { status: 400 });

  const artistName = cleanLine(record.artistName, 80);
  if (!artistName) return NextResponse.json({ error: "Enter the artist name." }, { status: 400 });

  const email = cleanLine(record.email, 200);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const track = trackUrl(record.trackUrl);
  if (!track) {
    return NextResponse.json(
      { error: "Enter a track link that starts with http:// or https://." },
      { status: 400 },
    );
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const stripe = new Stripe(secret);

  try {
    // Same Checkout pattern as merch: inline price_data, no pre-created Stripe Price.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: option.priceCents,
            product_data: {
              name: option.checkoutName,
              description: `${FIRE_PLAYLIST.name}. ${option.summary}`,
            },
          },
        },
      ],
      metadata: {
        kind: "playlist",
        option: option.id,
        artistName,
        email,
        trackUrl: track,
      },
      success_url: `${origin}/playlist/success?option=${option.id}`,
      cancel_url: `${origin}/playlist?canceled=1`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Playlist checkout failed", error);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
