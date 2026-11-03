import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { Pool } from "pg";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { sendAdminMagicLinkEmail } from "@/lib/admin-email";

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
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const email = typeof ctx.body?.email === "string" ? ctx.body.email : "";
      if (ctx.path === "/sign-in/magic-link" && !isAdminEmail(email)) {
        throw new APIError("FORBIDDEN", { message: "You do not have access to the admin area." });
      }
      if (ctx.path === "/sign-up/email" && isAdminEmail(email)) {
        throw new APIError("BAD_REQUEST", {
          message: "This email uses the private admin sign-in.",
        });
      }
    }),
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 5,
      disableSignUp: false,
      sendMagicLink: async ({ email, url }) => {
        if (!isAdminEmail(email)) {
          throw new APIError("FORBIDDEN", { message: "You do not have access to the admin area." });
        }
        try {
          await sendAdminMagicLinkEmail(email, url);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not send the sign-in email.";
          throw new APIError("SERVICE_UNAVAILABLE", { message });
        }
      },
    }),
    nextCookies(),
  ],
});

export function getPool(): Pool | null {
  return pool;
}
