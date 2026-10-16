import "server-only";
import type Stripe from "stripe";
import { rememberShippoOrderId, storedShippoOrderId } from "@/lib/admin-store";
import { getPool } from "@/lib/auth";
import { getProduct } from "@/lib/merch";
import { decodeOrderItems, hasOrderItemMetadata } from "@/lib/order-items";
import { ITEM_WEIGHT_OZ, PACKAGING_WEIGHT_OZ, SHIP_FROM, hasShippingWeight } from "@/lib/shipping";

const SHIPPO_ORDERS_URL = "https://api.goshippo.com/orders/";

type ShippoLine = {
  title: string;
  quantity: number;
  total_price: string;
  currency: "USD";
  weight: string;
  weight_unit: "oz";
};

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function unitWeightOz(slug: string): number | null {
  if (!hasShippingWeight(slug)) return null;
  return ITEM_WEIGHT_OZ[slug as keyof typeof ITEM_WEIGHT_OZ];
}

function weightFromTitle(title: string): number | null {
  const lower = title.toLowerCase();
  if (lower.includes("snapback") || lower.includes("hat")) return ITEM_WEIGHT_OZ["hero-snapback"];
  if (lower.includes("tee")) return ITEM_WEIGHT_OZ["hero-tee-white"];
  return null;
}

function linesFromMetadata(session: Stripe.Checkout.Session): ShippoLine[] | null {
  if (!hasOrderItemMetadata(session.metadata)) return null;
  const decoded = decodeOrderItems(session.metadata);
  if (decoded.length === 0) return null;
  const lines: ShippoLine[] = [];
  for (const line of decoded) {
    const product = getProduct(line.slug);
    const ounces = unitWeightOz(line.slug);
    if (!product || ounces === null) return null;
    lines.push({
      title: `${product.name} (${line.size})`,
      quantity: line.quantity,
      total_price: dollars(product.priceCents * line.quantity),
      currency: "USD",
      weight: String(ounces * line.quantity),
      weight_unit: "oz",
    });
  }
  return lines;
}

function linesFromStripe(session: Stripe.Checkout.Session): ShippoLine[] | null {
  const data = session.line_items?.data;
  if (!data || data.length === 0) return null;
  const lines: ShippoLine[] = [];
  for (const item of data) {
    const quantity = item.quantity ?? 1;
    const price = item.price && typeof item.price !== "string" ? item.price.unit_amount : null;
    const cents = item.amount_total ?? (price != null ? price * quantity : null);
    const title = item.description?.trim() || "";
    const ounces = weightFromTitle(title);
    if (!title || cents === null || ounces === null || quantity < 1) return null;
    lines.push({
      title,
      quantity,
      total_price: dollars(cents),
      currency: "USD",
      weight: String(ounces * quantity),
      weight_unit: "oz",
    });
  }
  return lines;
}

function toAddress(session: Stripe.Checkout.Session): Record<string, string> | null {
  const shipping = session.collected_information?.shipping_details;
  const address = shipping?.address || session.customer_details?.address;
  const name = (shipping?.name || session.customer_details?.name || "").trim();
  const email = (session.customer_details?.email || "").trim();
  if (!address?.line1 || !address.city || !address.state || !address.postal_code || !name) return null;
  return {
    name,
    street1: address.line1,
    ...(address.line2 ? { street2: address.line2 } : {}),
    city: address.city,
    state: address.state,
    zip: address.postal_code,
    country: address.country || "US",
    ...(email ? { email } : {}),
  };
}

