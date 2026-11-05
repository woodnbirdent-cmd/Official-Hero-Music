import { SITE } from "./constants.ts";
import { TIERS, tierAtLeast, type Tier } from "./tiers.ts";

/** Member tiers that can be selected. One row in "user" has one tier. */
export const MEMBER_AUDIENCES = TIERS;

export type MemberAudience = Tier;

export type MemberCounts = Record<MemberAudience, number>;

export const NEWSLETTER_AUDIENCE = "newsletter" as const;

export type AudienceId = MemberAudience | typeof NEWSLETTER_AUDIENCE;

export type AudienceCounts = Record<AudienceId, number>;

/** Member tiers, then the mailing list. Checkbox order on /admin/email. */
export const SELECTABLE_AUDIENCES: readonly AudienceId[] = [...MEMBER_AUDIENCES, NEWSLETTER_AUDIENCE];

/** Supporter and VIP, matching the prefilled unreleased-songs note. */
export const DEFAULT_AUDIENCES: MemberAudience[] = MEMBER_AUDIENCES.filter((tier) =>
  tierAtLeast(tier, "supporter"),
);

export const DEFAULT_SUBJECT = "2 unreleased #Hero songs just dropped for you";

export const DEFAULT_BODY =
  'You\'re in. "Listen" and "Still There" are now streaming in Early Access, just for Supporters and VIPs, before anyone else hears them. Listen now: https://officialheromusic.com/members/early-access';

export const SUPPORTER_VIP_FOOTER =
  "You're getting this because you're a #Hero Supporter or VIP member.";

export const GENERAL_FOOTER =
  "You're getting this because you have a #Hero account or signed up for updates.";

/** Join and merch waitlist addresses live in mailing_list. Unsubscribed rows are excluded. */
export const AUDIENCE_LABELS: Record<AudienceId, string> = {
  free: "Free members",
  supporter: "Supporter",
  vip: "VIP",
  newsletter: "Mailing list",
};

export const BROADCAST_RATE_LIMITED = "Too many send attempts. Try again later.";

export const BROADCAST_NOT_CONFIGURED =
  "Email is not configured. Set RESEND_API_KEY and ADMIN_EMAIL_FROM.";

export const BROADCAST_SEND_FAILED = "Could not send the email. Nothing was delivered.";

export const BROADCAST_IN_PROGRESS = "A send is already in progress.";

export const BROADCAST_CONFIRM_REQUIRED = "Confirm the send before emailing.";

export const BROADCAST_EMPTY = "No one to email in the groups you selected.";

export const BROADCAST_CHOOSE = "Choose at least one group.";

export const BROADCAST_BAD_GROUP = "Choose a real group.";

export const BROADCAST_SUBJECT_REQUIRED = "Add a subject.";

export const BROADCAST_SUBJECT_LONG = "Subject is too long.";

export const BROADCAST_SUBJECT_LINE = "Subject must be one line.";

export const BROADCAST_BODY_REQUIRED = "Add a message.";

export const BROADCAST_BODY_LONG = "Message is too long.";

export const BROADCAST_NOT_RECORDED = "Could not record the broadcast, so nothing was sent.";

export const BROADCAST_COUNT_FAILED = "Could not count recipients.";

export const UNSUBSCRIBE_PREVIEW = `${SITE.url}/unsubscribe?token=…`;

export const SUBJECT_MAX = 200;

export const BODY_MAX = 8000;

/** Paid-only sends keep the Supporter and VIP footer. Any other mix uses the general line. */
export function broadcastFooter(audiences: readonly AudienceId[]): string {
  const onlyPaid =
    audiences.length > 0 && audiences.every((audience) => audience === "supporter" || audience === "vip");
  return onlyPaid ? SUPPORTER_VIP_FOOTER : GENERAL_FOOTER;
}

export function alreadySentMessage(sentAt: Date): string {
  if (Number.isNaN(sentAt.getTime())) return "Already sent on an unknown date";
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(sentAt);
  return `Already sent on ${formatted}`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Link only https URLs. Everything else is escaped. */
export function htmlWithLinks(value: string): string {
  const parts = value.split(/(https:\/\/[^\s]+)/g);
  return parts
    .map((part) => {
      if (/^https:\/\/[^\s]+$/.test(part)) {
        const safe = escapeHtml(part);
        return `<a href="${safe}">${safe}</a>`;
      }
      return escapeHtml(part);
    })
    .join("");
}

export function unsubscribeDocument(status: "ok" | "invalid" | "unavailable"): string {
  const title =
    status === "ok" ? "You're unsubscribed" : status === "invalid" ? "Link not valid" : "Try again";
  const message =
    status === "ok"
      ? "You're unsubscribed. You won't get these emails."
      : status === "invalid"
        ? "This unsubscribe link is not valid."
        : "We couldn't update that just now. Open the link again in a minute.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;background:#000;color:#fff;font-family:Arial,sans-serif;">
  <main style="max-width:32rem;margin:0 auto;padding:3rem 1.5rem;">
    <p style="letter-spacing:0.2em;text-transform:uppercase;font-size:12px;color:#aa9371;">Official #Hero</p>
    <h1 style="font-size:2rem;line-height:1.1;">${escapeHtml(title)}</h1>
    <p style="font-size:1rem;line-height:1.5;color:#ddd;">${escapeHtml(message)}</p>
  </main>
</body>
</html>`;
}
