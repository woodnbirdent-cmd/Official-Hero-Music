import { createHash } from "node:crypto";

export const ADMIN_PASSWORD_MIN_LENGTH = 12;

export const ADMIN_PASSWORD_MAX_LENGTH = 128;

/** Shared by the admin password action and the public change-password route. */
export const ADMIN_PASSWORD_RATE_WINDOW_SECONDS = 10 * 60;

export const ADMIN_PASSWORD_RATE_MAX = 5;

export const PASSWORD_TOO_SHORT = "Use at least 12 characters.";

export const PASSWORD_TOO_LONG = "Use at most 128 characters.";

export const PASSWORD_COMMON =
  "That password is too common or has appeared in a breach. Choose another.";

export const PASSWORD_EMAIL = "Choose a password that is not your email address.";

export const PASSWORD_DIFFERENT = "Choose a different password than the current one.";

export const PASSWORD_MISMATCH = "Those passwords do not match.";

export const PASSWORD_CURRENT_REQUIRED = "Enter your current password.";

export const PASSWORD_CURRENT_WRONG = "Current password is wrong.";

export const PASSWORD_ALREADY_SET =
  "This account already has a password. Enter the current one to change it.";

export const PASSWORD_NOT_SET = "Set a password before trying to change it.";

export const PASSWORD_RATE_LIMITED = "Too many attempts. Try again later.";

export const PASSWORD_STALE = "Sign in again to continue.";

export const PASSWORD_DENIED = "Could not confirm this request.";

export const PASSWORD_SAVED = "Password saved. Other sessions were signed out.";

export const PASSWORD_SAVED_REVOKE_FAILED =
  "The password was saved, but other sessions could not be signed out. Sign out of this browser and sign in again.";

export const PASSWORD_UPDATE_FAILED = "Could not update the password.";

export const PASSWORD_OPTIONAL_NOTICE = "A password is optional. Email sign-in links still work.";

const ALLOWED_MESSAGES = new Set([
  PASSWORD_TOO_SHORT,
  PASSWORD_TOO_LONG,
  PASSWORD_COMMON,
  PASSWORD_EMAIL,
  PASSWORD_DIFFERENT,
  PASSWORD_MISMATCH,
  PASSWORD_CURRENT_REQUIRED,
  PASSWORD_CURRENT_WRONG,
  PASSWORD_ALREADY_SET,
  PASSWORD_NOT_SET,
  PASSWORD_RATE_LIMITED,
  PASSWORD_STALE,
  PASSWORD_DENIED,
  PASSWORD_SAVED_REVOKE_FAILED,
  PASSWORD_UPDATE_FAILED,
]);

const COMMON_PASSWORDS = new Set(
  [
    "password",
    "password1",
    "password12",
    "password123",
    "password1234",
    "password12345",
    "password123456",
    "passw0rd",
    "passw0rd123",
    "passw0rd1234",
    "123456789012",
    "1234567890123",
    "123456789abc",
    "qwertyuiop",
    "qwertyuiopas",
    "qwertyuiopasd",
    "qwerty123456",
    "qwertyqwerty",
    "1q2w3e4r5t6y",
    "1qaz2wsx3edc",
    "zaq12wsxcde3",
    "abcdefghijkl",
    "abc123456789",
    "abcd12345678",
    "iloveyou",
    "iloveyou1234",
    "letmein",
    "letmein12345",
    "welcome",
    "welcome12345",
    "changeme",
    "changeme1234",
    "admin1234567",
    "administrator",
    "trustno1",
    "sunshine1234",
    "princess1234",
    "football1234",
    "baseball1234",
    "superman1234",
    "batman123456",
    "starwars1234",
    "whatever1234",
    "monkey123456",
    "dragon123456",
    "master123456",
    "shadow123456",
    "access123456",
    "login1234567",
    "hello1234567",
    "freedom12345",
    "secretsecret",
    "passpasspass",
    "correcthorsebatterystaple",
  ].map((entry) => entry.toLowerCase()),
);

