import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getProduct, MAX_QUANTITY, SHIPPING_FLAT_CENTS } from "@/lib/merch";

export const runtime = "nodejs";

type CheckoutItem = {
  slug: string;
  size: string;
  quantity: number;
};

function isCheckoutItem(value: unknown): value is CheckoutItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.slug === "string" &&
    typeof item.size === "string" &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity)
  );
}

function parseItems(body: unknown): CheckoutItem[] | { error: string } {
  if (!body || typeof body !== "object" || !("items" in body) || !Array.isArray(body.items)) {
    return { error: "Cart is empty." };
  }
  if (body.items.length === 0) return { error: "Cart is empty." };
  if (body.items.length > 20) return { error: "Cart is too large." };

  const merged = new Map<string, CheckoutItem>();
  for (const entry of body.items) {
    if (!isCheckoutItem(entry)) return { error: "Invalid cart item." };
    const product = getProduct(entry.slug);
    if (!product) return { error: "Unknown product." };
    if (!product.sizes.includes(entry.size)) return { error: "Choose a valid size." };
    if (entry.quantity < 1 || entry.quantity > MAX_QUANTITY) {
      return { error: `Quantity must be between 1 and ${MAX_QUANTITY}.` };
    }
    const key = `${entry.slug}\0${entry.size}`;
    const previous = merged.get(key);
    const quantity = (previous?.quantity ?? 0) + entry.quantity;
    if (quantity > MAX_QUANTITY) {
      return { error: `Quantity must be between 1 and ${MAX_QUANTITY}.` };
    }
    merged.set(key, { slug: entry.slug, size: entry.size, quantity });
  }

  if (merged.size === 0) return { error: "Cart is empty." };
  return [...merged.values()];
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const items = parseItems(body);
  if ("error" in items) {
    return NextResponse.json({ error: items.error }, { status: 400 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const stripe = new Stripe(secret);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: items.map((item) => {
        const product = getProduct(item.slug);
        if (!product) throw new Error("Unknown product.");
        return {
          quantity: item.quantity,
          price_data: {
            currency: "usd",
            unit_amount: product.priceCents,
            product_data: {
              name: `${product.name} (${item.size})`,
              description: product.summary,
            },
          },
        };
      }),
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      // Flat rate from SHIPPING_FLAT_CENTS. TODO: Shippo live rates.
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: "US shipping",
            fixed_amount: {
              amount: SHIPPING_FLAT_CENTS,
              currency: "usd",
            },
          },
        },
      ],
      success_url: `${origin}/merch/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/merch/cancel`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout failed", error);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
