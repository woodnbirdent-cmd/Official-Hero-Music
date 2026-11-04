export const ORDER_TYPES = ["merch", "feature-verse", "playlist", "other"] as const;

export type OrderType = (typeof ORDER_TYPES)[number];

export type OrderDetail = {
  label: string;
  value: string;
  href?: string;
};

export type CheckoutCustomField = {
  key?: string | null;
  label?: { custom?: string | null } | null;
  text?: { value?: string | null } | null;
  numeric?: { value?: string | null } | null;
  dropdown?: { value?: string | null } | null;
};

export type CustomerOrder = {
  id: string;
  created: number;
  customerName: string;
  customerEmail: string;
  totalCents: number;
  type: OrderType;
  typeLabel: string;
  itemSummary: string;
  shippingAddress: string;
  shippingRate: string;
  artistName: string;
  trackUrl: string;
  details: OrderDetail[];
};

export type AdminCustomer<T extends CustomerOrder = CustomerOrder> = {
  key: string;
  email: string;
  name: string;
  orderCount: number;
  totalCents: number;
  orders: T[];
};

const CHICAGO = "America/Chicago";

const HIDDEN_METADATA = new Set([
  "kind",
  "option",
  "items",
  "shippoorderid",
  "userid",
  "tier",
  "email",
]);

