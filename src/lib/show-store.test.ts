import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import Stripe from "stripe";
import type * as StoreModule from "./show-store.ts";

const databaseUrl = process.env.TEST_DATABASE_URL || "postgres://postgres@127.0.0.1:5432/hero_show_test";
const emails: Array<{ to?: string[]; subject?: string; text?: string; html?: string; attachments?: unknown[] }> = [];

let store: typeof StoreModule | null = null;
let db: Pool | null = null;

before(async () => {
  const probe = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2000, max: 1 });
  try {
    await probe.query("SELECT 1");
  } catch {
    return;
  } finally {
    await probe.end().catch(() => undefined);
  }
  process.env.DATABASE_URL = databaseUrl;
  process.env.TICKET_CAPACITY = "10";
  process.env.TICKET_CHECKIN_PASSWORD = "door-test-password";
  process.env.STRIPE_SECRET_KEY = "sk_test_show";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_show_test_secret";
  process.env.RESEND_API_KEY = "re_test";
  process.env.ADMIN_EMAIL_FROM = "Official #Hero <noreply@example.com>";
  process.env.OWNER_NOTIFY_EMAIL = "lee@example.com";
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("api.resend.com")) throw new Error(`Unexpected fetch ${url}`);
    emails.push(JSON.parse(String(init?.body || "{}")) as (typeof emails)[number]);
    return new Response("{}", { status: 200 });
  };
  store = await import("./show-store.ts");
  db = new Pool({ connectionString: databaseUrl, max: 8 });
  await store.ensureShowTables(db);
  await db.query("DELETE FROM show_tickets");
  await db.query("DELETE FROM show_orders");
});

after(async () => {
  await db?.end();
});

function skip(t: { skip: (message?: string) => void }): boolean {
  if (!store || !db) {
    t.skip("Postgres is not available");
    return true;
  }
  return false;
}

async function reset(): Promise<void> {
  emails.length = 0;
  await db?.query("DELETE FROM show_tickets");
  await db?.query("DELETE FROM show_orders");
}

