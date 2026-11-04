import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { twoFactor } from "better-auth/plugins/two-factor";
import { Pool } from "pg";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { sendAdminMagicLinkEmail } from "@/lib/admin-email";
import {
  ADMIN_MAGIC_LINK_SECONDS,
  adminSignInRateLimits,
  isAdminCallback,
  sessionEmailFromAuthContext,
} from "@/lib/admin-security";

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 10_000,
    })
  : null;

export function accountsConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
}

const productionUrl = process.env.BETTER_AUTH_URL;

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "build-placeholder-secret-not-used-for-sessions",
  // Production keeps the fixed URL. Preview and localhost follow the request host
  // so admin magic links return to the deployment that sent them.
  baseURL: productionUrl
    ? productionUrl
    : {
        allowedHosts: [
          "officialheromusic.com",
          "www.officialheromusic.com",
          "*.vercel.app",
          "localhost:3000",
          "127.0.0.1:3000",
        ],
        fallback: "http://localhost:3000",
        protocol: "auto",
      },
  advanced: {
    trustedProxyHeaders: true,
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
  ...(pool ? { database: pool } : {}),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      tier: {
        type: "string",
        required: true,
        defaultValue: "free",
        input: false,
      },
      stripeCustomerId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 30,
    customRules: adminSignInRateLimits(),
  },
  trustedOrigins: [
    "https://officialheromusic.com",
    "https://www.officialheromusic.com",
    "http://localhost:3000",
    "https://*.vercel.app",
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (user.tier) return;
          return { data: { tier: "free" } };
        },
      },
      update: {
        before: async (user, context) => {
          if (typeof user.email === "string" && isAdminEmail(user.email)) return false;
          if (user.twoFactorEnabled === true && !isAdminEmail(sessionEmailFromAuthContext(context))) return false;
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const email = typeof ctx.body?.email === "string" ? ctx.body.email : "";
      if (ctx.path === "/sign-up/email" && isAdminEmail(email)) {
        throw new APIError("BAD_REQUEST", { message: "User already exists." });
      }
      if (ctx.path === "/magic-link/verify") {
        const callback = typeof ctx.query?.callbackURL === "string" ? ctx.query.callbackURL : "";
        if (!isAdminCallback(callback)) {
          throw new APIError("BAD_REQUEST", { message: "Invalid sign-in link." });
        }
      }
      if (ctx.path === "/sign-in/magic-link" && ctx.body && typeof ctx.body === "object") {
        ctx.body.callbackURL = "/admin";
        ctx.body.errorCallbackURL = "/admin/sign-in?error=link";
        ctx.body.newUserCallbackURL = "/admin";
      }
    }),
  },
  plugins: [
    twoFactor({
      issuer: "Official Hero Music",
      allowPasswordless: true,
      backupCodeOptions: { storeBackupCodes: "encrypted" },
      totpOptions: { digits: 6, period: 30 },
    }),
    magicLink({
      expiresIn: ADMIN_MAGIC_LINK_SECONDS,
      disableSignUp: false,
      storeToken: "hashed",
      rateLimit: adminSignInRateLimits()["/sign-in/magic-link"],
      sendMagicLink: async ({ email, url }) => {
        if (!isAdminEmail(email)) return;
        try {
          await sendAdminMagicLinkEmail(email, url);
        } catch {
          console.error("Admin sign-in email failed");
        }
      },
    }),
    nextCookies(),
  ],
});

export function getPool(): Pool | null {
  return pool;
}
