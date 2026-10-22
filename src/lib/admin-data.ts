import "server-only";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/admin";
import { ensureAdminTables, recordActivity } from "@/lib/admin-store";
import { getPool } from "@/lib/auth";
import { ensureSchema } from "@/lib/members";
import { formatMoney } from "@/lib/merch";
import {
  decodeOrderItems,
  hasOrderItemMetadata,
  orderLineLabel,
  type OrderLine,
} from "@/lib/order-items";
import { isTier, tierFromPriceCents, type Tier } from "@/lib/tiers";

const CACHE_MS = 60_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const LINE_ITEM_LOOKUPS = 40;

export type AdminOrder = {
  id: string;
  created: number;
  customerName: string;
  customerEmail: string;
  items: OrderLine[];
  itemSummary: string;
  shippingAddress: string;
  shippingRate: string;
  totalCents: number;
  fulfilled: boolean;
  archived: boolean;
  paymentIntentId: string | null;
  refundedCents: number;
  shippoOrderId: string | null;
  dashboardUrl: string;
};

export type AdminMember = {
  id: string;
  email: string;
  name: string;
  tier: Tier;
  status: string;
  joined: Date;
  stripeCustomerId: string | null;
  stripeCustomerUrl: string | null;
};

export type AdminSubscription = {
  id: string;
  status: string;
  email: string;
  name: string;
  customerId: string;
  tierLabel: string;
  amountCents: number;
  interval: string;
  created: number;
  mrrCents: number;
  dashboardUrl: string;
};

export type AdminData = {
  stripeConfigured: boolean;
  stripeError: string | null;
  truncated: boolean;
  databaseError: string | null;
  cachedAt: number | null;
  revenue: {
    month: { merch: number; subscriptions: number };
    allTime: { merch: number; subscriptions: number };
  };
  tiers: { free: number; supporter: number; vip: number; other: number };
  mrrCents: number;
  pastDue: number;
  signups30d: number;
  recentSignups: { email: string; name: string; joined: Date }[];
  orders: AdminOrder[];
  members: AdminMember[];
  subscriptions: AdminSubscription[];
};

type StripeSnapshot = {
  orders: Omit<AdminOrder, "fulfilled" | "archived">[];
  subscriptionRevenue: { created: number; amount: number }[];
  subscriptions: AdminSubscription[];
  truncated: boolean;
  livemode: boolean;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  tier: string;
  stripeCustomerId: string | null;
  createdAt: Date;
};

let stripeCache: { expires: number; value: StripeSnapshot } | null = null;

export function clearAdminStripeCache(): void {
  stripeCache = null;
}

function stripeClient(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret);
}

function livemodeFromKey(): boolean {
  return (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live");
}

export function stripeDashboardUrl(path: string, livemode = livemodeFromKey()): string {
  const prefix = livemode ? "" : "/test";
  return `https://dashboard.stripe.com${prefix}${path}`;
}

function monthStartUnix(): number {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
}

async function paginate<T extends { id: string }>(
  fetchPage: (startingAfter?: string) => Promise<Stripe.ApiList<T>>,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await fetchPage(startingAfter);
    rows.push(...result.data);
    if (!result.has_more || result.data.length === 0) return { rows, truncated: false };
    const last = result.data[result.data.length - 1];
    if (!last) return { rows, truncated: false };
    startingAfter = last.id;
  }
  return { rows, truncated: true };
}

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string {
  if (!customer) return "";
  return typeof customer === "string" ? customer : customer.id;
}

function addressLines(name: string | null | undefined, address: Stripe.Address | null | undefined): string {
  if (!address && !name) return "";
  const cityLine = [address?.city, address?.state, address?.postal_code].filter(Boolean).join(", ");
  return [name, address?.line1, address?.line2, cityLine, address?.country].filter(Boolean).join("\n");
}

