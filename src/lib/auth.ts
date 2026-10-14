import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

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

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "build-placeholder-secret-not-used-for-sessions",
  baseURL: process.env.BETTER_AUTH_URL,
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
  plugins: [nextCookies()],
});

export function getPool(): Pool | null {
  return pool;
}
