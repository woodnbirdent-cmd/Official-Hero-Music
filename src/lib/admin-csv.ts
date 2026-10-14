import "server-only";
import type { AdminMember, AdminOrder } from "@/lib/admin-data";

export function statusLabel(status: string): string {
  if (status === "past_due") return "Past due";
  if (status === "incomplete_expired") return "Incomplete expired";
  if (status === "free") return "Free";
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function tierLabel(tier: string): string {
  if (tier === "vip") return "VIP";
  if (tier === "supporter") return "Supporter";
  if (tier === "free") return "Free";
  return tier;
}

export function formatWhen(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(unixSeconds * 1000));
}

export function formatDay(value: Date): string {
  if (Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function csvCell(value: string | number | boolean): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: (string | number | boolean)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function ordersToCsv(orders: AdminOrder[]): string {
  return toCsv(
    ["Date", "Customer", "Email", "Items", "Shipping address", "Shipping rate", "Total cents", "Fulfilled", "Checkout session"],
    orders.map((order) => [
      new Date(order.created * 1000).toISOString(),
      order.customerName,
      order.customerEmail,
      order.itemSummary,
      order.shippingAddress.replace(/\n/g, ", "),
      order.shippingRate,
      order.totalCents,
      order.fulfilled ? "fulfilled" : "unfulfilled",
      order.id,
    ]),
  );
}

export function membersToCsv(members: AdminMember[]): string {
  return toCsv(
    ["Email", "Name", "Tier", "Status", "Joined", "Stripe customer"],
    members.map((member) => [
      member.email,
      member.name,
      tierLabel(member.tier),
      statusLabel(member.status),
      Number.isNaN(member.joined.getTime()) ? "" : member.joined.toISOString(),
      member.stripeCustomerId || "",
    ]),
  );
}
