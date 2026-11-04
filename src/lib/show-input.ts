import {
  BUSINESS_SPONSOR_TIERS,
  COMMUNITY_SPONSOR,
  SHIRT_SIZES,
  TICKET_MAX_QUANTITY,
  VOLUNTEER_ROLES,
  VOLUNTEER_SHIFTS,
  businessSponsorTier,
  formatDollars,
  ticketTier,
  type TicketTier,
} from "./show-config";

export type TicketRequest = {
  tier: TicketTier;
  quantity: number;
  shirtSize: string;
  name: string;
  email: string;
};

export function cleanName(value: unknown, max = 80): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > max) return null;
  return cleaned;
}

export function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (cleaned.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return null;
  return cleaned;
}

export function cleanPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  const digits = cleaned.replace(/\D/g, "");
  if (cleaned.length > 30 || digits.length < 7 || digits.length > 15) return null;
  return cleaned;
}

export function parseQuantity(value: unknown): number | null {
  const quantity =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > TICKET_MAX_QUANTITY) return null;
  return quantity;
}

export function parseDollarsToCents(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    const cents = Math.round(value * 100);
    if (Math.abs(value * 100 - cents) > 0.001) return null;
    return cents;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^\$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [dollars, frac = ""] = trimmed.split(".");
  return Number(dollars) * 100 + Number(frac.padEnd(2, "0"));
}

export function shirtSizeForTier(
  tier: TicketTier,
  size: unknown,
): { ok: true; size: string } | { ok: false; error: string } {
  if (!tier.collectShirtSize) return { ok: true, size: "" };
  if (typeof size === "string" && (SHIRT_SIZES as readonly string[]).includes(size)) {
    return { ok: true, size };
  }
  return { ok: false, error: "Choose a shirt size." };
}

export function parseTicketFields(input: {
  tierId: unknown;
  quantity: unknown;
  shirtSize: unknown;
  name: unknown;
  email: unknown;
}): { ok: true; value: TicketRequest } | { ok: false; error: string } {
  const tier = typeof input.tierId === "string" ? ticketTier(input.tierId) : undefined;
  if (!tier) return { ok: false, error: "Choose a ticket." };
  const quantity = parseQuantity(input.quantity);
  if (quantity == null) {
    return { ok: false, error: `Quantity must be between 1 and ${TICKET_MAX_QUANTITY}.` };
  }
  const name = cleanName(input.name);
  if (!name) return { ok: false, error: "Enter your name." };
  const email = cleanEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email." };
  const size = shirtSizeForTier(tier, input.shirtSize);
  if (!size.ok) return size;
  return { ok: true, value: { tier, quantity, shirtSize: size.size, name, email } };
}

export type SponsorshipRequest = {
  payment: "card" | "invoice";
  sponsorType: "community" | "business";
  tierId: string;
  tierName: string;
  amountCents: number;
  buyerName: string;
  buyerEmail: string;
  phone: string;
  businessName: string;
  logoDelivery: "" | "upload" | "email";
};

export function parseSponsorshipFields(input: {
  tierId: unknown;
  payment: unknown;
  amount: unknown;
  name: unknown;
  email: unknown;
  phone: unknown;
  businessName: unknown;
  logoDelivery: unknown;
  hasLogo: boolean;
}): { ok: true; value: SponsorshipRequest } | { ok: false; error: string } {
  const payment = input.payment === "invoice" ? "invoice" : input.payment === "card" ? "card" : null;
  if (!payment) return { ok: false, error: "Choose how to pay." };
  const tierId = typeof input.tierId === "string" ? input.tierId : "";
  const email = cleanEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email." };

  if (tierId === COMMUNITY_SPONSOR.id) {
    if (payment !== "card") return { ok: false, error: "Community Sponsor is paid by card at checkout." };
    const name = cleanName(input.name);
    if (!name) return { ok: false, error: "Enter your name." };
    const cents = parseDollarsToCents(input.amount);
    if (cents == null) return { ok: false, error: "Enter a sponsorship amount." };
    if (cents < COMMUNITY_SPONSOR.minCents || cents > COMMUNITY_SPONSOR.maxCents) {
      return {
        ok: false,
        error: `Enter an amount from ${formatDollars(COMMUNITY_SPONSOR.minCents)} to ${formatDollars(COMMUNITY_SPONSOR.maxCents)}.`,
      };
    }
    return {
      ok: true,
      value: {
        payment,
        sponsorType: "community",
        tierId: COMMUNITY_SPONSOR.id,
        tierName: COMMUNITY_SPONSOR.name,
        amountCents: cents,
        buyerName: name,
        buyerEmail: email,
        phone: "",
        businessName: "",
        logoDelivery: "",
      },
    };
  }

  const tier = businessSponsorTier(tierId);
  if (!tier) return { ok: false, error: "Choose a sponsorship tier." };
  const contact = cleanName(input.name);
  if (!contact) return { ok: false, error: "Enter the contact name." };
  const businessName = cleanName(input.businessName, 120);
  if (!businessName) return { ok: false, error: "Enter the business name." };
  const phone = cleanPhone(input.phone);
  if (!phone) return { ok: false, error: "Enter a phone number." };
  const logoDelivery = input.logoDelivery === "email" ? "email" : "upload";
  if (logoDelivery === "upload" && !input.hasLogo) return { ok: false, error: "Add a logo, or choose to email it." };
  return {
    ok: true,
    value: {
      payment,
      sponsorType: "business",
      tierId: tier.id,
      tierName: tier.name,
      amountCents: tier.priceCents,
      buyerName: contact,
      buyerEmail: email,
      phone,
      businessName,
      logoDelivery,
    },
  };
}

