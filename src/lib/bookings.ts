import { normalizeEmail } from "@/lib/broadcast";

export const BOOKING_NAME_MAX = 200;
export const BOOKING_ORG_MAX = 200;
export const BOOKING_MESSAGE_MAX = 4000;

const DEFAULT_BOOKING_NOTIFY = "woodnbirdent@gmail.com,hero@officialheromusic.com";

export type BookingFields = {
  name: string;
  email: string;
  org: string;
  eventDate: string;
  message: string;
};

export type BookingInput = {
  name: unknown;
  email: unknown;
  org: unknown;
  date: unknown;
  message: unknown;
  companyWebsite: unknown;
};

export type ParsedBooking =
  | { ok: true; spam: true }
  | { ok: true; spam: false; value: BookingFields }
  | { ok: false; error: string };

export type BookingNotice = BookingFields & { submittedAt: Date };

export type BookingEmail = {
  from: string;
  to: string[];
  replyTo: string;
  subject: string;
  text: string;
  html: string;
};

type LineResult = { empty: true } | { tooLong: true } | { value: string };

function honeypotTripped(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  return value != null;
}

function cleanLine(value: unknown, max: number): LineResult {
  if (typeof value !== "string") return { empty: true };
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return { empty: true };
  if (cleaned.length > max) return { tooLong: true };
  return { value: cleaned };
}

function cleanMessage(value: unknown): LineResult {
  if (typeof value !== "string") return { empty: true };
  const cleaned = value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (!cleaned) return { empty: true };
  if (cleaned.length > BOOKING_MESSAGE_MAX) return { tooLong: true };
  return { value: cleaned };
}

function cleanEventDate(value: unknown): { ok: true; value: string } | { ok: false } {
  if (value == null) return { ok: true, value: "" };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: "" };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return { ok: false };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false };
  }
  return { ok: true, value: trimmed };
}

function emailToken(value: string): string | null {
  const angled = value.match(/<([^<>\s]+)>/);
  return normalizeEmail(angled?.[1] ?? value);
}

/** Comma-separated inboxes. Unset or blank uses Lee and #Hero. */
export function bookingNotifyEmails(source?: string): string[] {
  const raw = source == null || source.trim() === "" ? DEFAULT_BOOKING_NOTIFY : source;
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of raw.split(",")) {
    const email = emailToken(part);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

export function parseBookingFields(input: BookingInput): ParsedBooking {
  if (honeypotTripped(input.companyWebsite)) return { ok: true, spam: true };
  const name = cleanLine(input.name, BOOKING_NAME_MAX);
  if ("empty" in name) return { ok: false, error: "Name is required" };
  if ("tooLong" in name) return { ok: false, error: `Keep the name to ${BOOKING_NAME_MAX} characters` };
  const rawEmail = typeof input.email === "string" ? input.email.trim() : "";
  if (!rawEmail) return { ok: false, error: "Email is required" };
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, error: "Enter a valid email" };
  const org = cleanLine(input.org, BOOKING_ORG_MAX);
  if ("tooLong" in org) return { ok: false, error: `Keep the organization to ${BOOKING_ORG_MAX} characters` };
  const eventDate = cleanEventDate(input.date);
  if (!eventDate.ok) return { ok: false, error: "Enter a valid event date" };
  const message = cleanMessage(input.message);
  if ("empty" in message) return { ok: false, error: "Message is required" };
  if ("tooLong" in message) return { ok: false, error: `Keep the message to ${BOOKING_MESSAGE_MAX} characters` };
  return {
    ok: true,
    spam: false,
    value: {
      name: name.value,
      email,
      org: "value" in org ? org.value : "",
      eventDate: eventDate.value,
      message: message.value,
    },
  };
}

export function formatSubmittedAt(value: Date): string {
  if (Number.isNaN(value.getTime())) return "";
  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(value)} UTC`;
}

export function formatEventDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function bookingNoticeEmail(booking: BookingNotice): { subject: string; text: string; html: string } {
  const organization = booking.org || "not given";
  const eventDate = booking.eventDate ? formatEventDate(booking.eventDate) : "not given";
  const submitted = formatSubmittedAt(booking.submittedAt);
  const lines = [
    "New booking request for #Hero",
    "",
    `Name: ${booking.name}`,
    `Email: ${booking.email}`,
    `Organization: ${organization}`,
    `Event date: ${eventDate}`,
    `Submitted: ${submitted}`,
    "",
    "Message:",
    booking.message,
  ];
  const htmlLines = [
    "New booking request for #Hero",
    `Name: ${booking.name}`,
    `Email: ${booking.email}`,
    `Organization: ${organization}`,
    `Event date: ${eventDate}`,
    `Submitted: ${submitted}`,
  ];
  return {
    subject: `Booking request — ${booking.name}`,
    text: lines.join("\n"),
    html: `<div style="background:#ffffff;color:#111;padding:24px;">${htmlLines
      .map(
        (line) =>
          `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:16px;line-height:1.4;color:#111;">${escapeHtml(line)}</p>`,
      )
      .join("")}<p style="margin:16px 0 8px;font-family:Arial,sans-serif;font-size:16px;line-height:1.4;color:#111;">Message:</p><p style="margin:0;white-space:pre-wrap;font-family:Arial,sans-serif;font-size:16px;line-height:1.4;color:#111;">${escapeHtml(booking.message)}</p></div>`,
  };
}

function fromAddress(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || /[\r\n]/.test(trimmed)) return null;
  return trimmed;
}

export async function sendBookingNotification(
  booking: BookingNotice,
  options: {
    env?: {
      RESEND_API_KEY?: string;
      ADMIN_EMAIL_FROM?: string;
      BOOKING_NOTIFY_EMAILS?: string;
    };
    fetchImpl?: typeof fetch;
  } = {},
): Promise<"sent" | "skipped" | "failed"> {
  const env = options.env ?? process.env;
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const from = fromAddress(env.ADMIN_EMAIL_FROM);
  const to = bookingNotifyEmails(
    options.env ? options.env.BOOKING_NOTIFY_EMAILS : process.env.BOOKING_NOTIFY_EMAILS,
  );
  if (!apiKey || /[\r\n]/.test(apiKey) || !from || to.length === 0) {
    console.error("Booking notification skipped");
    return "skipped";
  }
  const notice = bookingNoticeEmail(booking);
  try {
    const response = await (options.fetchImpl ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: booking.email,
        subject: notice.subject,
        text: notice.text,
        html: notice.html,
      }),
    });
    if (!response.ok) {
      await response.text().catch(() => "");
      console.error("Booking notification failed", response.status);
      return "failed";
    }
    return "sent";
  } catch {
    console.error("Booking notification failed");
    return "failed";
  }
}
