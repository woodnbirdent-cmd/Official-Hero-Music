import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { nextPasswordRate, type PasswordRateSnapshot } from "./admin-password-policy.ts";
import {
  BODY_MAX,
  BROADCAST_BAD_GROUP,
  BROADCAST_BODY_LONG,
  BROADCAST_BODY_REQUIRED,
  BROADCAST_CHOOSE,
  BROADCAST_EMPTY,
  BROADCAST_IN_PROGRESS,
  BROADCAST_NOT_CONFIGURED,
  BROADCAST_NOT_RECORDED,
  BROADCAST_RATE_LIMITED,
  BROADCAST_SEND_FAILED,
  BROADCAST_SUBJECT_LINE,
  BROADCAST_SUBJECT_LONG,
  BROADCAST_SUBJECT_REQUIRED,
  NEWSLETTER_AUDIENCE,
  SELECTABLE_AUDIENCES,
  SUBJECT_MAX,
  alreadySentMessage,
  broadcastFooter,
  escapeHtml,
  htmlWithLinks,
  type AudienceCounts,
  type AudienceId,
} from "./broadcast-copy.ts";
import { SITE } from "./constants.ts";
import { isTier } from "./tiers.ts";

export {
  BODY_MAX,
  DEFAULT_BODY,
  DEFAULT_SUBJECT,
  MEMBER_AUDIENCES,
  SUBJECT_MAX,
  broadcastFooter,
} from "./broadcast-copy.ts";

/** Resend accepts at most 100 emails per batch request. */
export const BROADCAST_BATCH_SIZE = 100;

/** A crashed claim can be retried after this. Resend idempotency covers the gap. */
export const BROADCAST_CLAIM_MS = 10 * 60 * 1000;

/** Confirmed sends, per admin. Preview counts are not limited by this. */
export const BROADCAST_RATE_WINDOW_SECONDS = 60 * 60;

export const BROADCAST_RATE_MAX = 3;

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const FROM_ADDRESS = /^Official #Hero <noreply@[a-z0-9.-]+\.[a-z]{2,}>$/;

export type { AudienceCounts, AudienceId, MemberAudience, MemberCounts } from "./broadcast-copy.ts";

export type BroadcastResult =
  | { ok: true; recipientCount: number; failed: number }
  | { ok: false; error: string };

export type BroadcastClaim =
  | { status: "claimed" }
  | { status: "already"; sentAt: Date }
  | { status: "in_progress"; sentAt: Date };

export type AudienceGroups = Record<AudienceId, string[]>;

export type BroadcastStore = {
  recipients(): Promise<{
    groups: AudienceGroups;
    unsubscribed: string[];
  }>;
  claim(input: { id: string; sentBy: string; subject: string; now: Date }): Promise<BroadcastClaim>;
  release(id: string): Promise<void>;
  complete(id: string, recipientCount: number): Promise<void>;
};

export type OutboundEmail = {
  from: string;
  to: [string];
  subject: string;
  text: string;
  html: string;
  headers: {
    "List-Unsubscribe": string;
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click";
  };
};

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  if (!EMAIL.test(email)) return null;
  return email;
}

export function broadcastFromAddress(adminEmailFrom: string | undefined): string | null {
  if (!adminEmailFrom) return null;
  const trimmed = adminEmailFrom.trim();
  if (/[\r\n]/.test(trimmed)) return null;
  const angled = trimmed.match(/<([^<>\s]+)>/);
  const source = angled?.[1] ?? trimmed;
  const match = source.match(/^[^@\s]+@([a-z0-9.-]+\.[a-z]{2,})$/i);
  if (!match?.[1]) return null;
  const domain = match[1].toLowerCase();
  if (domain.includes("..") || domain.startsWith(".") || domain.endsWith(".")) return null;
  return `Official #Hero <noreply@${domain}>`;
}

export function broadcastRateDecision(current: PasswordRateSnapshot | null, now: number) {
  return nextPasswordRate(current, now, BROADCAST_RATE_WINDOW_SECONDS * 1000, BROADCAST_RATE_MAX);
}

export function parseAudiences(
  values: readonly string[],
): { ok: true; audiences: AudienceId[] } | { ok: false; error: string } {
  if (values.length === 0) return { ok: false, error: BROADCAST_CHOOSE };
  const picked = new Set<AudienceId>();
  for (const value of values) {
    if (value === NEWSLETTER_AUDIENCE) {
      picked.add(NEWSLETTER_AUDIENCE);
      continue;
    }
    if (!isTier(value)) return { ok: false, error: BROADCAST_BAD_GROUP };
    picked.add(value);
  }
  if (picked.size === 0) return { ok: false, error: BROADCAST_CHOOSE };
  return { ok: true, audiences: SELECTABLE_AUDIENCES.filter((audience) => picked.has(audience)) };
}

