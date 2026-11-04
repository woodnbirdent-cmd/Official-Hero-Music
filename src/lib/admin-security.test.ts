import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isAdminEmail } from "./admin-allowlist.ts";
import {
  ADMIN_MAGIC_LINK_SECONDS,
  ADMIN_REAUTH_SECONDS,
  ADMIN_SESSION_SECONDS,
  CANCEL_SUBSCRIPTION_PHRASE,
  DELETE_CUSTOMER_PHRASE,
  GENERIC_LINK_MESSAGE,
  GENERIC_SIGN_IN_ERROR,
  adminSecurityHeaders,
  adminSignInRateLimits,
  isAdminCallback,
  phraseMatches,
  sameOrigin,
  sessionIsFresh,
} from "./admin-security.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("allowlist is read from ADMIN_EMAILS on every call", () => {
  const previous = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "woodnbirdent@gmail.com, hero@officialheromusic.com";
  assert.equal(isAdminEmail("Woodnbirdent@gmail.com"), true);
  assert.equal(isAdminEmail("hero@officialheromusic.com"), true);
  assert.equal(isAdminEmail("bird@officialheromusic.com"), false);
  assert.equal(isAdminEmail("hero@officialheromusic.com.evil.test"), false);
  process.env.ADMIN_EMAILS = "other@example.com";
  assert.equal(isAdminEmail("hero@officialheromusic.com"), false);
  assert.equal(isAdminEmail("other@example.com"), true);
  if (previous === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = previous;
});

test("sign-in copy does not reveal whether an address is allowed", () => {
  assert.equal(GENERIC_SIGN_IN_ERROR.includes("admin"), false);
  assert.equal(GENERIC_SIGN_IN_ERROR.includes("allow"), false);
  assert.match(GENERIC_LINK_MESSAGE, /If that address can sign in/);
});

test("magic links are five minutes and sign-in routes are rate limited", () => {
  assert.equal(ADMIN_MAGIC_LINK_SECONDS, 300);
  assert.equal(ADMIN_SESSION_SECONDS, 8 * 60 * 60);
  assert.equal(ADMIN_REAUTH_SECONDS, 15 * 60);
  const limits = adminSignInRateLimits();
  assert.ok(limits["/sign-in/magic-link"].max <= 5);
  assert.ok(limits["/sign-in/email"].max <= 10);
  assert.ok(limits["/sign-up/email"].window >= 60);
});

test("session freshness and confirmation phrases", () => {
  const now = Date.parse("2026-07-15T18:00:00Z");
  assert.equal(sessionIsFresh(new Date(now - 14 * 60 * 1000), ADMIN_REAUTH_SECONDS, now), true);
  assert.equal(sessionIsFresh(new Date(now - 16 * 60 * 1000), ADMIN_REAUTH_SECONDS, now), false);
  assert.equal(sessionIsFresh("not-a-date", ADMIN_SESSION_SECONDS, now), false);
  assert.equal(phraseMatches(` ${CANCEL_SUBSCRIPTION_PHRASE} `, CANCEL_SUBSCRIPTION_PHRASE), true);
  assert.equal(phraseMatches(CANCEL_SUBSCRIPTION_PHRASE, CANCEL_SUBSCRIPTION_PHRASE), true);
  assert.equal(phraseMatches("delete stripe customer", DELETE_CUSTOMER_PHRASE), false);
});

test("callbacks and origins stay on this admin site", () => {
  assert.equal(isAdminCallback("/admin"), true);
  assert.equal(isAdminCallback("/admin/orders?type=merch"), true);
  assert.equal(isAdminCallback("/admin/sign-in?error=link"), false);
  assert.equal(isAdminCallback("https://evil.example/admin"), false);
  assert.equal(isAdminCallback("//evil.example/admin"), false);
  assert.equal(sameOrigin("https://officialheromusic.com", "officialheromusic.com"), true);
  assert.equal(sameOrigin("https://evil.example", "officialheromusic.com"), false);
  assert.equal(sameOrigin(null, "officialheromusic.com"), false);
});

test("admin responses set a nonce script policy", () => {
  const nonce = "Aa1+Bb2/Cc3=";
  const headers = new Map(adminSecurityHeaders(true, nonce));
  const csp = headers.get("Content-Security-Policy") || "";
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /default-src 'self'/);
  assert.ok(csp.includes(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`));
  assert.equal(csp.includes("'unsafe-inline' 'strict-dynamic'"), false);
  assert.equal(/script-src [^;]*'unsafe-inline'/.test(csp), false);
  assert.match(csp, /style-src 'self' 'unsafe-inline'/);
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.match(headers.get("Strict-Transport-Security") || "", /max-age=63072000/);
  assert.match(headers.get("Cache-Control") || "", /no-store/);
  assert.equal(new Map(adminSecurityHeaders(false, nonce)).has("Strict-Transport-Security"), false);
  assert.throws(() => adminSecurityHeaders(true, "bad nonce"));
});

test("admin routes and actions authorize on the server", () => {
  const files = [
    "src/app/admin/(panel)/layout.tsx",
    "src/app/admin/orders/export/route.ts",
    "src/app/admin/members/export/route.ts",
    "src/app/admin/orders/actions.ts",
    "src/app/admin/members/actions.ts",
    "src/lib/admin-data.ts",
    "src/lib/admin-mutations.ts",
    "src/lib/admin-store.ts",
  ];
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    assert.match(source, /requireAdmin|guardAdminMutation/, file);
  }
  const signIn = readFileSync(join(root, "src/app/admin/sign-in/actions.ts"), "utf8");
  assert.match(signIn, /assertSameOrigin/);
  assert.equal(signIn.includes("You do not have access"), false);
  const auth = readFileSync(join(root, "src/lib/auth.ts"), "utf8");
  assert.match(auth, /storeToken: "hashed"/);
  assert.match(auth, /httpOnly: true/);
  assert.match(auth, /sameSite: "lax"/);
  assert.match(auth, /allowPasswordless: true/);
  assert.match(auth, /storeBackupCodes: "encrypted"/);
  const publicSignIn = readFileSync(join(root, "src/components/auth/CredentialsForm.tsx"), "utf8");
  assert.equal(publicSignIn.includes("twoFactor"), false);
  assert.equal(publicSignIn.includes("two-factor"), false);
});
