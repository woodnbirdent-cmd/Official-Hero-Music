import { describePerks, formatChicagoTime, parsePerkIds } from "./show-codes";
import type { ShowOrder } from "./show-types";

function csvCell(value: string | number): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function checkedInStatus(order: ShowOrder): string {
  return order.tickets
    .map((ticket) =>
      ticket.redeemedAt
        ? `${ticket.code} checked in ${formatChicagoTime(ticket.redeemedAt)}`
        : `${ticket.code} not checked in`,
    )
    .join("; ");
}

function kindLabel(order: ShowOrder): string {
  if (order.kind === "sponsorship") return "Sponsorship";
  if (order.kind === "volunteer") return "Volunteer";
  return "Ticket";
}

function logoCell(order: ShowOrder): string {
  if (order.logoDelivery === "upload") return `uploaded ${order.logoFilename || "logo"}`;
  if (order.logoDelivery === "email") return "will email";
  return "";
}

export function showOrdersToCsv(orders: ShowOrder[]): string {
  const headers = [
    "Name",
    "Email",
    "Tier",
    "Quantity",
    "Perks",
    "Shirt size",
    "Stripe payment id",
    "Ticket codes",
    "Checked-in status",
    "Type",
    "Amount",
    "Payment status",
    "Phone",
    "Business",
    "Logo",
    "Availability",
    "Role",
    "Notes",
    "Created",
  ];
  const rows = orders.map((order) => [
    order.buyerName,
    order.buyerEmail,
    order.tierName,
    order.quantity,
    describePerks(parsePerkIds(order.perks), order.kind === "ticket" ? order.shirtSize : "").join("; "),
    order.shirtSize,
    order.stripePaymentIntentId,
    order.tickets.map((ticket) => ticket.code).join("; "),
    checkedInStatus(order),
    kindLabel(order),
    `$${(order.amountCents / 100).toFixed(2)}`,
    order.status,
    order.phone,
    order.businessName,
    logoCell(order),
    order.availability,
    order.roleInterest,
    order.notes,
    order.createdAt.toISOString(),
  ]);
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