async function shippingChoice(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<{ method: string; cost: string }> {
  const cents = session.shipping_cost?.amount_total ?? 0;
  let rate = session.shipping_cost?.shipping_rate ?? null;
  if (typeof rate === "string") {
    try {
      rate = await stripe.shippingRates.retrieve(rate);
    } catch (error) {
      console.error("Shipping rate lookup failed", session.id, error);
      rate = null;
    }
  }
  const method = rate && typeof rate !== "string" && rate.display_name ? rate.display_name : "Shipping";
  return { method, cost: dollars(cents) };
}

async function persistShippoOrderId(stripe: Stripe, sessionId: string, shippoOrderId: string): Promise<void> {
  try {
    await rememberShippoOrderId(sessionId, shippoOrderId);
  } catch (error) {
    console.error("Shippo order id was not saved", sessionId, shippoOrderId, error);
  }
  try {
    await stripe.checkout.sessions.update(sessionId, {
      metadata: { shippoOrderId },
    });
  } catch (error) {
    console.error("Shippo order id was not saved on the checkout session", sessionId, shippoOrderId, error);
  }
}

async function savedShippoOrderId(session: Stripe.Checkout.Session): Promise<{ id: string; fromDb: string; fromMeta: string }> {
  const fromMeta = session.metadata?.shippoOrderId?.trim() || "";
  let fromDb = "";
  try {
    fromDb = (await storedShippoOrderId(session.id)) || "";
  } catch (error) {
    console.error("Shippo order id lookup failed", session.id, error);
  }
  if (fromDb && fromMeta && fromDb !== fromMeta) {
    console.error("Shippo order ids differ", session.id, fromDb, fromMeta);
  }
  return { id: fromDb || fromMeta, fromDb, fromMeta };
}

async function createShippoOrder(stripe: Stripe, sessionId: string): Promise<void> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items", "shipping_cost.shipping_rate"],
  });
  if (session.mode !== "payment" || session.payment_status !== "paid") return;
  if (session.metadata?.kind && session.metadata.kind !== "merch") return;

  const saved = await savedShippoOrderId(session);
  if (saved.id) {
    const dbReady = !getPool() || Boolean(saved.fromDb);
    if (!dbReady || saved.fromMeta !== saved.id) await persistShippoOrderId(stripe, session.id, saved.id);
    return;
  }

  const token = process.env.SHIPPO_API_TOKEN;
  if (!token) {
    console.error("Shippo order skipped: SHIPPO_API_TOKEN is not set", session.id);
    return;
  }

  const toAddressBody = toAddress(session);
  const lineItems = linesFromMetadata(session) ?? linesFromStripe(session);
  if (!toAddressBody || !lineItems) {
    console.error("Shippo order skipped: address or items are incomplete", session.id);
    return;
  }

  const itemOunces = lineItems.reduce((sum, line) => sum + Number(line.weight), 0);
  const shipping = await shippingChoice(stripe, session);
  const body = {
    to_address: toAddressBody,
    from_address: SHIP_FROM,
    line_items: lineItems,
    order_number: session.id,
    order_status: "PAID",
    placed_at: new Date(session.created * 1000).toISOString(),
    shipping_method: shipping.method,
    shipping_cost: shipping.cost,
    shipping_cost_currency: "USD",
    weight: String(itemOunces + PACKAGING_WEIGHT_OZ),
    weight_unit: "oz",
  };

  const response = await fetch(SHIPPO_ORDERS_URL, {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const detail = await response.text();
  let objectId = "";
  try {
    const payload = JSON.parse(detail) as { object_id?: unknown };
    if (typeof payload.object_id === "string") objectId = payload.object_id.trim();
  } catch {
    objectId = "";
  }
  if (!response.ok || !objectId) {
    console.error("Shippo order failed", session.id, response.status, detail.slice(0, 500));
    return;
  }

  await persistShippoOrderId(stripe, session.id, objectId);
}

/** Creates a Shippo order for a paid merch checkout. Logs and swallows errors. */
export async function syncMerchShippoOrder(stripe: Stripe, sessionId: string): Promise<void> {
  try {
    await createShippoOrder(stripe, sessionId);
  } catch (error) {
    console.error("Shippo order failed", sessionId, error);
  }
}
