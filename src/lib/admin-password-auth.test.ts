import assert from "node:assert/strict";
import test from "node:test";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins/magic-link";

const SECRET = "integration-secret-integration-secret";
const ORIGIN = "http://localhost:3000";
const EMAIL = "hero@officialheromusic.com";
const FIRST_PASSWORD = "rK7$mQ2vL9pX";
const NEXT_PASSWORD = "nT4!wQ8cV2mL";

function requestHeaders(cookie?: string): Headers {
  const headers = new Headers({ origin: ORIGIN, host: "localhost:3000" });
  if (cookie) headers.set("cookie", cookie);
  return headers;
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie") || "";
  const pair = setCookie.split(";")[0] || "";
  assert.ok(pair.includes("="), "session cookie missing");
  return pair;
}

test("a magic-link account can set a password and then sign in with it", async () => {
  let link = "";
  const auth = betterAuth({
    secret: SECRET,
    baseURL: ORIGIN,
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
    rateLimit: { enabled: false },
    plugins: [
      magicLink({
        expiresIn: 300,
        storeToken: "hashed",
        sendMagicLink: async ({ url }) => {
          link = url;
        },
      }),
    ],
  });

  await auth.api.signInMagicLink({
    body: { email: EMAIL, callbackURL: "/admin" },
    headers: requestHeaders(),
  });
  assert.ok(link.startsWith(ORIGIN));
  const verified = await auth.handler(new Request(link, { headers: requestHeaders() }));
  const cookie = cookieFrom(verified);
  const sessionHeaders = requestHeaders(cookie);
  const session = await auth.api.getSession({ headers: sessionHeaders });
  assert.equal(session?.user.email, EMAIL);

  await auth.api.setPassword({ body: { newPassword: FIRST_PASSWORD }, headers: sessionHeaders });
  await assert.rejects(
    auth.api.setPassword({ body: { newPassword: NEXT_PASSWORD }, headers: sessionHeaders }),
    (error: unknown) => {
      const code =
        error && typeof error === "object" && "body" in error && error.body && typeof error.body === "object"
          ? (error.body as { code?: string }).code
          : "";
      return code === "PASSWORD_ALREADY_SET";
    },
  );

  await auth.api.signOut({ headers: sessionHeaders });
  const signedOut = await auth.api.getSession({ headers: sessionHeaders });
  assert.equal(signedOut, null);

  const signedIn = await auth.api.signInEmail({
    body: { email: EMAIL, password: FIRST_PASSWORD },
    headers: requestHeaders(),
    returnHeaders: true,
  });
  assert.equal(signedIn.response?.user.email, EMAIL);
  const passwordCookie = cookieFrom(new Response(null, { headers: signedIn.headers }));
  const currentHeaders = requestHeaders(passwordCookie);

  const other = await auth.api.signInEmail({
    body: { email: EMAIL, password: FIRST_PASSWORD },
    headers: requestHeaders(),
    returnHeaders: true,
  });
  const otherCookie = cookieFrom(new Response(null, { headers: other.headers }));
  const otherHeaders = requestHeaders(otherCookie);
  assert.equal((await auth.api.getSession({ headers: otherHeaders }))?.user.email, EMAIL);

  await assert.rejects(auth.api.changePassword({
    body: { currentPassword: "not-the-password", newPassword: NEXT_PASSWORD, revokeOtherSessions: true },
    headers: currentHeaders,
  }));

  await auth.api.changePassword({
    body: { currentPassword: FIRST_PASSWORD, newPassword: NEXT_PASSWORD, revokeOtherSessions: true },
    headers: currentHeaders,
    returnHeaders: true,
  });

  const otherAfter = await auth.api.getSession({ headers: otherHeaders });
  assert.equal(otherAfter, null);

  const resigned = await auth.api.signInEmail({
    body: { email: EMAIL, password: NEXT_PASSWORD },
    headers: requestHeaders(),
  });
  assert.equal(resigned.user.email, EMAIL);
  await assert.rejects(
    auth.api.signInEmail({
      body: { email: EMAIL, password: FIRST_PASSWORD },
      headers: requestHeaders(),
    }),
  );
});
