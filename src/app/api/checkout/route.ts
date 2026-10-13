import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getProduct, MAX_QUANTITY } from "@/lib/merch";
import { hasShippingWeight, loadShippingOptions, type ShipTo } from "@/lib/shipping";
import { isUsState } from "@/lib/us-states";

export const runtime = "nodejs";

type CheckoutItem = {
  slug: string;
  size: string;
  quantity: number;
};

type ShippingInput = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
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
    if (!product || !hasShippingWeight(entry.slug)) return { error: "Unknown product." };
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

function cleanLine(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > max) return null;
  return cleaned;
}

function optionalLine(value: unknown, max: number): string | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return undefined;
  if (cleaned.length > max) return null;
  return cleaned;
}

function parseAddress(body: unknown): ShippingInput | { error: string } {
  if (!body || typeof body !== "object" || !("shipping" in body)) {
    return { error: "Enter a US shipping address." };
  }
  const shipping = (body as { shipping: unknown }).shipping;
  if (!shipping || typeof shipping !== "object") {
    return { error: "Enter a US shipping address." };
  }
  const record = shipping as Record<string, unknown>;
  const name = cleanLine(record.name, 80);
  if (!name) return { error: "Enter the recipient name." };
  const line1 = cleanLine(record.line1, 100);
  if (!line1) return { error: "Enter a street address." };
  const line2 = optionalLine(record.line2, 100);
  if (line2 === null) return { error: "Enter a valid apartment or suite." };
  const city = cleanLine(record.city, 50);
  if (!city) return { error: "Enter a city." };
  const state = typeof record.state === "string" ? record.state.trim().toUpperCase() : "";
  if (!isUsState(state)) return { error: "Choose a US state." };
  const postalCode = typeof record.postalCode === "string" ? record.postalCode.trim() : "";
  if (!/^\d{5}(?:-\d{4})?$/.test(postalCode)) return { error: "Enter a 5-digit ZIP code." };
  return { name, line1, ...(line2 ? { line2 } : {}), city, state, postalCode };
}

function shipToFromInput(address: ShippingInput): ShipTo {
  return {
    name: address.name,
    street1: address.line1,
    ...(address.line2 ? { street2: address.line2 } : {}),
    city: address.city,
    state: address.state,
    zip: address.postalCode,
  };
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
  const address = parseAddress(body);
  if ("error" in address) {
    return NextResponse.json({ error: address.error }, { status: 400 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const stripe = new Stripe(secret);
  const shipTo = shipToFromInput(address);

  try {
    const shippingOptions = await loadShippingOptions(items, shipTo);
    const customer = await stripe.customers.create({
      name: shipTo.name,
      shipping: {
        name: shipTo.name,
        address: {
          line1: shipTo.street1,
          ...(shipTo.street2 ? { line2: shipTo.street2 } : {}),
          city: shipTo.city,
          state: shipTo.state,
          postal_code: shipTo.zip,
          country: "US",
        },
      },
    });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customer.id,
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
      shipping_options: shippingOptions,
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
