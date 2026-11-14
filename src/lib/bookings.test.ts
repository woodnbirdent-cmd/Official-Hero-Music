import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  BOOKING_MESSAGE_MAX,
  bookingNoticeEmail,
  bookingNotifyEmails,
  parseBookingFields,
  sendBookingNotification,
  type BookingNotice,
} from "./bookings.ts";

const root = join(import.meta.dirname, "../..");

const notice: BookingNotice = {
  name: "TEST Lee & Co <script>",
  email: "requester@example.com",
  org: "Woodnbird",
  eventDate: "2026-12-01",
  message: "TEST booking\nCapacity: 200",
  submittedAt: new Date("2026-11-14T15:00:00Z"),
};

test("booking notices go to Lee and #Hero unless the env list replaces them", () => {
  assert.deepEqual(bookingNotifyEmails(undefined), [
    "woodnbirdent@gmail.com",
    "hero@officialheromusic.com",
  ]);
  assert.deepEqual(bookingNotifyEmails("  "), [
    "woodnbirdent@gmail.com",
    "hero@officialheromusic.com",
  ]);
  assert.deepEqual(bookingNotifyEmails("Owner <owner@example.com>, owner@example.com, bad"), [
    "owner@example.com",
  ]);
});

test("booking fields keep the other forms' checks and drop a filled honeypot", () => {
  const saved = parseBookingFields({
    name: "  Ada ",
    email: "Ada@Example.com",
    org: "",
    date: "",
    message: "Church night",
    companyWebsite: "   ",
  });
  assert.deepEqual(saved, {
    ok: true,
    spam: false,
    value: {
      name: "Ada",
      email: "ada@example.com",
      org: "",
      eventDate: "",
      message: "Church night",
    },
  });

  assert.deepEqual(
    parseBookingFields({
      name: "",
      email: "not-an-email",
      org: "",
      date: "2026-02-31",
      message: "",
      companyWebsite: "https://spam.example",
    }),
    { ok: true, spam: true },
  );
  const missingName = parseBookingFields({ ...blank(), name: "" });
  assert.equal(missingName.ok, false);
  if (!missingName.ok) assert.equal(missingName.error, "Name is required");
  const badEmail = parseBookingFields({ ...blank(), email: "ada@example" });
  assert.equal(badEmail.ok, false);
  if (!badEmail.ok) assert.equal(badEmail.error, "Enter a valid email");
  assert.equal(
    (parseBookingFields({ ...blank(), date: "2026-02-31" }) as { error?: string }).error,
    "Enter a valid event date",
  );
  assert.equal(
    (parseBookingFields({ ...blank(), message: "x".repeat(BOOKING_MESSAGE_MAX + 1) }) as { error?: string }).error,
    `Keep the message to ${BOOKING_MESSAGE_MAX} characters`,
  );
});

test("booking email replies to the requester and escapes the message", () => {
  const body = bookingNoticeEmail(notice);
  assert.match(body.subject, /^Booking request — TEST/);
  assert.equal(body.subject.includes("\n"), false);
  assert.match(body.text, /requester@example.com/);
  assert.match(body.text, /Dec 1, 2026/);
  assert.match(body.html, /&lt;script&gt;/);
  assert.equal(body.html.includes("<script>"), false);
  assert.match(body.html, /white-space:pre-wrap/);
});

test("a failed booking email is logged without personal data and does not throw", async () => {
  const logs: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map((item) => String(item)).join(" "));
  };
  try {
    const failed = await sendBookingNotification(notice, {
      env: {
        RESEND_API_KEY: "re_test",
        ADMIN_EMAIL_FROM: "Official #Hero <noreply@officialheromusic.com>",
      },
      fetchImpl: async () => new Response(JSON.stringify({ message: notice.email }), { status: 422 }),
    });
    const thrown = await sendBookingNotification(notice, {
      env: {
        RESEND_API_KEY: "re_test",
        ADMIN_EMAIL_FROM: "Official #Hero <noreply@officialheromusic.com>",
      },
      fetchImpl: async () => {
        throw new Error(notice.message);
      },
    });
    assert.equal(failed, "failed");
    assert.equal(thrown, "failed");
  } finally {
    console.error = original;
  }
  const text = logs.join("\n");
  assert.match(text, /Booking notification failed/);
  assert.equal(text.includes(notice.email), false);
  assert.equal(text.includes(notice.name), false);
  assert.equal(text.includes(notice.message), false);
});

test("booking mail uses the site from-address, both inboxes, and reply-to", async () => {
  let payload: { from?: string; to?: string[]; reply_to?: string; subject?: string } = {};
  const result = await sendBookingNotification(notice, {
    env: {
      RESEND_API_KEY: "re_test",
      ADMIN_EMAIL_FROM: "#Hero Admin <noreply@officialheromusic.com>",
    },
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(String(init?.body)) as typeof payload;
      return new Response("{}", { status: 200 });
    },
  });
  assert.equal(result, "sent");
  assert.equal(payload.from, "#Hero Admin <noreply@officialheromusic.com>");
  assert.deepEqual(payload.to, ["woodnbirdent@gmail.com", "hero@officialheromusic.com"]);
  assert.equal(payload.reply_to, notice.email);
});

test("booking storage is a new table and the other forms stay put", () => {
  const forms = readFileSync(join(root, "src/actions/forms.ts"), "utf8");
  const store = readFileSync(join(root, "src/lib/booking-store.ts"), "utf8");
  const prayer = forms.slice(forms.indexOf("export async function submitPrayer"));
  assert.match(prayer, /persistSubmission\("prayer"/);
  assert.equal(prayer.includes("acceptBooking"), false);
  assert.equal(forms.includes("INSERT"), false);
  assert.equal(forms.includes("resend.com"), false);
  assert.match(forms, /acceptBooking/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS booking_requests/);
  assert.match(store, /ORDER BY created_at DESC/);
  assert.match(store, /await requireAdmin\(\)/);
  assert.match(store, /await sendBookingNotification/);
  assert.equal(store.includes("DROP "), false);
  assert.equal(store.includes("TRUNCATE"), false);
  assert.equal(store.includes("DELETE "), false);
  assert.equal(store.includes("ALTER TABLE"), false);
  for (const line of store.split("\n")) {
    if (!line.includes("console.")) continue;
    assert.equal(line.includes("${"), false, line);
    assert.equal(line.includes("email"), false, line);
    assert.equal(line.includes("message"), false, line);
  }
});

function blank() {
  return {
    name: "Ada",
    email: "ada@example.com",
    org: "",
    date: "2026-12-01",
    message: "Hello",
    companyWebsite: "",
  };
}
