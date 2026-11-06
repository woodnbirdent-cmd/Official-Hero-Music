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
  timeLabel: "5–9 PM CT",
  location: "Location TBA",
  headliner: "#HERO",
  withLine: "Nicky Gracious · OTG Zico · worship by Aubrey",
  poster: "/show/set-apart-poster.jpg",
  posterWidth: 1080,
  posterHeight: 1350,
  story: "/show/set-apart-story.jpg",
  storyWidth: 1080,
  storyHeight: 1920,
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
 * Approved business sponsorship packages. The public page, checkout, and emails read this list.
 */
export const BUSINESS_SPONSOR_TIERS = [
  {
    id: "presenting",
    name: "Presenting",
    priceCents: 150000,
    slots: "1 slot",
    perks: [
      "“SET APART presented by ___” on flyers and posts",
      "Logo on the LED all night",
      "2 stage mentions",
      "A booth",
      "10 complimentary tickets",
      "2 meet-and-greet passes",
    ],
  },
  {
    id: "gold",
    name: "Gold",
    priceCents: 75000,
    slots: "2–3 slots",
    perks: [
      "Logo on the flyer and in the LED rotation",
      "1 stage mention",
      "A booth",
      "6 complimentary tickets",
    ],
  },
  {
    id: "silver",
    name: "Silver",
    priceCents: 35000,
    slots: "4–6 slots",
    perks: [
      "Logo in the LED rotation",
      "Name on the flyer",
      "4 complimentary tickets",
    ],
  },
] as const;

export type BusinessSponsorTier = (typeof BUSINESS_SPONSOR_TIERS)[number];

export function businessSponsorTier(id: string): BusinessSponsorTier | undefined {
  return BUSINESS_SPONSOR_TIERS.find((tier) => tier.id === id);
}

export const COMMUNITY_SPONSOR = {
  id: "community",
  name: "Community Sponsor",
  summary: "For individuals, or anyone who wants to chip in. A thank-you sponsorship.",
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
  { id: "before", label: "Before the show (community outreach)" },
  { id: "setup", label: "Setup" },
  { id: "during", label: "During the show" },
  { id: "teardown", label: "Teardown" },
] as const;

export const VOLUNTEER_ROLES = [
  { id: "door", label: "Check-in / door" },
  { id: "merch", label: "Merch" },
  { id: "crew", label: "Setup crew" },
  { id: "outreach", label: "Community outreach" },
] as const;

export type VolunteerShiftId = (typeof VOLUNTEER_SHIFTS)[number]["id"];
export type VolunteerRoleId = (typeof VOLUNTEER_ROLES)[number]["id"];