function shippingRateLabel(session: Stripe.Checkout.Session): string {
  const cost = session.shipping_cost;
  if (!cost) return "";
  const amount = formatMoney(cost.amount_total);
  const rate = cost.shipping_rate;
  if (rate && typeof rate !== "string" && rate.display_name) {
    return `${rate.display_name} (${amount})`;
  }
  return `Shipping (${amount})`;
}

function linesFromSession(session: Stripe.Checkout.Session): OrderLine[] {
  if (!hasOrderItemMetadata(session.metadata)) return [];
  return decodeOrderItems(session.metadata);
}

async function lookupMissingItems(
  stripe: Stripe,
  sessions: Stripe.Checkout.Session[],
): Promise<Map<string, OrderLine[]>> {
  const missing = sessions.filter((session) => !hasOrderItemMetadata(session.metadata)).slice(0, LINE_ITEM_LOOKUPS);
  const found = new Map<string, OrderLine[]>();
  let index = 0;

  async function worker() {
    while (index < missing.length) {
      const session = missing[index];
      index += 1;
      if (!session) continue;
      try {
        const listed = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
        found.set(
          session.id,
          listed.data.map((item) => ({
            slug: "",
            size: "",
            quantity: item.quantity ?? 1,
            label: item.description || "Item",
          })),
        );
      } catch (error) {
        console.error("Line item lookup failed", session.id, error);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, missing.length) }, () => worker()));
  return found;
}

function paymentFields(session: Stripe.Checkout.Session): { paymentIntentId: string | null; refundedCents: number } {
  const paymentIntent = session.payment_intent;
  if (!paymentIntent) return { paymentIntentId: null, refundedCents: 0 };
  if (typeof paymentIntent === "string") return { paymentIntentId: paymentIntent, refundedCents: 0 };
  const charge = paymentIntent.latest_charge;
  const refundedCents = charge && typeof charge !== "string" ? charge.amount_refunded || 0 : 0;
  return { paymentIntentId: paymentIntent.id, refundedCents };
}

function toOrder(session: Stripe.Checkout.Session, items: OrderLine[], livemode: boolean): Omit<AdminOrder, "fulfilled" | "archived"> {
  const shipping = session.collected_information?.shipping_details;
  const shippingAddress = shipping
    ? addressLines(shipping.name, shipping.address)
    : addressLines(session.customer_details?.name, session.customer_details?.address);
  const payment = paymentFields(session);
  return {
    id: session.id,
    created: session.created,
    customerName: shipping?.name || session.customer_details?.name || "",
    customerEmail: session.customer_details?.email || "",
    items,
    itemSummary: items.map(orderLineLabel).join(", "),
    shippingAddress,
    shippingRate: shippingRateLabel(session),
    totalCents: session.amount_total ?? 0,
    paymentIntentId: payment.paymentIntentId,
    refundedCents: payment.refundedCents,
    shippoOrderId: session.metadata?.shippoOrderId?.trim() || null,
    dashboardUrl: stripeDashboardUrl(`/checkout/sessions/${session.id}`, livemode),
  };
}

function monthlyCents(amount: number, interval: string | undefined, count: number): number {
  const periods = count > 0 ? count : 1;
  if (!interval || interval === "month") return Math.round(amount / periods);
  if (interval === "year") return Math.round(amount / (12 * periods));
  if (interval === "week") return Math.round((amount * 52) / (12 * periods));
  if (interval === "day") return Math.round((amount * 365) / (12 * periods));
  return amount;
}

function subscriptionTierLabel(cents: number | null | undefined): string {
  const tier = tierFromPriceCents(cents);
  if (tier === "vip") return "VIP";
  if (tier === "supporter") return "Supporter";
  return "Custom";
}

