import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { tierAtLeast } from "./tiers.ts";
import {
  BROADCAST_BATCH_SIZE,
  BROADCAST_CLAIM_MS,
  BROADCAST_RATE_MAX,
  BROADCAST_RATE_WINDOW_SECONDS,
  broadcastFromAddress,
  broadcastId,
  broadcastRateDecision,
  buildMessages,
  composeRecipientList,
  decideClaim,
  deliverBroadcast,
  emailFromUnsubscribeToken,
  parseAudiences,
  resendPayload,
  runBroadcast,
  unsubscribeLink,
  unsubscribeToken,
  validateBroadcast,
  type AudienceGroups,
  type BroadcastStore,
  type OutboundEmail,
} from "./broadcast.ts";
import {
  BROADCAST_EMPTY,
  BROADCAST_RATE_LIMITED,
  BROADCAST_SEND_FAILED,
  DEFAULT_AUDIENCES,
  DEFAULT_BODY,
  DEFAULT_SUBJECT,
  GENERAL_FOOTER,
  SUPPORTER_VIP_FOOTER,
  alreadySentMessage,
  broadcastFooter,
  unsubscribeDocument,
} from "./broadcast-copy.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FROM = "Official #Hero <noreply@officialheromusic.com>";
const SECRET = "test-secret-not-used-for-real-mail";
const API_KEY = "test-not-a-real-resend-key";
const originalFetch = globalThis.fetch;

test.before(() => {
  globalThis.fetch = async () => {
    throw new Error("Refusing to send a real email from tests");
  };
});

test.after(() => {
  globalThis.fetch = originalFetch;
});

function groups(partial: Partial<AudienceGroups> = {}): AudienceGroups {
  return {
    free: partial.free ?? [],
    supporter: partial.supporter ?? [],
    vip: partial.vip ?? [],
    newsletter: partial.newsletter ?? [],
  };
}

function memoryStore(options: { groups: AudienceGroups; unsubscribed?: string[] }) {
  const rows = new Map<string, { sentAt: Date; recipientCount: number; sentBy: string; subject: string }>();
  const calls = { recipients: 0, claim: 0, release: 0, complete: 0 };
  const store: BroadcastStore = {
    async recipients() {
      calls.recipients += 1;
      return { groups: options.groups, unsubscribed: options.unsubscribed ?? [] };
    },
    async claim(input) {
      calls.claim += 1;
      const existing = rows.get(input.id) ?? null;
      const decision = decideClaim(existing, input.now.getTime());
      if (decision === "already" && existing) return { status: "already", sentAt: existing.sentAt };
      if (decision === "in_progress" && existing) return { status: "in_progress", sentAt: existing.sentAt };
      if (decision === "reclaim") rows.delete(input.id);
      rows.set(input.id, { sentAt: input.now, recipientCount: 0, sentBy: input.sentBy, subject: input.subject });
      return { status: "claimed" };
    },
    async release(id) {
      calls.release += 1;
      const row = rows.get(id);
      if (row?.recipientCount === 0) rows.delete(id);
    },
    async complete(id, count) {
      calls.complete += 1;
      const row = rows.get(id);
      if (!row || row.recipientCount !== 0) throw new Error("missing claim");
      row.recipientCount = count;
    },
  };
  return { store, rows, calls };
}

function okFetch(seen: { url: string; init: RequestInit | undefined }[]): typeof fetch {
  return async (input, init) => {
    seen.push({ url: String(input), init });
    const body = JSON.parse(String(init?.body || "[]")) as unknown[];
    return new Response(JSON.stringify({ data: body.map(() => ({ id: "email_test" })) }), { status: 200 });
  };
}

test("default copy, footer, and audience match the unreleased note", () => {
  assert.deepEqual(
    DEFAULT_AUDIENCES,
    ["supporter", "vip"],
  );
  assert.deepEqual(
    DEFAULT_AUDIENCES,
    ["free", "supporter", "vip"].filter((tier) => tierAtLeast(tier as "free", "supporter")),
  );
  assert.equal(DEFAULT_SUBJECT, "2 unreleased #Hero songs just dropped for you");
  assert.equal(
    DEFAULT_BODY,
    'You\'re in. "Listen" and "Still There" are now streaming in Early Access, just for Supporters and VIPs, before anyone else hears them. Listen now: https://officialheromusic.com/members/early-access',
  );
  assert.equal(broadcastFooter(DEFAULT_AUDIENCES), SUPPORTER_VIP_FOOTER);
  assert.equal(broadcastFooter(["free"]), GENERAL_FOOTER);
  assert.equal(broadcastFooter(["supporter", "free"]), GENERAL_FOOTER);
  assert.equal(broadcastFooter(["newsletter"]), GENERAL_FOOTER);
  assert.equal(broadcastFooter(["supporter", "vip", "newsletter"]), GENERAL_FOOTER);
});

