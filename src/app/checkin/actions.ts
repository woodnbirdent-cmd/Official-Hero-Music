"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseTicketCode } from "@/lib/show-codes";
import {
  CHECKIN_COOKIE,
  CHECKIN_COOKIE_MAX_AGE,
  checkinCookieMatches,
  checkinCookieValue,
  checkinPasswordMatches,
} from "@/lib/show-checkin";
import { redeemTicket } from "@/lib/show-store";
import type { RedeemResult } from "@/lib/show-types";

const failures = new Map<string, { count: number; reset: number }>();

async function clientIp(): Promise<string> {
  const headerList = await headers();
  return (headerList.get("x-forwarded-for") || "").split(",")[0]?.trim() || "local";
}

function limited(ip: string): boolean {
  const row = failures.get(ip);
  if (!row || row.reset < Date.now()) return false;
  return row.count >= 8;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const row = failures.get(ip);
  if (!row || row.reset < now) {
    failures.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
    return;
  }
  row.count += 1;
}

export async function unlockCheckin(formData: FormData): Promise<void> {
  const password = String(formData.get("password") || "");
  const code = parseTicketCode(String(formData.get("code") || "")) || "";
  const expected = process.env.TICKET_CHECKIN_PASSWORD || "";
  const fail = (reason: "config" | "password" | "limited"): never => {
    const params = new URLSearchParams();
    if (code) params.set("code", code);
    params.set("error", reason);
    redirect(`/checkin?${params.toString()}`);
  };
  if (!expected) fail("config");
  const ip = await clientIp();
  if (limited(ip)) fail("limited");
  if (!checkinPasswordMatches(password, expected)) {
    recordFailure(ip);
    fail("password");
  }
  const jar = await cookies();
  jar.set(CHECKIN_COOKIE, checkinCookieValue(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/checkin",
    maxAge: CHECKIN_COOKIE_MAX_AGE,
  });
  redirect(code ? `/checkin?code=${encodeURIComponent(code)}` : "/checkin");
}

export async function redeemCheckin(rawCode: string): Promise<RedeemResult> {
  const expected = process.env.TICKET_CHECKIN_PASSWORD || "";
  const jar = await cookies();
  if (!expected || !checkinCookieMatches(jar.get(CHECKIN_COOKIE)?.value, expected)) {
    return { status: "locked" };
  }
  return redeemTicket(rawCode);
}