export function adminPasswordIssue(password: string, email: string): string | null {
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) return PASSWORD_TOO_SHORT;
  if (password.length > ADMIN_PASSWORD_MAX_LENGTH) return PASSWORD_TOO_LONG;
  if (password.trim().length === 0 || isRepeatedCharacter(password)) return PASSWORD_COMMON;
  if (matchesOwnEmail(password, email)) return PASSWORD_EMAIL;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return PASSWORD_COMMON;
  return null;
}

function matchesOwnEmail(password: string, email: string): boolean {
  const candidate = password.toLowerCase();
  const mail = email.trim().toLowerCase();
  if (!mail) return false;
  if (candidate === mail) return true;
  const local = mail.split("@")[0] ?? "";
  return local.length >= 4 && candidate === local;
}

function isRepeatedCharacter(password: string): boolean {
  return /^(.)\1+$/u.test(password);
}

/** Have I Been Pwned range line `SUFFIX:count`. Null means the body was unusable. */
export function hibpSuffixCount(body: string, suffix: string): number | null {
  const label = `${suffix.toUpperCase()}:`;
  for (const line of body.split(/\r?\n/)) {
    if (line.slice(0, label.length).toUpperCase() !== label) continue;
    const countText = line.slice(label.length).trim();
    if (!/^\d+$/.test(countText)) return null;
    const count = Number(countText);
    if (!Number.isSafeInteger(count)) return null;
    return count;
  }
  return 0;
}

export type PasswordRateSnapshot = { count: number; lastRequest: number };

export type PasswordRateDecision = {
  allowed: boolean;
  count: number;
  lastRequest: number;
  retryAfterSeconds: number;
};

/** Fixed window: `lastRequest` is the start of the window, not the latest hit. */
export function nextPasswordRate(
  current: PasswordRateSnapshot | null,
  now: number,
  windowMs: number,
  max: number,
): PasswordRateDecision {
  if (!current || !Number.isFinite(current.count) || !Number.isFinite(current.lastRequest) || now - current.lastRequest >= windowMs) {
    return { allowed: true, count: 1, lastRequest: now, retryAfterSeconds: 0 };
  }
  if (current.count >= max) {
    return {
      allowed: false,
      count: current.count,
      lastRequest: current.lastRequest,
      retryAfterSeconds: Math.max(1, Math.ceil((current.lastRequest + windowMs - now) / 1000)),
    };
  }
  return {
    allowed: true,
    count: current.count + 1,
    lastRequest: current.lastRequest,
    retryAfterSeconds: 0,
  };
}

/** k-anonymity range query. Only a hash prefix is sent. A failed lookup is not treated as a breach. */
export async function passwordBreachStatus(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<"breached" | "clear" | "unavailable"> {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const response = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        "Add-Padding": "true",
        "User-Agent": "OfficialHeroMusic-AdminPasswordCheck",
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return "unavailable";
    const count = hibpSuffixCount(await response.text(), suffix);
    if (count === null) return "unavailable";
    return count > 0 ? "breached" : "clear";
  } catch {
    return "unavailable";
  }
}

/** Map an auth error to a fixed sentence. Unknown text is dropped so a password cannot echo. */
export function passwordFailureMessage(code: string | undefined, message: string | undefined): string {
  if (code === "INVALID_PASSWORD") return PASSWORD_CURRENT_WRONG;
  if (code === "PASSWORD_ALREADY_SET" || code === "USER_ALREADY_HAS_PASSWORD") return PASSWORD_ALREADY_SET;
  if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") return PASSWORD_NOT_SET;
  if (code === "PASSWORD_TOO_SHORT") return PASSWORD_TOO_SHORT;
  if (code === "PASSWORD_TOO_LONG") return PASSWORD_TOO_LONG;
  if (message && ALLOWED_MESSAGES.has(message)) return message;
  return PASSWORD_UPDATE_FAILED;
}
