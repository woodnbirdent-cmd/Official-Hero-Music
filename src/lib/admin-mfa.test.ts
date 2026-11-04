import assert from "node:assert/strict";
import test from "node:test";
import { openAdminMfa, sealAdminMfa } from "./admin-mfa.ts";
import { sessionEmailFromAuthContext } from "./admin-security.ts";

test("authenticator completion cookie is bound to one session", async () => {
  const secret = "test-secret-test-secret-test-secret";
  const token = await sealAdminMfa("session-a", secret, 1_000);
  assert.equal(await openAdminMfa(token, secret, 1_000), "session-a");
  assert.equal(await openAdminMfa(token, "other-secret-other-secret-other", 1_000), null);
  assert.equal(await openAdminMfa(`${token}x`, secret, 1_000), null);
  const expired = await sealAdminMfa("session-a", secret, 1_000 - 9 * 60 * 60 * 1000);
  assert.equal(await openAdminMfa(expired, secret, 1_000), null);
});

test("only an admin session may turn two-factor on", () => {
  const context = { context: { session: { user: { email: "hero@officialheromusic.com" } } } };
  assert.equal(sessionEmailFromAuthContext(context), "hero@officialheromusic.com");
  assert.equal(sessionEmailFromAuthContext({ context: { session: null } }), undefined);
  assert.equal(sessionEmailFromAuthContext(null), undefined);
});
