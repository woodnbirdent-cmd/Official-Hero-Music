import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { checkinFlags, describePerks, parseTicketCode } from "./show-codes.ts";
import {
  BUSINESS_SPONSOR_TIERS,
  COMMUNITY_SPONSOR,
  TICKET_TIERS,
  formatDollars,
  ticketCapacity,
  ticketTier,
} from "./show-config.ts";
import { ownerSponsorshipEmail, ownerVolunteerEmail, sponsorshipReceiptEmail, ticketEmail, volunteerConfirmationEmail } from "./show-copy.ts";
import { showOrdersToCsv } from "./show-csv.ts";
import { requestIsSameOrigin } from "./show-http.ts";
import { parseDollarsToCents, parseSponsorshipFields, parseTicketFields, parseVolunteerFields, shirtSizeForTier } from "./show-input.ts";
import { detectLogo } from "./show-logo.ts";
import { showStripeSecret } from "./show-stripe.ts";
import { publicSitemapPaths } from "./sitemap-paths.ts";
import type { ShowOrder } from "./show-types.ts";

const root = path.resolve(import.meta.dirname, "../..");

function walk(dir: string, found: string[] = []): string[] {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) found.push(full);
  }
  return found;
}

test("confirmed ticket tier defaults", () => {
  assert.deepEqual(
    TICKET_TIERS.map((tier) => ({
      name: tier.name,
      priceCents: tier.priceCents,
      perks: [...tier.perks],
      collectShirtSize: tier.collectShirtSize,
    })),
    [
      { name: "General Admission", priceCents: 1500, perks: [], collectShirtSize: false },
      {
        name: "Ticket + Early Access + Meet & Greet",
        priceCents: 2500,
        perks: ["early-access", "meet-greet"],
        collectShirtSize: false,
      },
      {
        name: "Ticket + Shirt + Meet & Greet",
        priceCents: 5000,
        perks: ["shirt", "meet-greet"],
        collectShirtSize: true,
      },
    ],
  );
});

test("check-in flags follow the tier perks and only show a shirt size when one was collected", () => {
  const general = ticketTier("ga");
  const early = ticketTier("early-meet");
  const shirt = ticketTier("shirt-meet");
  assert.ok(general && early && shirt);
  assert.deepEqual(
    checkinFlags(general.perks, "").map((flag) => flag.flag),
    [],
  );
  assert.deepEqual(
    checkinFlags(early.perks, "").map((flag) => flag.flag),
    ["EARLY ACCESS", "MEET & GREET"],
  );
  assert.equal(checkinFlags(early.perks, "").some((flag) => flag.flag === "SHIRT"), false);
  assert.equal(checkinFlags(early.perks, "")[1]?.detail, "After the show");
  const shirtFlags = checkinFlags(shirt.perks, "XL");
  assert.deepEqual(
    shirtFlags.map((flag) => flag.flag),
    ["MEET & GREET", "SHIRT"],
  );
  assert.equal(shirtFlags.find((flag) => flag.flag === "SHIRT")?.size, "XL");
  assert.equal(shirtFlags.some((flag) => flag.flag === "EARLY ACCESS"), false);
});