function toSubscription(subscription: Stripe.Subscription, livemode: boolean): AdminSubscription {
  const customer = subscription.customer;
  const id = customerId(customer);
  let email = "";
  let name = "";
  if (customer && typeof customer !== "string" && !customer.deleted) {
    email = customer.email || "";
    name = customer.name || "";
  }
  const price = subscription.items.data[0]?.price;
  const amountCents = price?.unit_amount ?? 0;
  const interval = price?.recurring?.interval || "month";
  const intervalCount = price?.recurring?.interval_count ?? 1;
  return {
    id: subscription.id,
    status: subscription.status,
    email,
    name,
    customerId: id,
    tierLabel: subscriptionTierLabel(price?.unit_amount),
    amountCents,
    interval,
    created: subscription.created,
    mrrCents: monthlyCents(amountCents, interval, intervalCount),
    dashboardUrl: stripeDashboardUrl(`/customers/${id}`, livemode),
  };
}

function invoiceAmount(invoice: Stripe.Invoice): { created: number; amount: number } | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription || invoice.status !== "paid") return null;
  return { created: invoice.created, amount: invoice.amount_paid };
}

async function listSessions(stripe: Stripe): Promise<{ rows: Stripe.Checkout.Session[]; truncated: boolean }> {
  const params = {
    limit: PAGE_SIZE,
    status: "complete" as const,
  };
  try {
    return await paginate((startingAfter) =>
      stripe.checkout.sessions.list({
        ...params,
        starting_after: startingAfter,
        expand: ["data.shipping_cost.shipping_rate", "data.payment_intent.latest_charge"],
      }),
    );
  } catch (error) {
    console.error("Checkout list with shipping expand failed", error);
    return paginate((startingAfter) =>
      stripe.checkout.sessions.list({
        ...params,
        starting_after: startingAfter,
      }),
    );
  }
}

async function fetchStripe(stripe: Stripe): Promise<StripeSnapshot> {
  const livemode = livemodeFromKey();
  const [sessions, invoices, subscriptions] = await Promise.all([
    listSessions(stripe),
    paginate((startingAfter) =>
      stripe.invoices.list({
        limit: PAGE_SIZE,
        status: "paid",
        starting_after: startingAfter,
      }),
    ),
    paginate((startingAfter) =>
      stripe.subscriptions.list({
        limit: PAGE_SIZE,
        status: "all",
        starting_after: startingAfter,
        expand: ["data.customer"],
      }),
    ),
  ]);

  const paidSessions = sessions.rows.filter(
    (session) =>
      session.mode === "payment" &&
      session.payment_status === "paid" &&
      session.metadata?.kind !== "playlist",
  );
  const extraItems = await lookupMissingItems(stripe, paidSessions);
  const orders = paidSessions
    .map((session) => toOrder(session, extraItems.get(session.id) || linesFromSession(session), livemode))
    .sort((a, b) => b.created - a.created);

  return {
    orders,
    subscriptionRevenue: invoices.rows.flatMap((invoice) => {
      const row = invoiceAmount(invoice);
      return row ? [row] : [];
    }),
    subscriptions: subscriptions.rows
      .map((subscription) => toSubscription(subscription, livemode))
      .sort((a, b) => b.created - a.created),
    truncated: sessions.truncated || invoices.truncated || subscriptions.truncated,
    livemode,
  };
}

async function stripeSnapshot(): Promise<StripeSnapshot | null> {
  const stripe = stripeClient();
  if (!stripe) return null;
  if (stripeCache && stripeCache.expires > Date.now()) return stripeCache.value;
  const value = await fetchStripe(stripe);
  stripeCache = { expires: Date.now() + CACHE_MS, value };
  return value;
}

type OrderFlag = {
  fulfilled: boolean;
  archived: boolean;
  refundedCents: number;
  shippoOrderId: string | null;
};

