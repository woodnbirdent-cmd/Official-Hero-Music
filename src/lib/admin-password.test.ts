import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ADMIN_PASSWORD_MAX_LENGTH,
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_PASSWORD_RATE_MAX,
  ADMIN_PASSWORD_RATE_WINDOW_SECONDS,
  PASSWORD_COMMON,
  PASSWORD_CURRENT_WRONG,
  PASSWORD_DIFFERENT,
  PASSWORD_EMAIL,
  PASSWORD_OPTIONAL_NOTICE,
  PASSWORD_TOO_LONG,
  PASSWORD_TOO_SHORT,
  PASSWORD_UPDATE_FAILED,
  adminPasswordIssue,
  hibpSuffixCount,
  nextPasswordRate,
  passwordBreachStatus,
  passwordFailureMessage,
} from "./admin-password-policy.ts";
import { ADMIN_SESSION_SECONDS, adminSignInRateLimits } from "./admin-security.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("admin passwords are at least 12 characters and reject common or identity values", () => {
  assert.equal(ADMIN_PASSWORD_MIN_LENGTH, 12);
  assert.equal(ADMIN_PASSWORD_MAX_LENGTH, 128);
  assert.equal(adminPasswordIssue("short-pass", "hero@officialheromusic.com"), PASSWORD_TOO_SHORT);
  assert.equal(adminPasswordIssue("a".repeat(129), "hero@officialheromusic.com"), PASSWORD_TOO_LONG);
  assert.equal(adminPasswordIssue(" ".repeat(12), "hero@officialheromusic.com"), PASSWORD_COMMON);
  assert.equal(adminPasswordIssue("aaaaaaaaaaaa", "hero@officialheromusic.com"), PASSWORD_COMMON);
  assert.equal(adminPasswordIssue("password1234", "hero@officialheromusic.com"), PASSWORD_COMMON);
  assert.equal(adminPasswordIssue("hero@officialheromusic.com", "Hero@officialheromusic.com"), PASSWORD_EMAIL);
  assert.equal(adminPasswordIssue("woodnbirdent", "woodnbirdent@gmail.com"), PASSWORD_EMAIL);
  assert.equal(adminPasswordIssue("rK7$mQ2vL9pX", "hero@officialheromusic.com"), null);
});

test("breach list parsing reads only the matching suffix", () => {
  const body = ["AAAAAA:0", "ABC123:42", "ZZZZZZ:1"].join("\r\n");
  assert.equal(hibpSuffixCount(body, "abc123"), 42);
  assert.equal(hibpSuffixCount(body, "missing"), 0);
  assert.equal(hibpSuffixCount("ABC123:nope", "abc123"), null);
});

test("password attempts use a fixed 5-per-10-minute window", () => {
  const windowMs = ADMIN_PASSWORD_RATE_WINDOW_SECONDS * 1000;
  assert.equal(ADMIN_PASSWORD_RATE_WINDOW_SECONDS, 10 * 60);
  assert.equal(ADMIN_PASSWORD_RATE_MAX, 5);
  const start = 1_000_000;
  let snapshot: { count: number; lastRequest: number } | null = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const decision = nextPasswordRate(snapshot, start + attempt * 1000, windowMs, ADMIN_PASSWORD_RATE_MAX);
    assert.equal(decision.allowed, true);
    assert.equal(decision.count, attempt);
    snapshot = { count: decision.count, lastRequest: decision.lastRequest };
  }
  const blocked = nextPasswordRate(snapshot, start + 20_000, windowMs, ADMIN_PASSWORD_RATE_MAX);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
  const reset = nextPasswordRate(snapshot, snapshot.lastRequest + windowMs, windowMs, ADMIN_PASSWORD_RATE_MAX);
  assert.equal(reset.allowed, true);
  assert.equal(reset.count, 1);
  const limits = adminSignInRateLimits();
  assert.equal(limits["/change-password"].window, ADMIN_PASSWORD_RATE_WINDOW_SECONDS);
  assert.equal(limits["/change-password"].max, ADMIN_PASSWORD_RATE_MAX);
});