export function validateBroadcast(
  subject: string,
  body: string,
  audiences: readonly string[],
): { ok: true; subject: string; body: string; audiences: AudienceId[] } | { ok: false; error: string } {
  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (!trimmedSubject) return { ok: false, error: BROADCAST_SUBJECT_REQUIRED };
  if (trimmedSubject.length > SUBJECT_MAX) return { ok: false, error: BROADCAST_SUBJECT_LONG };
  if (/[\r\n]/.test(trimmedSubject)) return { ok: false, error: BROADCAST_SUBJECT_LINE };
  if (!trimmedBody) return { ok: false, error: BROADCAST_BODY_REQUIRED };
  if (trimmedBody.length > BODY_MAX) return { ok: false, error: BROADCAST_BODY_LONG };
  const parsed = parseAudiences(audiences);
  if (!parsed.ok) return parsed;
  return { ok: true, subject: trimmedSubject, body: trimmedBody, audiences: parsed.audiences };
}

/** Same subject, message, and audience cannot be sent twice. Audience order does not matter. */
export function broadcastId(subject: string, body: string, audiences: readonly AudienceId[]): string {
  const key = JSON.stringify({
    subject: subject.trim(),
    body: body.trim(),
    audiences: [...audiences].sort(),
  });
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function decideClaim(
  existing: { sentAt: Date; recipientCount: number } | null,
  now: number,
): "claim" | "already" | "in_progress" | "reclaim" {
  if (!existing) return "claim";
  if (existing.recipientCount > 0) return "already";
  const age = now - existing.sentAt.getTime();
  if (!Number.isFinite(age) || age < BROADCAST_CLAIM_MS) return "in_progress";
  return "reclaim";
}

export function composeRecipientList(input: {
  groups: AudienceGroups;
  unsubscribed: readonly string[];
  selected: readonly AudienceId[];
}): { counts: Record<AudienceId, number>; recipients: string[]; total: number } {
  const blocked = new Set(
    input.unsubscribed
      .map((email) => normalizeEmail(email))
      .filter((email): email is string => Boolean(email)),
  );
  const counts = {} as Record<AudienceId, number>;
  const cleaned: Record<AudienceId, string[]> = {
    free: [],
    supporter: [],
    vip: [],
    newsletter: [],
  };
  for (const audience of Object.keys(cleaned) as AudienceId[]) {
    const seen = new Set<string>();
    for (const raw of input.groups[audience] ?? []) {
      const email = normalizeEmail(raw);
      if (!email || blocked.has(email) || seen.has(email)) continue;
      seen.add(email);
      cleaned[audience].push(email);
    }
    counts[audience] = cleaned[audience].length;
  }
  const selected = new Set(input.selected);
  const recipients = [
    ...new Set(
      (Object.keys(cleaned) as AudienceId[])
        .filter((audience) => selected.has(audience))
        .flatMap((audience) => cleaned[audience]),
    ),
  ].sort();
  return { counts, recipients, total: recipients.length };
}

export function unsubscribeToken(email: string, secret: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized || !secret) return null;
  const payload = Buffer.from(normalized, "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(normalized).digest("base64url");
  return `${payload}.${signature}`;
}

export function emailFromUnsubscribeToken(token: string, secret: string): string | null {
  if (!secret || !token || token.length > 512) return null;
  const splitAt = token.indexOf(".");
  if (splitAt <= 0 || splitAt !== token.lastIndexOf(".")) return null;
  const payload = token.slice(0, splitAt);
  const signature = token.slice(splitAt + 1);
  if (!payload || !signature) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const email = normalizeEmail(decoded);
  if (!email || email !== decoded) return null;
  const expected = createHmac("sha256", secret).update(email).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  return email;
}

export function unsubscribeLink(token: string): string | null {
  if (!token || /[\r\n]/.test(token)) return null;
  const url = new URL("/unsubscribe", SITE.url);
  if (url.protocol !== "https:" || (url.host !== "officialheromusic.com" && url.host !== "www.officialheromusic.com")) {
    return null;
  }
  url.search = "";
  url.searchParams.set("token", token);
  return url.toString();
}

export function renderPlainText(body: string, audiences: readonly AudienceId[], unsubscribeUrl: string): string {
  return [body.trim(), "", "--", broadcastFooter(audiences), "", `Unsubscribe: ${unsubscribeUrl}`].join("\n");
}

export function renderHtml(body: string, audiences: readonly AudienceId[], unsubscribeUrl: string): string {
  const footer = escapeHtml(broadcastFooter(audiences));
  const href = escapeHtml(unsubscribeUrl);
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;background:#000000;color:#ffffff;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="white-space:pre-wrap;font-size:16px;line-height:1.5;">${htmlWithLinks(body.trim())}</div>
    <p style="color:#aaaaaa;font-size:12px;line-height:1.5;">${footer}<br><a href="${href}" style="color:#aa9371;">Unsubscribe</a></p>
  </div>
</body>
</html>`;
}

export function buildMessages(input: {
  recipients: readonly string[];
  subject: string;
  body: string;
  from: string;
  audiences: readonly AudienceId[];
  secret: string;
}): OutboundEmail[] {
  const messages: OutboundEmail[] = [];
  for (const raw of input.recipients) {
    const email = normalizeEmail(raw);
    if (!email) continue;
    const token = unsubscribeToken(email, input.secret);
    const unsubscribeUrl = token ? unsubscribeLink(token) : null;
    if (!token || !unsubscribeUrl) continue;
    messages.push({
      from: input.from,
      to: [email],
      subject: input.subject,
      text: renderPlainText(input.body, input.audiences, unsubscribeUrl),
      html: renderHtml(input.body, input.audiences, unsubscribeUrl),
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  }
  return messages;
}

export function resendPayload(message: OutboundEmail): {
  from: string;
  to: [string];
  subject: string;
  text: string;
  html: string;
  headers: OutboundEmail["headers"];
} {
  if (message.to.length !== 1 || !message.to[0]) {
    throw new Error("Refusing to send a broadcast with more than one recipient.");
  }
  return {
    from: message.from,
    to: [message.to[0]],
    subject: message.subject,
    text: message.text,
    html: message.html,
    headers: message.headers,
  };
}

export async function deliverBroadcast(
  messages: readonly OutboundEmail[],
  apiKey: string,
  fetchImpl: typeof fetch,
  id: string,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < messages.length; index += BROADCAST_BATCH_SIZE) {
    const batch = messages.slice(index, index + BROADCAST_BATCH_SIZE).map(resendPayload);
    const chunk = Math.floor(index / BROADCAST_BATCH_SIZE);
    try {
      const response = await fetchImpl("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `${id}:${chunk}`,
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(20_000),
      });
      await response.text().catch(() => "");
      if (!response.ok) {
        failed += batch.length;
        continue;
      }
      sent += batch.length;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Refusing to send")) throw error;
      failed += batch.length;
    }
  }
  return { sent, failed };
}

export async function runBroadcast(input: {
  subject: string;
  body: string;
  audiences: readonly string[];
  sentBy: string;
  from: string;
  apiKey: string;
  secret: string;
  now?: Date;
  rateAllowed: boolean;
  store: BroadcastStore;
  fetchImpl: typeof fetch;
}): Promise<BroadcastResult> {
  const validated = validateBroadcast(input.subject, input.body, input.audiences);
  if (!validated.ok) return validated;
  if (!input.rateAllowed) return { ok: false, error: BROADCAST_RATE_LIMITED };
  if (!input.apiKey || !input.secret || !FROM_ADDRESS.test(input.from)) {
    return { ok: false, error: BROADCAST_NOT_CONFIGURED };
  }

  let loaded: Awaited<ReturnType<BroadcastStore["recipients"]>>;
  try {
    loaded = await input.store.recipients();
  } catch {
    return { ok: false, error: BROADCAST_NOT_RECORDED };
  }
  const composed = composeRecipientList({
    groups: loaded.groups,
    unsubscribed: loaded.unsubscribed,
    selected: validated.audiences,
  });
  if (composed.recipients.length === 0) return { ok: false, error: BROADCAST_EMPTY };

  const now = input.now ?? new Date();
  const id = broadcastId(validated.subject, validated.body, validated.audiences);
  let claim: BroadcastClaim;
  try {
    claim = await input.store.claim({
      id,
      sentBy: input.sentBy.replace(/[\r\n]/g, "").slice(0, 320),
      subject: validated.subject,
      now,
    });
  } catch {
    return { ok: false, error: BROADCAST_NOT_RECORDED };
  }
  if (claim.status === "already") return { ok: false, error: alreadySentMessage(claim.sentAt) };
  if (claim.status === "in_progress") return { ok: false, error: BROADCAST_IN_PROGRESS };

  const messages = buildMessages({
    recipients: composed.recipients,
    subject: validated.subject,
    body: validated.body,
    from: input.from,
    audiences: validated.audiences,
    secret: input.secret,
  });
  if (messages.length === 0) {
    await input.store.release(id).catch(() => undefined);
    return { ok: false, error: BROADCAST_EMPTY };
  }

  let delivery: { sent: number; failed: number };
  try {
    delivery = await deliverBroadcast(messages, input.apiKey, input.fetchImpl, id);
  } catch {
    await input.store.release(id).catch(() => undefined);
    return { ok: false, error: BROADCAST_SEND_FAILED };
  }
  if (delivery.sent === 0) {
    await input.store.release(id).catch(() => undefined);
    return { ok: false, error: BROADCAST_SEND_FAILED };
  }
  try {
    await input.store.complete(id, delivery.sent);
  } catch {
    // Mail already went out. A later retry uses the same Resend idempotency key.
  }
  return { ok: true, recipientCount: delivery.sent, failed: delivery.failed };
}

export function publicCounts(counts: Record<AudienceId, number>): AudienceCounts {
  return {
    free: counts.free,
    supporter: counts.supporter,
    vip: counts.vip,
    newsletter: counts.newsletter,
  };
}