async function orderFlags(): Promise<Map<string, OrderFlag>> {
  const pool = getPool();
  const map = new Map<string, OrderFlag>();
  if (!pool) return map;
  await ensureAdminTables();
  const result = await pool.query<{
    session_id: string;
    fulfilled: boolean;
    archived: boolean;
    refunded_cents: number;
    shippo_order_id: string | null;
  }>(`SELECT session_id, fulfilled, archived, refunded_cents, shippo_order_id FROM order_fulfillment`);
  for (const row of result.rows) {
    map.set(row.session_id, {
      fulfilled: row.fulfilled,
      archived: row.archived,
      refundedCents: Number(row.refunded_cents) || 0,
      shippoOrderId: row.shippo_order_id?.trim() || null,
    });
  }
  return map;
}

export async function setOrderFulfilled(sessionId: string, fulfilled: boolean): Promise<void> {
  const admin = await requireAdmin();
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  if (!/^cs_[A-Za-z0-9]+$/.test(sessionId)) throw new Error("Unknown order.");
  await ensureAdminTables();
  await pool.query(
    `INSERT INTO order_fulfillment (session_id, fulfilled, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (session_id) DO UPDATE SET fulfilled = EXCLUDED.fulfilled, updated_at = NOW()`,
    [sessionId, fulfilled],
  );
  await recordActivity(admin, fulfilled ? "Marked order fulfilled" : "Marked order unfulfilled", sessionId, "");
}

export async function setOrderArchived(sessionId: string, archived: boolean): Promise<void> {
  const admin = await requireAdmin();
  const pool = getPool();
  if (!pool) throw new Error("Database is not configured.");
  if (!/^cs_[A-Za-z0-9]+$/.test(sessionId)) throw new Error("Unknown order.");
  await ensureAdminTables();
  await pool.query(
    `INSERT INTO order_fulfillment (session_id, fulfilled, archived, updated_at)
     VALUES ($1, false, $2, NOW())
     ON CONFLICT (session_id) DO UPDATE SET archived = EXCLUDED.archived, updated_at = NOW()`,
    [sessionId, archived],
  );
  await recordActivity(admin, archived ? "Archived order" : "Unarchived order", sessionId, "");
}

async function loadUsers(): Promise<{ rows: UserRow[]; free: number; signups30d: number }> {
  const pool = getPool();
  if (!pool) return { rows: [], free: 0, signups30d: 0 };
  await ensureSchema();
  const [counts, list] = await Promise.all([
    pool.query<{ free: number; signups30d: number }>(
      `SELECT
         (COUNT(*) FILTER (WHERE tier = 'free'))::int AS free,
         (COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days'))::int AS signups30d
       FROM "user"`,
    ),
    pool.query<UserRow>(
      `SELECT id, email, name, tier, "stripeCustomerId", "createdAt"
       FROM "user"
       ORDER BY "createdAt" DESC
       LIMIT 5000`,
    ),
  ]);
  return {
    rows: list.rows,
    free: Number(counts.rows[0]?.free ?? 0),
    signups30d: Number(counts.rows[0]?.signups30d ?? 0),
  };
}

const STATUS_RANK: Record<string, number> = {
  active: 60,
  trialing: 50,
  past_due: 40,
  unpaid: 30,
  incomplete: 20,
  paused: 15,
  canceled: 10,
  incomplete_expired: 0,
};

function bestSubscription(subs: AdminSubscription[]): AdminSubscription | undefined {
  return [...subs].sort((a, b) => (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0))[0];
}

function emptyRevenue(): AdminData["revenue"] {
  return {
    month: { merch: 0, subscriptions: 0 },
    allTime: { merch: 0, subscriptions: 0 },
  };
}

