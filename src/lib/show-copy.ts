import { describePerks, parsePerkIds, ticketCheckinUrl } from "./show-codes";
import { SHOW, formatDollars } from "./show-config";
import type { ShowOrder, ShowTicket } from "./show-types";

export type EmailBody = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function eventLines(): string[] {
  return [SHOW.name, SHOW.presenters, SHOW.dateLabel, SHOW.timeLabel, `${SHOW.venue}, ${SHOW.city}`];
}

function paragraph(lines: string[]): string {
  return lines.map((line) => `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:16px;line-height:1.4;color:#111;">${escapeHtml(line)}</p>`).join("");
}

export function ticketEmail(order: ShowOrder, tickets: ShowTicket[]): EmailBody {
  const perks = describePerks(parsePerkIds(order.perks), order.shirtSize);
  const blocks = tickets.map((ticket, index) => {
    const url = ticketCheckinUrl(order.siteOrigin || "https://officialheromusic.com", ticket.code);
    const contentId = `ticket-qr-${index + 1}`;
    return { ticket, url, contentId };
  });
  const text = [
    ...eventLines(),
    "",
    `Tickets for ${order.buyerName}`,
    order.tierName,
    ...perks,
    "",
    ...blocks.flatMap((block, index) => [
      `Ticket ${index + 1} of ${blocks.length}`,
      `Code: ${block.ticket.code}`,
      block.url,
      "",
    ]),
    "Each code can be scanned once at the door.",
  ].join("\n");
  const html = [
    `<div style="background:#ffffff;color:#111;padding:24px;">`,
    paragraph(eventLines()),
    paragraph([`Tickets for ${order.buyerName}`, order.tierName, ...perks]),
    ...blocks.map(
      (block, index) => `<div style="margin:20px 0;padding:16px;border:2px solid #111;">
        <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:18px;font-weight:700;">Ticket ${index + 1} of ${blocks.length}</p>
        <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:16px;">Code: ${escapeHtml(block.ticket.code)}</p>
        <img src="cid:${block.contentId}" alt="QR code for ${escapeHtml(block.ticket.code)}" width="280" height="280" />
        <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:14px;">${escapeHtml(block.url)}</p>
      </div>`,
    ),
    paragraph(["Each code can be scanned once at the door."]),
    `</div>`,
  ].join("");
  return { subject: `Your ${SHOW.name} tickets`, text, html };
}

export function sponsorshipReceiptEmail(order: ShowOrder): EmailBody {
  const lines = [
    `Thank you for your ${SHOW.name} sponsorship.`,
    "",
    order.businessName ? `Business: ${order.businessName}` : "",
    `Name: ${order.buyerName}`,
    `Sponsorship: ${order.tierName}`,
    `Amount: ${formatDollars(order.amountCents)}`,
    order.stripePaymentIntentId ? `Payment: ${order.stripePaymentIntentId}` : "",
    "",
    "This confirms we received your sponsorship payment.",
  ].filter((line) => line !== "");
  return {
    subject: `Your ${SHOW.name} sponsorship`,
    text: lines.join("\n"),
    html: `<div style="background:#ffffff;color:#111;padding:24px;">${paragraph(lines)}</div>`,
  };
}

export function sponsorshipRequestEmail(order: ShowOrder): EmailBody {
  const lines = [
    `We received your ${SHOW.name} sponsorship request.`,
    "",
    `Business: ${order.businessName}`,
    `Contact: ${order.buyerName}`,
    `Sponsorship: ${order.tierName}`,
    `Amount: ${formatDollars(order.amountCents)}`,
    "Payment status: unpaid",
    "",
    "This request stays unpaid until an invoice is sent or a check arrives.",
  ];
  return {
    subject: `${SHOW.name} sponsorship request received`,
    text: lines.join("\n"),
    html: `<div style="background:#ffffff;color:#111;padding:24px;">${paragraph(lines)}</div>`,
  };
}

export function volunteerConfirmationEmail(order: ShowOrder): EmailBody {
  const lines = [
    `You're signed up to volunteer at ${SHOW.name}.`,
    "",
    ...eventLines().slice(1),
    "",
    `Name: ${order.buyerName}`,
    `Availability: ${order.availability}`,
    `Role: ${order.roleInterest}`,
    order.shirtSize ? `Shirt size: ${order.shirtSize}` : "",
    order.notes ? `Notes: ${order.notes}` : "",
    "",
    "We'll follow up as the show gets closer.",
  ].filter((line) => line !== "");
  return {
    subject: `You're on the ${SHOW.name} volunteer list`,
    text: lines.join("\n"),
    html: `<div style="background:#ffffff;color:#111;padding:24px;">${paragraph(lines)}</div>`,
  };
}

export function ownerVolunteerEmail(order: ShowOrder): EmailBody {
  const lines = [
    `New ${SHOW.name} volunteer`,
    "",
    `Name: ${order.buyerName}`,
    `Email: ${order.buyerEmail}`,
    `Phone: ${order.phone}`,
    `Availability: ${order.availability}`,
    `Role: ${order.roleInterest}`,
    order.shirtSize ? `Shirt size: ${order.shirtSize}` : "Shirt size: not given",
    order.notes ? `Notes: ${order.notes}` : "Notes: none",
  ];
  return {
    subject: `${SHOW.name} volunteer — ${order.buyerName}`,
    text: lines.join("\n"),
    html: `<div style="background:#ffffff;color:#111;padding:24px;">${paragraph(lines)}</div>`,
  };
}

export function ownerSponsorshipEmail(order: ShowOrder): EmailBody {
  const paid = order.status === "paid";
  const logo =
    order.logoDelivery === "upload"
      ? `Logo attached (${order.logoFilename || "logo"}).`
      : order.logoDelivery === "email"
        ? "They will email the logo."
        : "No logo.";
  const lines = [
    `New ${SHOW.name} sponsorship`,
    "",
    `Status: ${paid ? "paid" : "unpaid — invoice or check"}`,
    `Tier: ${order.tierName}`,
    `Amount: ${formatDollars(order.amountCents)}`,
    `Name: ${order.buyerName}`,
    `Email: ${order.buyerEmail}`,
    order.phone ? `Phone: ${order.phone}` : "",
    order.businessName ? `Business: ${order.businessName}` : "",
    logo,
    order.stripePaymentIntentId ? `Stripe payment: ${order.stripePaymentIntentId}` : "",
  ].filter((line) => line !== "");
  return {
    subject: `${SHOW.name} sponsorship — ${order.tierName}${paid ? "" : " (unpaid)"}`,
    text: lines.join("\n"),
    html: `<div style="background:#ffffff;color:#111;padding:24px;">${paragraph(lines)}</div>`,
  };
}