export function businessTierIds(): string[] {
  return BUSINESS_SPONSOR_TIERS.map((tier) => tier.id);
}

export type VolunteerRequest = {
  spam: boolean;
  name: string;
  email: string;
  phone: string;
  availability: string;
  roleInterest: string;
  shirtSize: string;
  notes: string;
};

function cleanNotes(value: unknown): string | null {
  if (value == null || value === "") return "";
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\r\n/g, "\n").trim();
  if (cleaned.length > 1000) return null;
  return cleaned;
}

export function parseVolunteerFields(input: {
  name: unknown;
  email: unknown;
  phone: unknown;
  shifts: unknown;
  roles: unknown;
  roleOther: unknown;
  shirtSize: unknown;
  notes: unknown;
  companyWebsite: unknown;
}): { ok: true; value: VolunteerRequest } | { ok: false; error: string } {
  const trap = typeof input.companyWebsite === "string" ? input.companyWebsite.trim() : "";
  if (trap) {
    return {
      ok: true,
      value: { spam: true, name: "", email: "", phone: "", availability: "", roleInterest: "", shirtSize: "", notes: "" },
    };
  }
  const name = cleanName(input.name);
  if (!name) return { ok: false, error: "Enter your name." };
  const email = cleanEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email." };
  const phone = cleanPhone(input.phone);
  if (!phone) return { ok: false, error: "Enter a phone number." };
  const shiftIds = Array.isArray(input.shifts) ? input.shifts.filter((item): item is string => typeof item === "string") : [];
  const shifts = VOLUNTEER_SHIFTS.filter((shift) => shiftIds.includes(shift.id));
  if (shifts.length === 0) return { ok: false, error: "Choose at least one availability." };
  const roleIds = Array.isArray(input.roles) ? input.roles.filter((item): item is string => typeof item === "string") : [];
  const roles = VOLUNTEER_ROLES.filter((role) => roleIds.includes(role.id));
  let roleOther = "";
  if (typeof input.roleOther === "string" && input.roleOther.trim()) {
    const cleaned = cleanName(input.roleOther, 120);
    if (!cleaned) return { ok: false, error: "Keep the other role to 120 characters." };
    roleOther = cleaned;
  }
  if (roles.length === 0 && !roleOther) return { ok: false, error: "Choose a role, or tell us another way you can help." };
  const roleInterest = [...roles.map((role) => role.label), ...(roleOther ? [`Other: ${roleOther}`] : [])].join("; ");
  let shirtSize = "";
  if (typeof input.shirtSize === "string" && input.shirtSize.trim()) {
    if (!(SHIRT_SIZES as readonly string[]).includes(input.shirtSize)) return { ok: false, error: "Choose a shirt size." };
    shirtSize = input.shirtSize;
  }
  const notes = cleanNotes(input.notes);
  if (notes == null) return { ok: false, error: "Notes are too long." };
  return {
    ok: true,
    value: {
      spam: false,
      name,
      email,
      phone,
      availability: shifts.map((shift) => shift.label).join("; "),
      roleInterest,
      shirtSize,
      notes,
    },
  };
}