test("shirt size is collected only when that tier config says so", () => {
  const early = ticketTier("early-meet");
  const shirt = ticketTier("shirt-meet");
  assert.ok(early && shirt);
  assert.deepEqual(shirtSizeForTier(early, "L"), { ok: true, size: "" });
  assert.equal(shirtSizeForTier(shirt, "").ok, false);
  assert.deepEqual(shirtSizeForTier(shirt, "M"), { ok: true, size: "M" });
  assert.deepEqual(shirtSizeForTier({ ...shirt, collectShirtSize: false, perks: [] }, "M"), { ok: true, size: "" });
  const parsed = parseTicketFields({
    tierId: "early-meet",
    quantity: 2,
    shirtSize: "L",
    name: "Ada Fan",
    email: "ada@example.com",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value.shirtSize, "");
});

test("ticket codes normalize from a door URL", () => {
  const code = "SA-ABCD-EFGH-JKLM-NPQR";
  assert.equal(parseTicketCode(`https://officialheromusic.com/checkin?code=${code}`), code);
  assert.equal(parseTicketCode("sa-abcd-efgh-jklm-npqr"), code);
  assert.equal(parseTicketCode("SA-IIII-IIII-IIII-IIII"), null);
  assert.equal(parseTicketCode("nope"), null);
});

test("community sponsorship amount and business tier price come from config", () => {
  const community = parseSponsorshipFields({
    tierId: COMMUNITY_SPONSOR.id,
    payment: "card",
    amount: "25",
    name: "Ada Fan",
    email: "ada@example.com",
    phone: "",
    businessName: "",
    logoDelivery: "",
    hasLogo: false,
  });
  assert.equal(community.ok, true);
  if (community.ok) {
    assert.equal(community.value.tierName, "Community Sponsor");
    assert.equal(community.value.amountCents, 2500);
  }
  assert.equal(parseSponsorshipFields({ ...{
    tierId: COMMUNITY_SPONSOR.id,
    payment: "invoice",
    amount: "25",
    name: "Ada Fan",
    email: "ada@example.com",
    phone: "",
    businessName: "",
    logoDelivery: "",
    hasLogo: false,
  } }).ok, false);
  assert.doesNotMatch(COMMUNITY_SPONSOR.summary, /LED|booth|complimentary|deliverable/i);
  const business = parseSponsorshipFields({
    tierId: "gold",
    payment: "invoice",
    amount: "1",
    name: "Lee Contact",
    email: "lee@example.com",
    phone: "(573) 555-0100",
    businessName: "WNB Lighting",
    logoDelivery: "email",
    hasLogo: false,
  });
  assert.equal(business.ok, true);
  if (business.ok) {
    assert.equal(business.value.tierName, "Gold");
    assert.equal(business.value.amountCents, 75000);
    assert.equal(business.value.slots, "2–3 slots");
    assert.match(business.value.perks, /6 complimentary tickets/);
  }
  assert.equal(
    parseSponsorshipFields({
      tierId: "sponsor-250",
      payment: "invoice",
      amount: "1",
      name: "Lee Contact",
      email: "lee@example.com",
      phone: "(573) 555-0100",
      businessName: "WNB Lighting",
      logoDelivery: "email",
      hasLogo: false,
    }).ok,
    false,
  );
  assert.equal(parseDollarsToCents("18.50"), 1850);
  assert.equal(parseDollarsToCents("18.5"), 1850);
  assert.equal(parseDollarsToCents("1.234"), null);
});

test("capacity and live stripe key guards", () => {
  assert.equal(ticketCapacity({ TICKET_CAPACITY: "120" } as NodeJS.ProcessEnv), 120);
  assert.equal(ticketCapacity({ TICKET_CAPACITY: "" } as NodeJS.ProcessEnv), null);
  assert.equal(ticketCapacity({ TICKET_CAPACITY: "12.5" } as NodeJS.ProcessEnv), null);
  assert.equal(showStripeSecret({ STRIPE_SECRET_KEY: "sk_test_123", VERCEL_ENV: "preview" } as NodeJS.ProcessEnv), "sk_test_123");
  assert.equal(showStripeSecret({ STRIPE_SECRET_KEY: "sk_live_123", VERCEL_ENV: "preview" } as NodeJS.ProcessEnv), null);
  assert.equal(showStripeSecret({ STRIPE_SECRET_KEY: "sk_live_123", VERCEL_ENV: "production" } as NodeJS.ProcessEnv), "sk_live_123");
  assert.equal(requestIsSameOrigin("https://officialheromusic.com/tickets", "https://evil.example"), false);
  assert.equal(requestIsSameOrigin("https://officialheromusic.com/tickets", "https://officialheromusic.com"), true);
});

test("emails and csv say sponsorship and name the perks", () => {
  const order: ShowOrder = {
    id: 1,
    kind: "ticket",
    sponsorType: "",
    status: "paid",
    stripeSessionId: "cs_test",
    stripePaymentIntentId: "pi_test",
    buyerName: "Ada Fan",
    buyerEmail: "ada@example.com",
    tierId: "early-meet",
    tierName: "Ticket + Early Access + Meet & Greet",
    perks: "early-access,meet-greet",
    quantity: 1,
    unitAmountCents: 2500,
    amountCents: 2500,
    shirtSize: "",
    phone: "",
    businessName: "",
    logoDelivery: "",
    logoFilename: "",
    availability: "",
    roleInterest: "",
    notes: "",
    siteOrigin: "https://preview.example",
    buyerEmailSentAt: null,
    ownerNotifiedAt: null,
    createdAt: new Date("2027-01-01T00:00:00Z"),
    expiresAt: null,
    paidAt: new Date("2027-01-01T00:00:00Z"),
    tickets: [
      {
        code: "SA-ABCD-EFGH-JKLM-NPQR",
        tierId: "early-meet",
        tierName: "Ticket + Early Access + Meet & Greet",
        perks: "early-access,meet-greet",
        shirtSize: "",
        redeemedAt: null,
      },
    ],
  };
  const email = ticketEmail(order, order.tickets);
  assert.match(email.text, /Early access/);
  assert.match(email.text, /Meet & greet \(After the show\)/);
  assert.match(email.text, /SA-ABCD-EFGH-JKLM-NPQR/);
  assert.match(email.text, /5–9 PM CT/);
  assert.match(email.text, /Location TBA/);
  assert.doesNotMatch(email.text, /Building Community Bridges|Solid Rock/);
  assert.doesNotMatch(email.text, /shirt/i);
  assert.doesNotMatch(`${email.subject}\n${email.text}\n${email.html}`, /donat|deductible/i);
  const sponsor = { ...order, kind: "sponsorship" as const, sponsorType: "community" as const, tierName: "Community Sponsor", perks: "", tickets: [] };
  const receipt = sponsorshipReceiptEmail(sponsor);
  assert.match(receipt.text, /sponsorship payment/i);
  assert.doesNotMatch(receipt.text, /donat|deductible/i);
  const notice = ownerSponsorshipEmail({ ...sponsor, status: "unpaid" });
  assert.match(notice.text, /unpaid/i);
  assert.doesNotMatch(notice.text, /donat|deductible/i);
  const gold = ownerSponsorshipEmail({
    ...sponsor,
    status: "paid",
    sponsorType: "business",
    tierId: "gold",
    tierName: "Gold",
    amountCents: 75000,
    businessName: "WNB Lighting",
    perks: "Logo on the flyer and in the LED rotation\n6 complimentary tickets",
  });
  assert.match(gold.text, /Gold/);
  assert.match(gold.text, /2–3 slots/);
  assert.match(gold.text, /complimentary/);
  assert.doesNotMatch(gold.text, /donat|deductible|complementary/i);
  const csv = showOrdersToCsv([
    {
      ...order,
      buyerName: "=Ada",
      tickets: [{ ...order.tickets[0], redeemedAt: new Date("2027-01-09T22:00:00Z") }],
    },
  ]);
  assert.match(csv, /Early access/);
  assert.match(csv, /Checked-in status/);
  assert.match(csv, /'=Ada/);
  assert.match(csv, /checked in /);
  assert.equal(csv.includes("donat"), false);
  assert.deepEqual(describePerks(["shirt", "meet-greet"], "L"), ["Meet & greet (After the show)", "Shirt: L"]);
  void formatDollars;
});

test("show copy does not use forbidden wording", () => {
  const files = [
    ...walk(path.join(root, "src/lib")).filter((file) => path.basename(file).startsWith("show-")),
    ...walk(path.join(root, "src/components/show")),
    ...walk(path.join(root, "src/app/set-apart")),
    ...walk(path.join(root, "src/app/tickets")),
    ...walk(path.join(root, "src/app/checkin")),
    ...walk(path.join(root, "src/app/api/show")),
    ...walk(path.join(root, "src/app/admin/show")),
    ...walk(path.join(root, "src/app/admin/(panel)/show")),
  ];
  const forbidden = /donat|tax[-\s]?deduct|deductible|501\s*\(c\)/i;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    assert.equal(forbidden.test(text), false, file);
  }
});

test("stripe webhook hands show payments to fulfillment", () => {
  const route = fs.readFileSync(path.join(root, "src/app/api/stripe/webhook/route.ts"), "utf8");
  assert.match(route, /fulfillPaidCheckout/);
  assert.match(route, /releaseShowCheckout/);
  assert.match(route, /checkout\.session\.expired/);
  assert.match(route, /checkout\.session\.async_payment_succeeded/);
});

test("public routes include the show page and omit check-in", () => {
  const paths = publicSitemapPaths();
  assert.ok(paths.includes("/set-apart"));
  assert.equal(paths.includes("/tickets"), false);
  assert.equal(paths.includes("/checkin"), false);
  const robots = fs.readFileSync(path.join(root, "src/app/robots.ts"), "utf8");
  assert.match(robots, /\/checkin/);
  assert.doesNotMatch(robots, /set-apart/);
});

test("public show page collects sponsorships and volunteers without selling tickets", () => {
  const page = fs.readFileSync(path.join(root, "src/app/set-apart/page.tsx"), "utf8");
  const tour = fs.readFileSync(path.join(root, "src/app/tour/page.tsx"), "utf8");
  const config = fs.readFileSync(path.join(root, "src/lib/show-config.ts"), "utf8");
  const nav = fs.readFileSync(path.join(root, "src/lib/constants.ts"), "utf8");
  const redirect = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
  const publicCopy = `${page}\n${tour}`;
  assert.deepEqual(
    BUSINESS_SPONSOR_TIERS.map((tier) => ({ name: tier.name, priceCents: tier.priceCents, slots: tier.slots })),
    [
      { name: "Presenting", priceCents: 150000, slots: "1 slot" },
      { name: "Gold", priceCents: 75000, slots: "2–3 slots" },
      { name: "Silver", priceCents: 35000, slots: "4–6 slots" },
    ],
  );
  const packageCopy = BUSINESS_SPONSOR_TIERS.flatMap((tier) => [...tier.perks]).join("\n");
  assert.match(packageCopy, /10 complimentary tickets/);
  assert.match(packageCopy, /SET APART presented by ___/);
  assert.doesNotMatch(packageCopy, /complementary/i);
  assert.equal(fs.existsSync(path.join(root, "src/lib/show-config.ts")), true);
  const configText = config;
  assert.doesNotMatch(configText, /sponsor-100|sponsor-250|sponsor-500|sponsor-1000|sponsor-1500|"Partner"|"Patron"|"Title"/);
  const forms = fs.readFileSync(path.join(root, "src/components/show/SponsorshipForms.tsx"), "utf8");
  assert.match(forms, /tier\.perks/);
  assert.match(forms, /tier\.slots/);
  assert.match(page, /SponsorshipForms/);
  assert.match(page, /VolunteerForm/);
  assert.doesNotMatch(page, /TicketPurchase/);
  assert.match(page, /SHOW\.location/);
  assert.match(page, /SHOW\.timeLabel/);
  assert.match(page, /SHOW\.headliner/);
  assert.match(page, /SHOW\.withLine/);
  assert.match(tour, /SHOW\.location/);
  assert.match(config, /location: "Location TBA"/);
  assert.match(config, /timeLabel: "5–9 PM CT"/);
  assert.match(config, /headliner: "#HERO"/);
  assert.match(config, /worship by Aubrey/);
  assert.match(page, /SHOW\.poster/);
  assert.match(page, /SHOW\.story/);
  assert.match(config, /set-apart-poster\.jpg/);
  assert.match(config, /set-apart-story\.jpg/);
  assert.equal(fs.existsSync(path.join(root, "public/show/set-apart-poster.jpg")), true);
  assert.equal(fs.existsSync(path.join(root, "public/show/set-apart-story.jpg")), true);
  assert.equal(fs.existsSync(path.join(root, "public/show/set-apart-flyer.png")), false);
  assert.doesNotMatch(publicCopy, /Building Community Bridges|Solid Rock/);
  assert.doesNotMatch(publicCopy, /\$15|\$25|\$50|General Admission|Ticket \+/);
  assert.doesNotMatch(page, /\bhis\b/i);
  assert.doesNotMatch(config, /Building Community Bridges|Solid Rock/);
  const home = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
  const banner = fs.readFileSync(path.join(root, "src/components/show/SetApartBanner.tsx"), "utf8");
  assert.match(home, /SetApartBanner/);
  assert.match(banner, /href="\/set-apart"/);
  assert.match(banner, /SHOW\.dateLabel/);
  assert.match(banner, /SHOW\.timeLabel/);
  assert.match(banner, /SHOW\.location/);
  assert.match(banner, /SHOW\.headliner/);
  assert.match(banner, /SHOW\.withLine/);
  assert.match(banner, /SHOW\.poster/);
  assert.doesNotMatch(`${home}\n${banner}`, /TicketPurchase|General Admission|\$15|donat|Building Community Bridges|Solid Rock/i);
  assert.match(nav, /href: "\/set-apart"/);
  assert.doesNotMatch(nav, /href: "\/tickets"/);
  assert.match(redirect, /source: "\/tickets", destination: "\/set-apart"/);
});

test("volunteer sign-up accepts shifts and drops a filled honeypot", () => {
  const saved = parseVolunteerFields({
    name: "Ada Fan",
    email: "ada@example.com",
    phone: "573-555-0199",
    shifts: ["setup", "teardown"],
    roles: ["door"],
    roleOther: "prayer team",
    shirtSize: "L",
    notes: "I can lift speakers.",
    companyWebsite: "",
  });
  assert.equal(saved.ok, true);
  if (saved.ok) {
    assert.equal(saved.value.spam, false);
    assert.equal(saved.value.availability, "Setup; Teardown");
    assert.equal(saved.value.roleInterest, "Check-in / door; Other: prayer team");
    assert.equal(saved.value.shirtSize, "L");
  }
  const spam = parseVolunteerFields({
    name: "Bot",
    email: "bot@example.com",
    phone: "573-555-0199",
    shifts: ["setup"],
    roles: ["merch"],
    roleOther: "",
    shirtSize: "",
    notes: "",
    companyWebsite: "https://spam.example",
  });
  assert.equal(spam.ok, true);
  if (spam.ok) assert.equal(spam.value.spam, true);
  assert.equal(
    parseVolunteerFields({
      name: "Ada Fan",
      email: "ada@example.com",
      phone: "573-555-0199",
      shifts: [],
      roles: [],
      roleOther: "",
      shirtSize: "",
      notes: "",
      companyWebsite: "",
    }).ok,
    false,
  );
  const outreach = parseVolunteerFields({
    name: "Bea Outreach",
    email: "bea@example.com",
    phone: "573-555-0188",
    shifts: ["before"],
    roles: ["outreach"],
    roleOther: "",
    shirtSize: "",
    notes: "I can hand out flyers this week.",
    companyWebsite: "",
  });
  assert.equal(outreach.ok, true);
  if (outreach.ok) {
    assert.equal(outreach.value.availability, "Before the show (community outreach)");
    assert.equal(outreach.value.roleInterest, "Community outreach");
    assert.doesNotMatch(outreach.value.availability, /Setup|During the show|Teardown/);
    const order = {
      kind: "volunteer",
      buyerName: outreach.value.name,
      buyerEmail: outreach.value.email,
      phone: outreach.value.phone,
      availability: outreach.value.availability,
      roleInterest: outreach.value.roleInterest,
      shirtSize: "",
      notes: outreach.value.notes,
      perks: "",
      tickets: [],
      tierName: "",
      quantity: 1,
      stripePaymentIntentId: "",
      amountCents: 0,
      status: "received",
      businessName: "",
      logoDelivery: "",
      createdAt: new Date("2027-01-01T00:00:00Z"),
    } as ShowOrder;
    const confirmation = volunteerConfirmationEmail(order);
    const owner = ownerVolunteerEmail(order);
    const csv = showOrdersToCsv([order]);
    for (const body of [confirmation.text, owner.text, csv]) {
      assert.match(body, /Before the show \(community outreach\)/);
      assert.match(body, /Community outreach/);
      assert.doesNotMatch(body, /donat/i);
    }
  }
  const form = fs.readFileSync(path.join(root, "src/components/show/VolunteerForm.tsx"), "utf8");
  assert.match(form, /experiencing homelessness and others who need it/);
  assert.match(form, /VOLUNTEER_ROLES/);
  assert.match(form, /VOLUNTEER_SHIFTS/);
});

test("logo bytes reject a text file", () => {
  assert.equal(detectLogo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])), "image/png");
  assert.equal(detectLogo(new TextEncoder().encode("not an image!!!!")), null);
});