test("from address reuses the ADMIN_EMAIL_FROM domain", () => {
  assert.equal(broadcastFromAddress("Official #Hero <noreply@officialheromusic.com>"), FROM);
  assert.equal(broadcastFromAddress("noreply@officialheromusic.com"), FROM);
  assert.equal(broadcastFromAddress("Hero <hello@officialheromusic.com>"), FROM);
  assert.equal(broadcastFromAddress("not-an-email"), null);
  assert.equal(broadcastFromAddress("user@evil.com\nBcc: victim@example.com"), null);
  assert.equal(broadcastFromAddress(undefined), null);
});

test("idempotency key ignores audience order and changes with the message", () => {
  const first = broadcastId(DEFAULT_SUBJECT, DEFAULT_BODY, ["supporter", "vip"]);
  const reversed = broadcastId(DEFAULT_SUBJECT, DEFAULT_BODY, ["vip", "supporter"]);
  assert.equal(first, reversed);
  assert.notEqual(first, broadcastId(DEFAULT_SUBJECT, `${DEFAULT_BODY} Thanks.`, ["supporter", "vip"]));
  assert.notEqual(first, broadcastId(DEFAULT_SUBJECT, DEFAULT_BODY, ["free", "supporter", "vip"]));
  assert.equal(first.length, 64);
});

test("already sent message names the UTC date", () => {
  assert.equal(alreadySentMessage(new Date("2026-11-05T23:30:00Z")), "Already sent on November 5, 2026");
  assert.match(alreadySentMessage(new Date(Number.NaN)), /^Already sent on /);
});

test("audience parsing accepts the mailing list and rejects unknown groups", () => {
  assert.deepEqual(parseAudiences(["vip", "free"]), { ok: true, audiences: ["free", "vip"] });
  assert.deepEqual(parseAudiences(["newsletter", "vip"]), { ok: true, audiences: ["vip", "newsletter"] });
  assert.equal(parseAudiences([]).ok, false);
  const newsletter = parseAudiences(["newsletter"]);
  assert.deepEqual(newsletter, { ok: true, audiences: ["newsletter"] });
  const unknown = parseAudiences(["supporter", "everyone"]);
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.error.includes("everyone"), false);
});

test("counts are per group and the total is deduped, skipping unsubscribed addresses", () => {
  const composed = composeRecipientList({
    groups: groups({
      free: ["Free@Example.com", "free@example.com", "not-an-email"],
      supporter: ["Fan@Example.com", "gone@example.com"],
      vip: ["vip@example.com"],
      newsletter: ["Fan@Example.com", "list@example.com"],
    }),
    unsubscribed: ["gone@example.com"],
    selected: ["supporter", "vip", "newsletter"],
  });
  assert.equal(composed.counts.free, 1);
  assert.equal(composed.counts.supporter, 1);
  assert.equal(composed.counts.vip, 1);
  assert.equal(composed.counts.newsletter, 2);
  assert.deepEqual(composed.recipients, ["fan@example.com", "list@example.com", "vip@example.com"]);
  assert.equal(composed.total, 3);
  assert.equal(composed.recipients.includes("gone@example.com"), false);
});

