/**
 * SET APART ticket and sponsorship settings.
 * Change tiers here. Pages, checkout, emails, and check-in read this file.
 *
 * Confirmed defaults:
 * - $15 General Admission
 * - $25 Ticket + Early Access + Meet & Greet (no shirt)
 * - $50 Ticket + Shirt + Meet & Greet (no early access; shirt size collected)
 * The $50 tier's contents can still change by editing this object.
 */

export const SHOW = {
  id: "set-apart",
  name: "SET APART",
  presenters: "Official Hero Music & WNB Lighting and Sound",
  dateLabel: "Saturday, January 9, 2027",
  timeLabel: "4–8 PM",
  venue: "Building Community Bridges",
  city: "Jefferson City, MO",
  lineup: ["#Hero", "Nicky Gracious", "OTG Zico", "Worship by Aubrey"],
  flyer: "/show/set-apart-flyer.png",
  flyerWidth: 1080,
  flyerHeight: 1350,
} as const;

export const TICKET_PERKS = {
  "early-access": { label: "Early access", flag: "EARLY ACCESS" },
  "meet-greet": { label: "Meet & greet", flag: "MEET & GREET", detail: "After the show" },
  shirt: { label: "Shirt", flag: "SHIRT" },
} as const;

export type TicketPerkId = keyof typeof TICKET_PERKS;

export const SHIRT_SIZES = ["S", "M", "L", "XL", "2X"] as const;
export type ShirtSize = (typeof SHIRT_SIZES)[number];

export type TicketTier = {
  id: string;
  name: string;
  priceCents: number;
  summary: string;
  perks: readonly TicketPerkId[];
  collectShirtSize: boolean;
};

export const TICKET_TIERS: readonly TicketTier[] = [
  {
    id: "ga",
    name: "General Admission",
    priceCents: 1500,
    summary: "Entry to SET APART.",
    perks: [],
    collectShirtSize: false,
  },
  {
    id: "early-meet",
    name: "Ticket + Early Access + Meet & Greet",
    priceCents: 2500,
    summary: "Entry, early access, and a meet & greet after the show.",
    perks: ["early-access", "meet-greet"],
    collectShirtSize: false,
  },
  {
    id: "shirt-meet",
    name: "Ticket + Shirt + Meet & Greet",
    priceCents: 5000,
    summary: "Entry, a show shirt, and a meet & greet after the show. No early access.",
    perks: ["shirt", "meet-greet"],
    collectShirtSize: true,
  },
];

export const TICKET_MAX_QUANTITY = 10;
/** Stripe Checkout cannot expire sooner than 30 minutes. */
export const TICKET_HOLD_MINUTES = 35;

export function ticketTier(id: string): TicketTier | undefined {
  return TICKET_TIERS.find((tier) => tier.id === id);
}

export function ticketCapacity(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env.TICKET_CAPACITY?.trim() ?? "";
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

/**
 * Business sponsorship tiers. Names and prices are configuration, not a final offer.
 */
export const BUSINESS_SPONSOR_TIERS = [
  { id: "sponsor-100", name: "Sponsor", priceCents: 10000 },
  { id: "sponsor-250", name: "Partner", priceCents: 25000 },
  { id: "sponsor-500", name: "Patron", priceCents: 50000 },
  { id: "sponsor-1000", name: "Presenting", priceCents: 100000 },
  { id: "sponsor-1500", name: "Title", priceCents: 150000 },
] as const;

export type BusinessSponsorTier = (typeof BUSINESS_SPONSOR_TIERS)[number];

export function businessSponsorTier(id: string): BusinessSponsorTier | undefined {
  return BUSINESS_SPONSOR_TIERS.find((tier) => tier.id === id);
}

export const COMMUNITY_SPONSOR = {
  id: "community",
  name: "Community Sponsor",
  summary: "For individuals. Choose a preset or enter an amount.",
  presetsCents: [1000, 2500, 5000, 10000] as const,
  minCents: 100,
  maxCents: 1_000_000,
} as const;

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function perkStorage(perks: readonly string[]): string {
  return perks.join(",");
}

export const VOLUNTEER_SHIFTS = [
  { id: "setup", label: "Setup" },
  { id: "during", label: "During the show" },
  { id: "teardown", label: "Teardown" },
] as const;

export const VOLUNTEER_ROLES = [
  { id: "door", label: "Check-in / door" },
  { id: "merch", label: "Merch" },
  { id: "crew", label: "Setup crew" },
] as const;

export type VolunteerShiftId = (typeof VOLUNTEER_SHIFTS)[number]["id"];
export type VolunteerRoleId = (typeof VOLUNTEER_ROLES)[number]["id"];