export async function getAdminData(): Promise<AdminData> {
  await requireAdmin();
  let databaseError: string | null = null;
  const users = await loadUsers().catch((error: unknown) => {
    console.error("Admin member query failed", error);
    databaseError = "Member data could not be loaded.";
    return { rows: [] as UserRow[], free: 0, signups30d: 0 };
  });

  let snapshot: StripeSnapshot | null = null;
  let stripeError: string | null = null;
  try {
    snapshot = await stripeSnapshot();
  } catch (error) {
    console.error("Admin Stripe load failed", error);
    stripeError = "Stripe data could not be loaded.";
  }

  let flags = new Map<string, OrderFlag>();
  try {
    flags = await orderFlags();
  } catch (error) {
    console.error("Order flag lookup failed", error);
  }

  const byCustomer = new Map<string, AdminSubscription[]>();
  for (const subscription of snapshot?.subscriptions ?? []) {
    if (!subscription.customerId) continue;
    const list = byCustomer.get(subscription.customerId) ?? [];
    list.push(subscription);
    byCustomer.set(subscription.customerId, list);
  }

  const userByCustomer = new Map<string, UserRow>();
  for (const user of users.rows) {
    if (user.stripeCustomerId) userByCustomer.set(user.stripeCustomerId, user);
  }

  const subscriptions = (snapshot?.subscriptions ?? []).map((subscription) => {
    const user = userByCustomer.get(subscription.customerId);
    return {
      ...subscription,
      email: subscription.email || user?.email || "",
      name: subscription.name || user?.name || "",
    };
  });

  const start = monthStartUnix();
  const revenue = emptyRevenue();
  for (const order of snapshot?.orders ?? []) {
    revenue.allTime.merch += order.totalCents;
    if (order.created >= start) revenue.month.merch += order.totalCents;
  }
  for (const invoice of snapshot?.subscriptionRevenue ?? []) {
    revenue.allTime.subscriptions += invoice.amount;
    if (invoice.created >= start) revenue.month.subscriptions += invoice.amount;
  }

  const tiers = { free: users.free, supporter: 0, vip: 0, other: 0 };
  let mrrCents = 0;
  let pastDue = 0;
  for (const subscription of subscriptions) {
    if (subscription.status === "past_due") pastDue += 1;
    if (subscription.status !== "active" && subscription.status !== "trialing") continue;
    mrrCents += subscription.mrrCents;
    if (subscription.tierLabel === "Supporter") tiers.supporter += 1;
    else if (subscription.tierLabel === "VIP") tiers.vip += 1;
    else tiers.other += 1;
  }

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSignups = users.rows
    .filter((user) => new Date(user.createdAt).getTime() >= cutoff)
    .slice(0, 5)
    .map((user) => ({ email: user.email, name: user.name, joined: new Date(user.createdAt) }));

  const members: AdminMember[] = users.rows.map((user) => {
    const match = user.stripeCustomerId ? bestSubscription(byCustomer.get(user.stripeCustomerId) ?? []) : undefined;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      tier: isTier(user.tier) ? user.tier : "free",
      status: match?.status || "free",
      joined: new Date(user.createdAt),
      stripeCustomerId: user.stripeCustomerId,
      stripeCustomerUrl: user.stripeCustomerId
        ? stripeDashboardUrl(`/customers/${user.stripeCustomerId}`, snapshot?.livemode ?? livemodeFromKey())
        : null,
    };
  });

  return {
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    stripeError,
    databaseError,
    truncated: snapshot?.truncated ?? false,
    cachedAt: stripeCache?.expires ? stripeCache.expires - CACHE_MS : null,
    revenue,
    tiers,
    mrrCents,
    pastDue,
    signups30d: users.signups30d,
    recentSignups,
    orders: (snapshot?.orders ?? []).map((order) => {
      const flag = flags.get(order.id);
      return {
        ...order,
        fulfilled: flag?.fulfilled ?? false,
        archived: flag?.archived ?? false,
        refundedCents: Math.max(order.refundedCents, flag?.refundedCents ?? 0),
        shippoOrderId: flag?.shippoOrderId || order.shippoOrderId,
      };
    }),
    members,
    subscriptions,
  };
}

export function filterMembers(members: AdminMember[], query: string): AdminMember[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return members;
  return members.filter((member) =>
    `${member.email} ${member.name}`.toLowerCase().includes(needle),
  );
}
