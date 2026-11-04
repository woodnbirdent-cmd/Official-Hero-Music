import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const CHECKIN_COOKIE = "hero_show_checkin";
export const CHECKIN_COOKIE_MAX_AGE = 60 * 60 * 18;

export function checkinConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.TICKET_CHECKIN_PASSWORD);
}

export function checkinPasswordMatches(input: string, expected: string): boolean {
  if (!expected || !input) return false;
  const actual = createHash("sha256").update(input).digest();
  const wanted = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actual, wanted);
}

export function checkinCookieValue(password: string): string {
  return createHmac("sha256", password).update("hero-show-checkin-v1").digest("base64url");
}

export function checkinCookieMatches(cookieValue: string | undefined, password: string): boolean {
  if (!cookieValue || !password) return false;
  const expected = checkinCookieValue(password);
  const actual = Buffer.from(cookieValue);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}