test("unsubscribe tokens are one address, signed, and not guessable", () => {
  const token = unsubscribeToken("Fan@Example.com", SECRET);
  assert.ok(token);
  assert.equal(emailFromUnsubscribeToken(token || "", SECRET), "fan@example.com");
  assert.equal(emailFromUnsubscribeToken(token || "", "other-secret"), null);
  const link = unsubscribeLink(token || "");
  assert.equal(link, `https://officialheromusic.com/unsubscribe?token=${token}`);
  const [payload, signature] = (token || "").split(".");
  assert.equal(emailFromUnsubscribeToken(`${payload}.${signature.slice(0, -1)}a`, SECRET), null);
  assert.equal(emailFromUnsubscribeToken(`${payload}.short`, SECRET), null);
  assert.equal(unsubscribeToken("not-an-email", SECRET), null);
  assert.equal(unsubscribeLink("token\nwith-break"), null);
  const page = unsubscribeDocument("ok");
  assert.match(page, /You&#39;re unsubscribed/);
  assert.equal(page.includes("fan@example.com"), false);
  assert.equal(page.includes(token || "missing-token"), false);
});

test("each message has one recipient, a plain-text version, and its own unsubscribe link", () => {
  const messages = buildMessages({
    recipients: ["one@example.com", "two@example.com"],
    subject: DEFAULT_SUBJECT,
    body: `${DEFAULT_BODY}\n<script>alert(1)</script>`,
    from: FROM,
    audiences: ["supporter", "vip"],
    secret: SECRET,
  });
  assert.equal(messages.length, 2);
  assert.deepEqual(
    messages.map((message) => message.to),
    [["one@example.com"], ["two@example.com"]],
  );
  for (const message of messages) {
    assert.equal(message.to.length, 1);
    assert.equal("bcc" in message, false);
    assert.equal("cc" in message, false);
    assert.match(message.text, /You're getting this because you're a #Hero Supporter or VIP member\./);
    assert.match(message.text, /Unsubscribe: https:\/\/officialheromusic.com\/unsubscribe\?token=/);
    assert.match(message.html, /href="https:\/\/officialheromusic.com\/members\/early-access"/);
    assert.match(message.html, /&lt;script&gt;/);
    assert.equal(message.html.includes("<script>"), false);
    assert.match(message.headers["List-Unsubscribe"], /^<https:\/\/officialheromusic\.com\/unsubscribe\?token=/);
    assert.equal(message.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    const own = message.to[0];
    const other = own === "one@example.com" ? "two@example.com" : "one@example.com";
    assert.equal(message.text.includes(other), false);
    assert.equal(message.html.includes(other), false);
  }
  assert.notEqual(messages[0]?.text, messages[1]?.text);
  const freeCopy = buildMessages({
    recipients: ["one@example.com"],
    subject: "Hello",
    body: "Hello",
    from: FROM,
    audiences: ["free"],
    secret: SECRET,
  });
  assert.match(freeCopy[0]?.text || "", /#Hero account or signed up for updates/);
});

test("delivery refuses a shared recipient list and never calls the ambient fetch", async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const previousKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "re_this-must-not-be-used";
  try {
    const messages = buildMessages({
      recipients: Array.from({ length: BROADCAST_BATCH_SIZE + 1 }, (_, index) => `fan${index}@example.com`),
      subject: DEFAULT_SUBJECT,
      body: DEFAULT_BODY,
      from: FROM,
      audiences: ["supporter"],
      secret: SECRET,
    });
    const result = await deliverBroadcast(messages, API_KEY, okFetch(seen), "a".repeat(64));
    assert.equal(result.sent, BROADCAST_BATCH_SIZE + 1);
    assert.equal(result.failed, 0);
    assert.equal(seen.length, 2);
    assert.equal(seen[0]?.url, "https://api.resend.com/emails/batch");
    assert.equal(seen[1]?.url, "https://api.resend.com/emails/batch");
    const firstHeaders = new Headers(seen[0]?.init?.headers);
    const secondHeaders = new Headers(seen[1]?.init?.headers);
    assert.equal(firstHeaders.get("Authorization"), `Bearer ${API_KEY}`);
    assert.equal(firstHeaders.get("Authorization")?.includes("re_this-must-not-be-used"), false);
    assert.equal(firstHeaders.get("Idempotency-Key"), `${"a".repeat(64)}:0`);
    assert.equal(secondHeaders.get("Idempotency-Key"), `${"a".repeat(64)}:1`);
    const firstBody = JSON.parse(String(seen[0]?.init?.body)) as { to: string[]; bcc?: string[]; cc?: string[] }[];
    const secondBody = JSON.parse(String(seen[1]?.init?.body)) as { to: string[] }[];
    assert.equal(firstBody.length, 100);
    assert.equal(secondBody.length, 1);
    for (const item of firstBody) {
      assert.equal(item.to.length, 1);
      assert.equal(item.bcc, undefined);
      assert.equal(item.cc, undefined);
    }
    const poisoned = { ...messages[0], to: ["one@example.com", "two@example.com"] } as OutboundEmail;
    await assert.rejects(() => deliverBroadcast([poisoned], API_KEY, okFetch([]), "b".repeat(64)));
    assert.throws(() => resendPayload(poisoned));
  } finally {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  }
});

test("a broadcast sends once, skips unsubscribed people, and blocks the same send", async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const { store, rows, calls } = memoryStore({
    groups: groups({
      free: ["free@example.com"],
      supporter: ["fan@example.com", "gone@example.com", "fan@example.com"],
      vip: ["vip@example.com"],
    }),
    unsubscribed: ["gone@example.com"],
  });
  const now = new Date("2026-11-05T18:00:00Z");
  const first = await runBroadcast({
    subject: DEFAULT_SUBJECT,
    body: DEFAULT_BODY,
    audiences: ["vip", "supporter"],
    sentBy: "hero@officialheromusic.com",
    from: FROM,
    apiKey: API_KEY,
    secret: SECRET,
    now,
    rateAllowed: true,
    store,
    fetchImpl: okFetch(seen),
  });
  assert.deepEqual(first, { ok: true, recipientCount: 2, failed: 0 });
  const sent = JSON.parse(String(seen[0]?.init?.body)) as { to: string[] }[];
  assert.deepEqual(
    sent.map((item) => item.to[0]).sort(),
    ["fan@example.com", "vip@example.com"],
  );
  assert.equal(JSON.stringify(sent).includes("gone@example.com"), false);
  assert.equal(JSON.stringify(sent).includes("free@example.com"), false);
  const row = [...rows.values()][0];
  assert.equal(row?.recipientCount, 2);
  assert.equal(row?.subject, DEFAULT_SUBJECT);
  assert.equal(row?.sentBy, "hero@officialheromusic.com");

  const second = await runBroadcast({
    subject: ` ${DEFAULT_SUBJECT} `,
    body: DEFAULT_BODY,
    audiences: ["supporter", "vip"],
    sentBy: "hero@officialheromusic.com",
    from: FROM,
    apiKey: API_KEY,
    secret: SECRET,
    now: new Date(now.getTime() + 60_000),
    rateAllowed: true,
    store,
    fetchImpl: okFetch(seen),
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.error, "Already sent on November 5, 2026");
  assert.equal(seen.length, 1);
  assert.equal(calls.release, 0);
});

test("overlapping addresses are emailed once, and a failed send can be retried", async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const failing: typeof fetch = async (input, init) => {
    seen.push({ url: String(input), init });
    return new Response("no", { status: 500 });
  };
  const { store, calls } = memoryStore({
    groups: groups({
      supporter: ["fan@example.com"],
      vip: ["fan@example.com"],
    }),
  });
  const failed = await runBroadcast({
    subject: "Hello",
    body: "Hello there",
    audiences: ["supporter", "vip"],
    sentBy: "hero@officialheromusic.com",
    from: FROM,
    apiKey: API_KEY,
    secret: SECRET,
    rateAllowed: true,
    store,
    fetchImpl: failing,
  });
  assert.deepEqual(failed, { ok: false, error: BROADCAST_SEND_FAILED });
  const payload = JSON.parse(String(seen[0]?.init?.body)) as { to: string[] }[];
  assert.equal(payload.length, 1);
  assert.deepEqual(payload[0]?.to, ["fan@example.com"]);
  assert.equal(calls.release, 1);

  const retried = await runBroadcast({
    subject: "Hello",
    body: "Hello there",
    audiences: ["supporter", "vip"],
    sentBy: "hero@officialheromusic.com",
    from: FROM,
    apiKey: API_KEY,
    secret: SECRET,
    rateAllowed: true,
    store,
    fetchImpl: okFetch(seen),
  });
  assert.deepEqual(retried, { ok: true, recipientCount: 1, failed: 0 });
  assert.equal(seen.length, 2);
});

test("in-progress, empty, unconfigured, and rate limited sends do not call Resend", async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl = okFetch(seen);
  const active = memoryStore({ groups: groups({ supporter: ["fan@example.com"] }) });
  const now = new Date("2026-11-05T18:00:00Z");
  await active.store.claim({
    id: broadcastId("Hello", "Hello there", ["supporter"]),
    sentBy: "hero@officialheromusic.com",
    subject: "Hello",
    now,
  });
  const inProgress = await runBroadcast({
    subject: "Hello",
    body: "Hello there",
    audiences: ["supporter"],
    sentBy: "hero@officialheromusic.com",
    from: FROM,
    apiKey: API_KEY,
    secret: SECRET,
    now: new Date(now.getTime() + 1000),
    rateAllowed: true,
    store: active.store,
    fetchImpl,
  });
  assert.equal(inProgress.ok, false);
  if (!inProgress.ok) assert.equal(inProgress.error, "A send is already in progress.");

  const empty = await runBroadcast({
    subject: "Hello",
    body: "Hello there",
    audiences: ["free"],
    sentBy: "hero@officialheromusic.com",
    from: FROM,
    apiKey: API_KEY,
    secret: SECRET,
    rateAllowed: true,
    store: active.store,
    fetchImpl,
  });
  assert.deepEqual(empty, { ok: false, error: BROADCAST_EMPTY });

  const blocked = await runBroadcast({
    subject: "Hello",
    body: "Hello there",
    audiences: ["supporter"],
    sentBy: "hero@officialheromusic.com",
    from: FROM,
    apiKey: API_KEY,
    secret: SECRET,
    rateAllowed: false,
    store: active.store,
    fetchImpl,
  });
  assert.deepEqual(blocked, { ok: false, error: BROADCAST_RATE_LIMITED });

  const emptyList = await runBroadcast({
    subject: "Hello",
    body: "Hello there",
    audiences: ["newsletter"],
    sentBy: "hero@officialheromusic.com",
    from: FROM,
    apiKey: API_KEY,
    secret: SECRET,
    rateAllowed: true,
    store: active.store,
    fetchImpl,
  });
  assert.deepEqual(emptyList, { ok: false, error: BROADCAST_EMPTY });
  assert.equal(seen.length, 0);
  assert.equal(validateBroadcast("Hello\nthere", "Body", ["supporter"]).ok, false);
  assert.equal(validateBroadcast("List note", "Hello there", ["newsletter"]).ok, true);
});

test("mailing list sends are deduped against members and skip unsubscribed addresses", async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const { store } = memoryStore({
    groups: groups({
      supporter: ["fan@example.com"],
      newsletter: ["Fan@Example.com", "list@example.com", "gone@example.com"],
    }),
    unsubscribed: ["gone@example.com"],
  });
  const result = await runBroadcast({
    subject: "Shop update",
    body: "The shop is open.",
    audiences: ["supporter", "newsletter"],
    sentBy: "hero@officialheromusic.com",
    from: FROM,
    apiKey: API_KEY,
    secret: SECRET,
    rateAllowed: true,
    store,
    fetchImpl: okFetch(seen),
  });
  assert.deepEqual(result, { ok: true, recipientCount: 2, failed: 0 });
  const payload = JSON.parse(String(seen[0]?.init?.body)) as { to: string[]; text: string }[];
  assert.deepEqual(
    payload.map((message) => message.to[0]).sort(),
    ["fan@example.com", "list@example.com"],
  );
  assert.equal(payload.some((message) => message.to.includes("gone@example.com")), false);
  assert.match(payload[0]?.text || "", /signed up for updates/);
  assert.equal((payload[0]?.text || "").includes("Supporter or VIP member"), false);
});