test("ticket holds cannot oversell the configured capacity", async (t) => {
  if (skip(t) || !store || !db) return;
  await reset();
  process.env.TICKET_CAPACITY = "3";
  const input = {
    tierId: "ga",
    tierName: "General Admission",
    perks: [] as string[],
    quantity: 2,
    unitAmountCents: 1500,
    shirtSize: "",
    buyerName: "Hold Fan",
    siteOrigin: "http://localhost:3000",
  };
  const results = await Promise.allSettled([
    store.reserveTicketOrder({ ...input, buyerEmail: "one@example.com" }, db),
    store.reserveTicketOrder({ ...input, buyerEmail: "two@example.com" }, db),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  assert.equal(fulfilled.length, 1);
  const counts = await db.query<{ held: number }>(
    `SELECT COALESCE(SUM(quantity), 0)::int AS held FROM show_orders WHERE kind = 'ticket' AND status = 'pending'`,
  );
  assert.ok(Number(counts.rows[0]?.held) <= 3);
});

test("paid webhook issues one code, emails it, and check-in redeems once", async (t) => {
  if (skip(t) || !store || !db) return;
  await reset();
  process.env.TICKET_CAPACITY = "10";
  const reserved = await store.reserveTicketOrder(
    {
      tierId: "early-meet",
      tierName: "Ticket + Early Access + Meet & Greet",
      perks: ["early-access", "meet-greet"],
      quantity: 1,
      unitAmountCents: 2500,
      shirtSize: "",
      buyerName: "Ada Fan",
      buyerEmail: "ada@example.com",
      siteOrigin: "http://localhost:3000",
    },
    db,
  );
  await store.attachStripeSession(reserved.id, "cs_test_early", db);
  const { fulfillPaidCheckout } = await import("./show-fulfill.ts");
  await fulfillPaidCheckout({
    id: "cs_test_early",
    mode: "payment",
    payment_status: "paid",
    amount_total: 2500,
    customer_details: { email: "ada@example.com", name: "Ada Fan" },
    payment_intent: "pi_test_early",
    metadata: {
      kind: "ticket",
      orderId: String(reserved.id),
      tier: "early-meet",
      buyerName: "Ada Fan",
    },
  } as Stripe.Checkout.Session);
  const buyer = emails.find((email) => email.to?.[0] === "ada@example.com");
  assert.ok(buyer);
  assert.match(buyer?.text || "", /Early access/);
  assert.match(buyer?.text || "", /Meet & greet/);
  assert.doesNotMatch(buyer?.text || "", /shirt/i);
  assert.doesNotMatch(`${buyer?.text || ""}\n${buyer?.html || ""}`, /donat|deductible/i);
  assert.ok(Array.isArray(buyer?.attachments) && buyer.attachments.length === 1);
  const codeRow = await db.query<{ code: string; perks: string; shirt_size: string }>(
    `SELECT code, perks, shirt_size FROM show_tickets`,
  );
  const code = codeRow.rows[0]?.code || "";
  assert.match(code, /^SA-/);
  assert.equal(codeRow.rows[0]?.perks, "early-access,meet-greet");
  assert.equal(codeRow.rows[0]?.shirt_size, "");
  const [first, second] = await Promise.all([store.redeemTicket(code, db), store.redeemTicket(code, db)]);
  assert.deepEqual([first.status, second.status].sort(), ["used", "valid"]);
  const valid = first.status === "valid" ? first : second;
  if (valid.status === "valid") {
    assert.deepEqual(
      valid.flags.map((flag) => flag.flag),
      ["EARLY ACCESS", "MEET & GREET"],
    );
    assert.equal(valid.flags.some((flag) => flag.flag === "SHIRT"), false);
  }
  assert.equal((await store.redeemTicket(code, db)).status, "used");
  assert.equal((await store.redeemTicket("SA-ZZZZ-ZZZZ-ZZZZ-ZZZZ", db)).status, "not_found");
  const { showOrdersToCsv } = await import("./show-csv.ts");
  const csv = showOrdersToCsv(await store.listShowOrders(db));
  assert.match(csv, /ada@example.com/);
  assert.match(csv, /pi_test_early/);
  assert.match(csv, new RegExp(code));
  assert.match(csv, /checked in /);
  assert.match(csv, /Early access/);
});

test("shirt tier stores a size and general admission has no perk flags", async (t) => {
  if (skip(t) || !store || !db) return;
  await reset();
  process.env.TICKET_CAPACITY = "10";
  const shirt = await store.reserveTicketOrder(
    {
      tierId: "shirt-meet",
      tierName: "Ticket + Shirt + Meet & Greet",
      perks: ["shirt", "meet-greet"],
      quantity: 1,
      unitAmountCents: 5000,
      shirtSize: "L",
      buyerName: "Bo Fan",
      buyerEmail: "bo@example.com",
      siteOrigin: "http://localhost:3000",
    },
    db,
  );
  const paid = await store.markPaidFromCheckout(
    {
      sessionId: "cs_test_shirt",
      orderId: shirt.id,
      kind: "ticket",
      paymentIntentId: "pi_test_shirt",
      amountCents: 5000,
      email: "bo@example.com",
      name: "Bo Fan",
    },
    db,
  );
  const redeemed = await store.redeemTicket(paid.tickets[0]?.code || "", db);
  assert.equal(redeemed.status, "valid");
  if (redeemed.status === "valid") {
    assert.deepEqual(
      redeemed.flags.map((flag) => ({ flag: flag.flag, size: flag.size || "", detail: flag.detail || "" })),
      [
        { flag: "MEET & GREET", size: "", detail: "After the show" },
        { flag: "SHIRT", size: "L", detail: "" },
      ],
    );
    assert.equal(redeemed.flags.some((flag) => flag.flag === "EARLY ACCESS"), false);
  }
  const general = await store.reserveTicketOrder(
    {
      tierId: "ga",
      tierName: "General Admission",
      perks: [],
      quantity: 1,
      unitAmountCents: 1500,
      shirtSize: "",
      buyerName: "Cy Fan",
      buyerEmail: "cy@example.com",
      siteOrigin: "http://localhost:3000",
    },
    db,
  );
  const generalPaid = await store.markPaidFromCheckout(
    {
      sessionId: "cs_test_ga",
      orderId: general.id,
      kind: "ticket",
      paymentIntentId: "pi_test_ga",
      amountCents: 1500,
      email: "cy@example.com",
      name: "Cy Fan",
    },
    db,
  );
  const generalRedeem = await store.redeemTicket(generalPaid.tickets[0]?.code || "", db);
  assert.equal(generalRedeem.status, "valid");
  if (generalRedeem.status === "valid") assert.deepEqual(generalRedeem.flags, []);
});

test("sponsorship payment and invoice are saved and Lee is emailed", async (t) => {
  if (skip(t) || !store || !db) return;
  await reset();
  const communityId = await store.createSponsorshipOrder(
    {
      status: "pending",
      sponsorType: "community",
      tierId: "community",
      tierName: "Community Sponsor",
      amountCents: 1000,
      buyerName: "Ada Fan",
      buyerEmail: "ada-sponsor@example.com",
      phone: "",
      businessName: "",
      logoDelivery: "",
      logoFilename: "",
      logoBytes: null,
      siteOrigin: "http://localhost:3000",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
    db,
  );
  await store.attachStripeSession(communityId, "cs_test_sponsor", db);
  const { fulfillPaidCheckout } = await import("./show-fulfill.ts");
  await fulfillPaidCheckout({
    id: "cs_test_sponsor",
    mode: "payment",
    payment_status: "paid",
    amount_total: 1000,
    customer_details: { email: "ada-sponsor@example.com", name: "Ada Fan" },
    payment_intent: "pi_test_sponsor",
    metadata: { kind: "sponsorship", orderId: String(communityId), buyerName: "Ada Fan" },
  } as Stripe.Checkout.Session);
  assert.ok(emails.some((email) => email.to?.[0] === "ada-sponsor@example.com" && /sponsorship/i.test(email.text || "")));
  assert.ok(emails.some((email) => email.to?.[0] === "lee@example.com"));
  assert.equal(emails.some((email) => /donat|deductible/i.test(`${email.subject}\n${email.text}`)), false);
  emails.length = 0;
  const invoiceId = await store.createSponsorshipOrder(
    {
      status: "unpaid",
      sponsorType: "business",
      tierId: "sponsor-100",
      tierName: "Sponsor",
      amountCents: 10000,
      buyerName: "Pat Business",
      buyerEmail: "pat@example.com",
      phone: "573-555-0100",
      businessName: "WNB Lighting",
      logoDelivery: "email",
      logoFilename: "",
      logoBytes: null,
      siteOrigin: "http://localhost:3000",
      expiresAt: null,
    },
    db,
  );
  const { deliverSponsorshipNotice } = await import("./show-fulfill.ts");
  await deliverSponsorshipNotice(invoiceId);
  assert.ok(emails.some((email) => email.to?.[0] === "lee@example.com" && /unpaid/i.test(email.text || "")));
  const { showOrdersToCsv } = await import("./show-csv.ts");
  const csv = showOrdersToCsv(await store.listShowOrders(db));
  assert.match(csv, /Sponsorship/);
  assert.match(csv, /Community Sponsor/);
  assert.match(csv, /WNB Lighting/);
  assert.doesNotMatch(csv, /donat/i);
});

test("volunteer sign-up is stored, emailed, and included in the csv", async (t) => {
  if (skip(t) || !store || !db) return;
  await reset();
  const id = await store.createVolunteerOrder(
    {
      buyerName: "Val Volunteer",
      buyerEmail: "val@example.com",
      phone: "573-555-0142",
      availability: "Setup; During the show",
      roleInterest: "Check-in / door",
      shirtSize: "M",
      notes: "I can stay late.",
      siteOrigin: "http://localhost:3000",
    },
    db,
  );
  const { deliverVolunteerNotice } = await import("./show-fulfill.ts");
  await deliverVolunteerNotice(id);
  assert.ok(emails.some((email) => email.to?.[0] === "val@example.com" && /volunteer/i.test(email.text || "")));
  assert.ok(emails.some((email) => email.to?.[0] === "lee@example.com" && /Setup/.test(email.text || "")));
  assert.equal(emails.some((email) => /donat|deductible/i.test(`${email.subject}\n${email.text}`)), false);
  const { showOrdersToCsv } = await import("./show-csv.ts");
  const csv = showOrdersToCsv(await store.listShowOrders(db));
  assert.match(csv, /Volunteer/);
  assert.match(csv, /val@example.com/);
  assert.match(csv, /Check-in \/ door/);
  assert.match(csv, /I can stay late/);
});
