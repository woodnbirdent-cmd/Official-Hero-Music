import "server-only";
import type Stripe from "stripe";

/**
 * Server-only merch shipping config: origin, weights, and mailers.
 * Checkout asks Shippo for live rates and falls back to SHIPPING_FLAT_CENTS.
 */

export const SHIPPING_FLAT_CENTS = 600;

export const SHIP_FROM = {
  name: "Official Hero Music",
  street1: "1006 Laurel Dr",
  city: "Jefferson City",
  state: "MO",
  zip: "65109",
  country: "US",
} as const;

/** Finished weight of one unit, in ounces. */
export const ITEM_WEIGHT_OZ = {
  "hero-tee-white": 6,
  "hero-tee-black": 6,
  "hero-snapback": 4,
} as const;

export const PACKAGING_WEIGHT_OZ = 2;

/** 1–2 units ship in the small poly mailer. 3 or more use the medium one. */
const PARCELS = {
  small: { length: "10", width: "13", height: "1", maxItems: 2 },
  medium: { length: "14.5", width: "19", height: "2" },
} as const;

const SHIPPO_SHIPMENTS_URL = "https://api.goshippo.com/shipments/";
const CHEAPEST_RATE_COUNT = 3;

export type ShipTo = {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
};

type ShippingOption = Stripe.Checkout.SessionCreateParams.ShippingOption;
type DeliveryEstimate = NonNullable<
  NonNullable<ShippingOption["shipping_rate_data"]>["delivery_estimate"]
>;

type ShipmentItem = {
  slug: string;
  quantity: number;
};

type ParsedRate = {
  cents: number;
  label: string;
  estimate?: DeliveryEstimate;
};

export function hasShippingWeight(slug: string): boolean {
  return slug in ITEM_WEIGHT_OZ;
}

function flatShippingOption(): ShippingOption {
  return {
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: "US shipping",
      fixed_amount: {
        amount: SHIPPING_FLAT_CENTS,
        currency: "usd",
      },
    },
  };
}

function parcelForItemCount(count: number): { length: string; width: string; height: string } {
  if (count <= PARCELS.small.maxItems) return PARCELS.small;
  return PARCELS.medium;
}

function shipmentWeightOz(items: readonly ShipmentItem[]): number | null {
  let weight = PACKAGING_WEIGHT_OZ;
  for (const item of items) {
    if (!hasShippingWeight(item.slug)) return null;
    weight += ITEM_WEIGHT_OZ[item.slug as keyof typeof ITEM_WEIGHT_OZ] * item.quantity;
  }
  return weight;
}

function isTransitDay(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 60;
}

function deliveryEstimate(rate: Record<string, unknown>): DeliveryEstimate | undefined {
  const terms = typeof rate.duration_terms === "string" ? rate.duration_terms : "";
  const range = terms.match(/(\d+)\s*(?:to|–|-)\s*(\d+)/i);
  if (range) {
    const minimum = Number(range[1]);
    const maximum = Number(range[2]);
    if (isTransitDay(minimum) && isTransitDay(maximum) && maximum >= minimum) {
      return {
        minimum: { unit: "business_day", value: minimum },
        maximum: { unit: "business_day", value: maximum },
      };
    }
  }

  const estimated =
    typeof rate.estimated_days === "number" && Number.isFinite(rate.estimated_days)
      ? Math.round(rate.estimated_days)
      : null;
  if (estimated !== null && isTransitDay(estimated)) {
    return {
      minimum: { unit: "business_day", value: estimated },
      maximum: { unit: "business_day", value: estimated },
    };
  }
  return undefined;
}

function centsFromAmount(amount: unknown): number | null {
  if (typeof amount !== "string" && typeof amount !== "number") return null;
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function rateLabel(provider: string, serviceName: string): string {
  if (!serviceName) return provider;
  if (!provider || serviceName.toLowerCase().includes(provider.toLowerCase())) return serviceName;
  return `${provider} ${serviceName}`;
}

function parseRate(value: unknown): ParsedRate | null {
  if (!value || typeof value !== "object") return null;
  const rate = value as Record<string, unknown>;
  const currency = typeof rate.currency === "string" ? rate.currency.toUpperCase() : "";
  if (currency !== "USD") return null;
  const cents = centsFromAmount(rate.amount);
  if (cents === null) return null;

  const servicelevel = rate.servicelevel;
  const serviceName =
    servicelevel &&
    typeof servicelevel === "object" &&
    "name" in servicelevel &&
    typeof servicelevel.name === "string"
      ? servicelevel.name.trim()
      : "";
  const provider = typeof rate.provider === "string" ? rate.provider.trim() : "";
  const label = rateLabel(provider, serviceName).slice(0, 100);
  if (!label) return null;

  const estimate = deliveryEstimate(rate);
  return estimate ? { cents, label, estimate } : { cents, label };
}

function cheapestRates(payload: unknown): ParsedRate[] {
  if (!payload || typeof payload !== "object" || !("rates" in payload)) return [];
  const rates = (payload as { rates: unknown }).rates;
  if (!Array.isArray(rates)) return [];

  const parsed = rates.flatMap((rate) => {
    const parsedRate = parseRate(rate);
    return parsedRate ? [parsedRate] : [];
  });
  parsed.sort((a, b) => a.cents - b.cents);

  const picked: ParsedRate[] = [];
  const seen = new Set<string>();
  for (const rate of parsed) {
    const key = rate.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(rate);
    if (picked.length === CHEAPEST_RATE_COUNT) break;
  }
  return picked;
}

function toShippingOption(rate: ParsedRate): ShippingOption {
  return {
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: rate.label,
      fixed_amount: { amount: rate.cents, currency: "usd" },
      ...(rate.estimate ? { delivery_estimate: rate.estimate } : {}),
    },
  };
}

function shipmentBody(items: readonly ShipmentItem[], to: ShipTo): Record<string, unknown> | null {
  const weightOz = shipmentWeightOz(items);
  if (weightOz === null) return null;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const parcel = parcelForItemCount(itemCount);
  return {
    address_from: SHIP_FROM,
    address_to: {
      name: to.name,
      street1: to.street1,
      ...(to.street2 ? { street2: to.street2 } : {}),
      city: to.city,
      state: to.state,
      zip: to.zip,
      country: "US",
    },
    parcels: [
      {
        length: parcel.length,
        width: parcel.width,
        height: parcel.height,
        distance_unit: "in",
        weight: String(weightOz),
        mass_unit: "oz",
      },
    ],
    async: false,
  };
}

export async function loadShippingOptions(
  items: readonly ShipmentItem[],
  to: ShipTo,
): Promise<ShippingOption[]> {
  const fallback = [flatShippingOption()];
  const token = process.env.SHIPPO_API_TOKEN;
  const body = shipmentBody(items, to);
  if (!token || !body) {
    console.error("Shippo rates failed");
    return fallback;
  }

  try {
    const response = await fetch(SHIPPO_SHIPMENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `ShippoToken ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Shippo rates failed", response.status);
      return fallback;
    }
    const options = cheapestRates(await response.json()).map(toShippingOption);
    if (options.length === 0) {
      console.error("Shippo rates failed: no usable rates");
      return fallback;
    }
    return options;
  } catch (error) {
    console.error("Shippo rates failed", error);
    return fallback;
  }
}