export function formatChicago(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function isOrderType(value: string | undefined | null): value is OrderType {
  return ORDER_TYPES.some((type) => type === value);
}

export function safeHttpUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function playlistTypeLabel(option: string, labels: string): string {
  if (option === "guaranteed" || labels.includes("guaranteed")) return "Guaranteed placement";
  if (option === "listen" || labels.includes("listen and decide")) return "Listen and decide";
  return "Playlist";
}

/**
 * Site checkouts set metadata.kind. Feature-verse sales are Stripe Payment Links,
 * which show up as a payment_link on the Checkout Session.
 */
export function classifyCheckout(input: {
  metadata?: Record<string, string> | null;
  paymentLinkId?: string | null;
  mode?: string | null;
  lineLabels?: string[];
}): { type: OrderType; typeLabel: string } {
  const metadata = input.metadata || {};
  const kind = (metadata.kind || "").trim().toLowerCase();
  const option = (metadata.option || "").trim().toLowerCase();
  const labels = (input.lineLabels || []).join(" \n ").toLowerCase();

  if (kind === "merch") return { type: "merch", typeLabel: "Merch" };
  if (kind === "playlist") return { type: "playlist", typeLabel: playlistTypeLabel(option, labels) };

  const blob = `${kind} ${option} ${labels}`;
  if (kind === "feature-verse" || kind === "feature_verse" || kind === "featureverse" || /feature[\s-]*verse/.test(blob)) {
    return { type: "feature-verse", typeLabel: "Feature verse" };
  }

  if (input.paymentLinkId) {
    return { type: "feature-verse", typeLabel: "Feature verse" };
  }

  if (input.mode === "subscription" || metadata.tier === "vip" || metadata.tier === "supporter") {
    if (metadata.tier === "vip") return { type: "other", typeLabel: "VIP membership" };
    if (metadata.tier === "supporter") return { type: "other", typeLabel: "Supporter membership" };
    return { type: "other", typeLabel: "Membership" };
  }

  return { type: "other", typeLabel: "Other" };
}

function customFieldValue(field: CheckoutCustomField): string {
  return (field.text?.value || field.numeric?.value || field.dropdown?.value || "").trim();
}

export function customFieldDetails(fields: CheckoutCustomField[] | null | undefined): OrderDetail[] {
  if (!fields) return [];
  const details: OrderDetail[] = [];
  for (const field of fields) {
    const value = customFieldValue(field);
    if (!value) continue;
    const label = field.label?.custom?.trim() || field.key?.trim() || "Detail";
    const href = safeHttpUrl(value);
    details.push({ label, value, ...(href ? { href } : {}) });
  }
  return details;
}

function metaLabel(key: string): string | null {
  if (HIDDEN_METADATA.has(key.toLowerCase()) || /^items_\d+$/.test(key)) return null;
  const normalized = key.toLowerCase().replace(/[_-]/g, "");
  if (normalized === "artistname" || normalized === "artist") return "Artist";
  if (["trackurl", "track", "spotify", "songurl", "songlink"].includes(normalized)) return "Spotify track";
  if (!/artist|track|spotify|song|verse|feature/.test(normalized)) return null;
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pushDetail(details: OrderDetail[], seen: Set<string>, label: string, value: string) {
  const cleaned = value.trim();
  if (!cleaned) return;
  const key = `${label.toLowerCase()}::${cleaned.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  const href = safeHttpUrl(cleaned);
  details.push({ label, value: cleaned, ...(href ? { href } : {}) });
}

export function orderDetails(input: {
  type: OrderType;
  metadata?: Record<string, string> | null;
  customFields?: CheckoutCustomField[] | null;
}): { details: OrderDetail[]; artistName: string; trackUrl: string } {
  const metadata = input.metadata || {};
  const details: OrderDetail[] = [];
  const seen = new Set<string>();

  if (input.type === "playlist" || input.type === "feature-verse") {
    for (const [key, value] of Object.entries(metadata)) {
      const label = metaLabel(key);
      if (!label || typeof value !== "string") continue;
      pushDetail(details, seen, label, value);
    }
  }

  for (const field of customFieldDetails(input.customFields)) {
    pushDetail(details, seen, field.label, field.value);
  }

  const artistName = details.find((detail) => detail.label === "Artist")?.value || "";
  const trackUrl =
    details.find((detail) => detail.label === "Spotify track" && detail.href)?.href ||
    details.find((detail) => /spotify|track|song/i.test(detail.label) && detail.href)?.href ||
    "";

  return { details, artistName, trackUrl };
}

function orderHaystack(order: CustomerOrder): string {
  return [
    order.customerName,
    order.customerEmail,
    order.itemSummary,
    order.shippingAddress,
    order.shippingRate,
    order.typeLabel,
    order.artistName,
    order.trackUrl,
    ...order.details.map((detail) => `${detail.label} ${detail.value}`),
  ]
    .join(" ")
    .toLowerCase();
}

export function filterOrders<T extends CustomerOrder>(orders: T[], type: string, query: string): T[] {
  const kind = isOrderType(type) ? type : "";
  const needle = query.trim().toLowerCase();
  return orders.filter((order) => {
    if (kind && order.type !== kind) return false;
    if (!needle) return true;
    return orderHaystack(order).includes(needle);
  });
}

export function groupCustomers<T extends CustomerOrder>(orders: T[]): AdminCustomer<T>[] {
  const grouped = new Map<string, T[]>();
  for (const order of orders) {
    const email = order.customerEmail.trim().toLowerCase();
    const key = email || `session:${order.id}`;
    const list = grouped.get(key) ?? [];
    list.push(order);
    grouped.set(key, list);
  }

  const customers: AdminCustomer<T>[] = [];
  for (const [key, list] of grouped) {
    const sorted = [...list].sort((a, b) => b.created - a.created);
    const email = sorted.find((order) => order.customerEmail.trim())?.customerEmail.trim() || "";
    const name = sorted.find((order) => order.customerName.trim())?.customerName.trim() || "";
    customers.push({
      key,
      email,
      name,
      orderCount: sorted.length,
      totalCents: sorted.reduce((sum, order) => sum + order.totalCents, 0),
      orders: sorted,
    });
  }

  customers.sort((a, b) => (b.orders[0]?.created ?? 0) - (a.orders[0]?.created ?? 0));
  return customers;
}

export function filterCustomers<T extends CustomerOrder>(customers: AdminCustomer<T>[], type: string, query: string): AdminCustomer<T>[] {
  return customers.filter((customer) => filterOrders(customer.orders, type, query).length > 0);
}
