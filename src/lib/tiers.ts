export const TIERS = ["free", "supporter", "vip"] as const;

export type Tier = (typeof TIERS)[number];

export const TIER_RANK: Record<Tier, number> = {
  free: 0,
  supporter: 1,
  vip: 2,
};

export const TIER_DETAILS = {
  free: {
    name: "Free",
    priceCents: 0,
    priceLabel: "$0",
    period: "",
    description: "An account and the member updates feed.",
    features: ["Member account", "Updates feed"],
  },
  supporter: {
    name: "Supporter",
    priceCents: 700,
    priceLabel: "$7",
    period: "/mo",
    description: "Free, plus early access to new drops.",
    features: ["Everything in Free", "Early access to new drops"],
  },
  vip: {
    name: "VIP",
    priceCents: 1500,
    priceLabel: "$15",
    period: "/mo",
    description: "Everything above, plus free merch shipping and member downloads.",
    features: [
      "Everything in Supporter",
      "Free shipping on merch",
      "Free downloads from time to time",
    ],
  },
} as const;

export function isTier(value: unknown): value is Tier {
  return value === "free" || value === "supporter" || value === "vip";
}

export function tierAtLeast(current: Tier, minimum: Tier): boolean {
  return TIER_RANK[current] >= TIER_RANK[minimum];
}

/** Map a Stripe subscription price to a paid tier. The charged amount wins over metadata. */
export function tierFromPriceCents(cents: number | null | undefined): Tier | null {
  if (cents === TIER_DETAILS.vip.priceCents) return "vip";
  if (cents === TIER_DETAILS.supporter.priceCents) return "supporter";
  return null;
}

export function safeNextPath(value: string | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