test("claim window and send rate stay bounded", () => {
  const sentAt = new Date("2026-11-05T12:00:00Z");
  const now = sentAt.getTime() + BROADCAST_CLAIM_MS;
  assert.equal(decideClaim(null, now), "claim");
  assert.equal(decideClaim({ sentAt, recipientCount: 0 }, now - 1), "in_progress");
  assert.equal(decideClaim({ sentAt, recipientCount: 0 }, now), "reclaim");
  assert.equal(decideClaim({ sentAt, recipientCount: 2 }, now + 86_400_000), "already");
  assert.equal(BROADCAST_RATE_MAX, 3);
  assert.equal(BROADCAST_RATE_WINDOW_SECONDS, 60 * 60);
  const start = Date.parse("2026-11-05T12:00:00Z");
  let snapshot: { count: number; lastRequest: number } | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const decision = broadcastRateDecision(snapshot, start + attempt);
    assert.equal(decision.allowed, true);
    snapshot = { count: decision.count, lastRequest: decision.lastRequest };
  }
  assert.equal(broadcastRateDecision(snapshot, start + 10).allowed, false);
  assert.equal(broadcastRateDecision(snapshot, start + BROADCAST_RATE_WINDOW_SECONDS * 1000).allowed, true);
});

test("join and waitlist addresses are stored, and the admin send stays gated", () => {
  const forms = readFileSync(join(root, "src/actions/forms.ts"), "utf8");
  assert.match(forms, /saveMailingSignup/);
  assert.match(forms, /source: "join"/);
  assert.match(forms, /source: "waitlist"/);
  assert.match(forms, /void payload/);
  assert.equal(forms.includes("INSERT"), false);
  assert.equal(forms.includes("resend.com"), false);

  const list = readFileSync(join(root, "src/lib/mailing-list.ts"), "utf8");
  assert.match(list, /CREATE TABLE IF NOT EXISTS mailing_list/);
  assert.match(list, /email text PRIMARY KEY/);
  assert.match(list, /created_at timestamptz NOT NULL DEFAULT NOW\(\)/);
  assert.match(list, /unsubscribed boolean NOT NULL DEFAULT false/);
  assert.match(list, /source IN \('join', 'waitlist'\)/);
  assert.match(list, /ON CONFLICT \(email\) DO UPDATE/);
  assert.match(list, /mailing_list\.unsubscribed OR EXCLUDED\.unsubscribed/);
  assert.match(list, /SET unsubscribed = true/);
  assert.match(list, /normalizeEmail/);

  const action = readFileSync(join(root, "src/app/admin/email/actions.ts"), "utf8");
  const page = readFileSync(join(root, "src/app/admin/(panel)/email/page.tsx"), "utf8");
  const unreleased = readFileSync(join(root, "src/app/admin/(panel)/unreleased/page.tsx"), "utf8");
  const form = readFileSync(join(root, "src/components/admin/BroadcastForm.tsx"), "utf8");
  const panel = readFileSync(join(root, "src/components/admin/BroadcastPanel.tsx"), "utf8");
  const store = readFileSync(join(root, "src/lib/broadcast-store.ts"), "utf8");
  const route = readFileSync(join(root, "src/app/unsubscribe/route.ts"), "utf8");
  const delivery = readFileSync(join(root, "src/lib/broadcast.ts"), "utf8");
  const copy = readFileSync(join(root, "src/lib/constants.ts"), "utf8");

  assert.equal(/\bhis\b/i.test(copy), false);
  assert.match(action, /guardAdminMutation\(\{\s*recent:\s*true/);
  assert.match(action, /recentError:/);
  assert.match(action, /consumeBroadcastRateLimit/);
  assert.match(action, /confirm"\) \|\| ""\) !== "send"/);
  assert.match(action, /fetchImpl: fetch/);
  assert.equal(action.includes("newsletterStored"), false);
  assert.match(page, /requireAdmin/);
  assert.match(unreleased, /BroadcastPanel/);
  assert.match(panel, /requireAdmin/);
  assert.match(form, /SELECTABLE_AUDIENCES/);
  assert.equal(form.includes("Not stored"), false);
  assert.equal(form.includes("NEWSLETTER_MISSING"), false);
  assert.match(form, /await sendBroadcast\(/);
  assert.equal(form.includes("action={sendBroadcast}"), false);
  assert.match(form, /Confirm and send/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS member_broadcast/);
  assert.match(store, /"sentAt"/);
  assert.match(store, /"sentBy"/);
  assert.match(store, /"recipientCount"/);
  assert.match(store, /email_unsubscribe/);
  assert.match(store, /FROM mailing_list WHERE unsubscribed = false/);
  assert.match(store, /markMailingListUnsubscribed/);
  assert.equal(store.includes("newsletterStored: false"), false);
  assert.match(store, /FOR UPDATE/);
  assert.match(store, /23505/);
  assert.match(store, /ON CONFLICT \(email\) DO NOTHING/);
  assert.match(delivery, /https:\/\/api\.resend\.com\/emails\/batch/);
  assert.match(route, /unsubscribeFromBroadcast/);
  assert.match(route, /unsubscribeDocument\(result\)/);
  assert.equal(route.includes("requireAdmin"), false);
  assert.equal(route.includes("resend.com"), false);
  assert.equal(route.includes("${token}"), false);

  for (const source of [action, store, route, delivery, list]) {
    for (const line of source.split("\n")) {
      if (!line.includes("console.")) continue;
      assert.equal(line.includes("${"), false, line);
      assert.equal(line.includes("formData"), false, line);
    }
  }
});
