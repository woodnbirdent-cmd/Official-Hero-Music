import type { Metadata } from "next";
import { cookies } from "next/headers";
import CheckinDesk from "@/components/show/CheckinDesk";
import { parseTicketCode } from "@/lib/show-codes";
import { CHECKIN_COOKIE, checkinConfigured, checkinCookieMatches } from "@/lib/show-checkin";
import { unlockCheckin } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Check-in",
  robots: { index: false, follow: false },
};

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const params = await searchParams;
  const code = parseTicketCode(params.code || "") || "";
  if (!checkinConfigured()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="graffiti-heading">Check-in</h1>
        <p className="mt-4 text-hero-light">Check-in is not configured.</p>
      </div>
    );
  }
  const jar = await cookies();
  const unlocked = checkinCookieMatches(jar.get(CHECKIN_COOKIE)?.value, process.env.TICKET_CHECKIN_PASSWORD || "");
  if (!unlocked) {
    const error =
      params.error === "limited"
        ? "Too many attempts. Try again later."
        : params.error === "password"
          ? "Wrong password."
          : params.error === "config"
            ? "Check-in is not configured."
            : "";
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <p className="section-label mb-3">Door</p>
        <h1 className="graffiti-heading mb-6">Check-in</h1>
        <form action={unlockCheckin} className="space-y-4">
          {code ? <input type="hidden" name="code" value={code} /> : null}
          {error && (
            <p className="text-sm text-hero-accent" role="alert">
              {error}
            </p>
          )}
          <label className="block text-sm">
            <span className="section-label mb-2 block">Password</span>
            <input className="input-field py-4 text-lg" type="password" name="password" autoComplete="current-password" required />
          </label>
          <button type="submit" className="btn-primary w-full">
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <p className="section-label mb-3">Door</p>
      <h1 className="mb-6 font-display text-5xl uppercase text-hero-accent">Check-in</h1>
      <CheckinDesk initialCode={code} />
    </div>
  );
}
