import type { CheckinFlag } from "./show-codes";

export type RedeemResult =
  | {
      status: "valid" | "used";
      tierName: string;
      shirtSize: string;
      flags: CheckinFlag[];
      redeemedAt: string;
      redeemedLabel: string;
    }
  | { status: "not_found" | "locked" };

export type ShowKind = "ticket" | "sponsorship" | "volunteer";
export type SponsorType = "" | "community" | "business";
export type ShowStatus = "pending" | "paid" | "expired" | "unpaid" | "received";
export type LogoDelivery = "" | "upload" | "email";

export type ShowTicket = {
  code: string;
  tierId: string;
  tierName: string;
  perks: string;
  shirtSize: string;
  redeemedAt: Date | null;
};

export type ShowOrder = {
  id: number;
  kind: ShowKind;
  sponsorType: SponsorType;
  status: ShowStatus;
  stripeSessionId: string | null;
  stripePaymentIntentId: string;
  buyerName: string;
  buyerEmail: string;
  tierId: string;
  tierName: string;
  perks: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
  shirtSize: string;
  phone: string;
  businessName: string;
  logoDelivery: LogoDelivery;
  logoFilename: string;
  availability: string;
  roleInterest: string;
  notes: string;
  siteOrigin: string;
  buyerEmailSentAt: Date | null;
  ownerNotifiedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
  paidAt: Date | null;
  tickets: ShowTicket[];
};

export type TicketAvailability = {
  state: "open" | "sold-out" | "reserved-out" | "closed" | "unavailable";
  capacity: number | null;
  remaining: number | null;
  paid: number;
  held: number;
};
