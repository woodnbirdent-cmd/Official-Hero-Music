/** Magic links expire after 5 minutes and are stored hashed. */
export const ADMIN_MAGIC_LINK_SECONDS = 5 * 60;

/** Admin pages require a session created within this window. */
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

/** Stripe and account deletion require a session created within this window. */
export const ADMIN_REAUTH_SECONDS = 15 * 60;

export const GENERIC_SIGN_IN_ERROR = "Could not sign in.";

export const GENERIC_LINK_MESSAGE =
  "If that address can sign in, a link is on its way. It expires in 5 minutes.";

export const CANCEL_SUBSCRIPTION_PHRASE = "CANCEL SUBSCRIPTION";

export const DELETE_CUSTOMER_PHRASE = "DELETE STRIPE CUSTOMER";

const SIGN_IN_LIMITS = {
  "/sign-in/magic-link": { window: 10 * 60, max: 5 },
  "/magic-link/verify": { window: 10 * 60, max: 10 },
  "/sign-in/email": { window: 10 * 60, max: 10 },
  "/sign-up/email": { window: 10 * 60, max: 10 },
  "/change-password": { window: 10 * 60, max: 5 },
} as const;

export function adminSignInRateLimits(): typeof SIGN_IN_LIMITS {
  return SIGN_IN_LIMITS;
}

export function sessionAgeSeconds(createdAt: Date | string | number, now = Date.now()): number | null {
  const created = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return null;
  return (now - created) / 1000;
}

export function sessionIsFresh(createdAt: Date | string | number, maxAgeSeconds: number, now = Date.now()): boolean {
  const age = sessionAgeSeconds(createdAt, now);
  return age !== null && age >= 0 && age <= maxAgeSeconds;
}

export function phraseMatches(value: string | null | undefined, phrase: string): boolean {
  return (value || "").trim() === phrase;
}

export function sameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const requestHost = host.split(",")[0]?.trim().toLowerCase() || "";
  return originHost.toLowerCase() === requestHost;
}

/** Magic-link return path. Only this site's admin pages. */
export function isAdminCallback(value: string | null | undefined): boolean {
  if (!value) return false;
  let decoded = value.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return false;
  }
  if (!decoded.startsWith("/admin") || decoded.startsWith("//") || decoded.includes("\\") || decoded.includes("://")) {
    return false;
  }
  if (decoded.includes("..")) return false;
  const path = decoded.split("?")[0] || "";
  if (path === "/admin/sign-in" || path.startsWith("/admin/sign-in/")) return false;
  return path === "/admin" || path.startsWith("/admin/");
}

export function adminSecurityHeaders(https: boolean): [string, string][] {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // uploadPresigned PUTs the MP3 to getApiUrl() (https://vercel.com/api/blob/?pathname=…).
    "connect-src 'self' https://vercel.com/api/blob/",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const headers: [string, string][] = [
    ["Content-Security-Policy", csp],
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "no-referrer"],
    ["X-Frame-Options", "DENY"],
    ["X-Robots-Tag", "noindex, nofollow"],
    ["Cache-Control", "private, no-store"],
    ["Pragma", "no-cache"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"],
  ];
  if (https) {
    headers.push(["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"]);
  }
  return headers;
}
