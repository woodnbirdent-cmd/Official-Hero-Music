import { TICKET_PERKS, type TicketPerkId } from "./show-config";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FLAG_ORDER = ["early-access", "meet-greet", "shirt"];

export type CheckinFlag = {
  id: string;
  flag: string;
  detail?: string;
  size?: string;
};

export function formatTicketBody(body: string): string {
  return `SA-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12, 16)}`;
}

export function ticketCodeAlphabet(): string {
  return ALPHABET;
}

export function parseTicketCode(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    value = url.searchParams.get("code") || "";
  } catch {
    // A typed code is not a URL.
  }
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact.startsWith("SA") || compact.length !== 18) return null;
  const body = compact.slice(2);
  if (![...body].every((char) => ALPHABET.includes(char))) return null;
  return formatTicketBody(body);
}

export function ticketCheckinUrl(origin: string, code: string): string {
  const url = new URL("/checkin", origin);
  url.searchParams.set("code", code);
  return url.toString();
}

export function parsePerkIds(value: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of value.split(",")) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function checkinFlags(perks: readonly string[], shirtSize: string): CheckinFlag[] {
  const have = new Set(perks);
  if (shirtSize && !have.has("shirt")) have.add("shirt");
  const ordered = [
    ...FLAG_ORDER.filter((id) => have.has(id)),
    ...[...have].filter((id) => !FLAG_ORDER.includes(id)),
  ];
  return ordered.map((id) => {
    const perk = TICKET_PERKS[id as TicketPerkId];
    if (!perk) return { id, flag: id.replace(/-/g, " ").toUpperCase() };
    if (id === "shirt") return { id, flag: perk.flag, ...(shirtSize ? { size: shirtSize } : {}) };
    const detail = "detail" in perk ? perk.detail : undefined;
    return { id, flag: perk.flag, ...(detail ? { detail } : {}) };
  });
}

export function describePerks(perks: readonly string[], shirtSize = ""): string[] {
  return checkinFlags(perks, shirtSize).map((flag) => {
    const perk = TICKET_PERKS[flag.id as TicketPerkId];
    const label = perk?.label || flag.flag;
    if (flag.size) return `${label}: ${flag.size}`;
    if (flag.detail) return `${label} (${flag.detail})`;
    return label;
  });
}

export function formatChicagoTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(value);
}