test("breach checks send only a hash prefix and fail open when the service is down", async () => {
  const calls: string[] = [];
  const breached = await passwordBreachStatus("password1234", async (input) => {
    const url = String(input);
    calls.push(url);
    assert.equal(url.includes("password1234"), false);
    assert.match(url, /\/range\/[0-9A-F]{5}$/);
    return new Response(`${"0".repeat(35)}:12\n`, { status: 200 });
  });
  assert.equal(breached, "clear");
  const hit = await passwordBreachStatus("password1234", async () => {
    const hash = (await import("node:crypto")).createHash("sha1").update("password1234", "utf8").digest("hex").toUpperCase();
    return new Response(`${hash.slice(5)}:3\n`, { status: 200 });
  });
  assert.equal(hit, "breached");
  const down = await passwordBreachStatus("rK7$mQ2vL9pX", async () => {
    throw new Error("offline");
  });
  assert.equal(down, "unavailable");
  assert.equal(calls.length, 1);
});

test("auth errors cannot echo a password back to the client", () => {
  assert.equal(passwordFailureMessage("INVALID_PASSWORD", "Invalid password"), PASSWORD_CURRENT_WRONG);
  assert.equal(passwordFailureMessage(undefined, PASSWORD_DIFFERENT), PASSWORD_DIFFERENT);
  assert.equal(passwordFailureMessage("WHATEVER", "leaked-password-value"), PASSWORD_UPDATE_FAILED);
  assert.equal(passwordFailureMessage(undefined, undefined), PASSWORD_UPDATE_FAILED);
});

test("admin password changes keep the allowlist, 8-hour session, and session revoke", () => {
  assert.equal(ADMIN_SESSION_SECONDS, 8 * 60 * 60);
  const files = [
    "src/app/admin/password/actions.ts",
    "src/app/admin/(panel)/password/page.tsx",
    "src/lib/admin-password.ts",
    "src/lib/auth.ts",
    "src/app/admin/(panel)/layout.tsx",
  ];
  const sources = Object.fromEntries(files.map((file) => [file, readFileSync(join(root, file), "utf8")]));
  assert.match(sources["src/app/admin/password/actions.ts"], /guardAdminMutation/);
  assert.match(sources["src/app/admin/password/actions.ts"], /auth\.api\.setPassword/);
  assert.match(sources["src/app/admin/password/actions.ts"], /auth\.api\.changePassword/);
  assert.match(sources["src/app/admin/password/actions.ts"], /revokeOtherSessions:\s*true/);
  assert.match(sources["src/app/admin/password/actions.ts"], /revokeOtherAdminSessions/);
  assert.match(sources["src/app/admin/(panel)/password/page.tsx"], /requireAdmin/);
  assert.match(sources["src/lib/admin-password.ts"], /isAdminEmail/);
  assert.match(sources["src/lib/admin-password.ts"], /sessionIsFresh/);
  assert.match(readFileSync(join(root, "src/lib/admin-password-policy.ts"), "utf8"), /api\.pwnedpasswords\.com\/range\//);
  assert.match(sources["src/lib/auth.ts"], /ctx\.path === "\/change-password"/);
  assert.match(sources["src/lib/auth.ts"], /revokeOtherSessions = true/);
  assert.match(sources["src/app/admin/(panel)/layout.tsx"], /PASSWORD_OPTIONAL_NOTICE/);
  assert.match(PASSWORD_OPTIONAL_NOTICE, /optional/i);

  const signIn = readFileSync(join(root, "src/app/admin/sign-in/actions.ts"), "utf8");
  assert.match(signIn, /auth\.api\.signInEmail/);

  for (const source of Object.values(sources)) {
    for (const line of source.split("\n")) {
      if (!line.includes("console.")) continue;
      assert.equal(line.includes("${"), false, line);
      assert.equal(line.includes("newPassword"), false, line);
      assert.equal(line.includes("currentPassword"), false, line);
      assert.equal(line.includes("formData"), false, line);
    }
  }
});
