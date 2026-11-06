"use client";

import { useState, type FormEvent } from "react";
import {
  BUSINESS_SPONSOR_TIERS,
  COMMUNITY_SPONSOR,
  formatDollars,
} from "@/lib/show-config";

function publicDollars(cents: number): string {
  const dollars = cents / 100;
  if (!Number.isInteger(dollars)) return formatDollars(cents);
  return `$${dollars.toLocaleString("en-US")}`;
}

async function sendSponsorship(form: FormData): Promise<string> {
  const response = await fetch("/api/show/sponsorship", { method: "POST", body: form });
  const data: unknown = await response.json();
  const url = data && typeof data === "object" && "url" in data && typeof data.url === "string" ? data.url : "";
  const next = data && typeof data === "object" && "next" in data && typeof data.next === "string" ? data.next : "";
  const message =
    data && typeof data === "object" && "error" in data && typeof data.error === "string"
      ? data.error
      : "Could not submit that sponsorship.";
  if (!response.ok) throw new Error(message);
  if (url.startsWith("https://")) {
    window.location.assign(url);
    return "";
  }
  if (next.startsWith("/")) {
    window.location.assign(next);
    return "";
  }
  throw new Error(message);
}

export default function SponsorshipForms() {
  const [amount, setAmount] = useState("25");
  const [tierId, setTierId] = useState<(typeof BUSINESS_SPONSOR_TIERS)[number]["id"]>(BUSINESS_SPONSOR_TIERS[0].id);
  const [emailLogo, setEmailLogo] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function onCommunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending("community");
    const form = new FormData(event.currentTarget);
    form.set("tierId", COMMUNITY_SPONSOR.id);
    form.set("payment", "card");
    form.set("amount", amount);
    try {
      await sendSponsorship(form);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start checkout.");
      setPending("");
    }
  }

  async function onBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
    const payment = submitter instanceof HTMLButtonElement && submitter.value === "invoice" ? "invoice" : "card";
    setError("");
    setPending(payment);
    const form = new FormData(event.currentTarget);
    form.set("tierId", tierId);
    form.set("payment", payment);
    form.set("logoDelivery", emailLogo ? "email" : "upload");
    try {
      await sendSponsorship(form);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit that sponsorship.");
      setPending("");
    }
  }

  return (
    <div className="space-y-10">
      {error && (
        <p className="text-sm text-hero-accent" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={onCommunity} className="card-surface space-y-4">
        <p className="section-label">Individuals</p>
        <h3 className="text-2xl font-black uppercase text-hero-accent">{COMMUNITY_SPONSOR.name}</h3>
        <p className="text-sm text-hero-light">{COMMUNITY_SPONSOR.summary}</p>
        <div className="flex flex-wrap gap-2">
          {COMMUNITY_SPONSOR.presetsCents.map((cents) => (
            <button
              key={cents}
              type="button"
              className={`border px-4 py-2 text-sm font-bold ${
                amount === String(cents / 100) ? "border-white bg-white text-black" : "border-hero-gray text-white"
              }`}
              onClick={() => setAmount(String(cents / 100))}
            >
              {publicDollars(cents)}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          <span className="section-label mb-2 block">Amount</span>
          <input
            className="input-field"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-describedby="community-amount-help"
          />
        </label>
        <p id="community-amount-help" className="text-xs text-hero-muted">
          {publicDollars(COMMUNITY_SPONSOR.minCents)} to {publicDollars(COMMUNITY_SPONSOR.maxCents)}.
        </p>
        <label className="block text-sm">
          <span className="section-label mb-2 block">Name</span>
          <input className="input-field" name="name" autoComplete="name" required />
        </label>
        <label className="block text-sm">
          <span className="section-label mb-2 block">Email</span>
          <input className="input-field" type="email" name="email" autoComplete="email" required />
        </label>
        <button type="submit" className="btn-primary" disabled={pending !== ""}>
          {pending === "community" ? "…" : "Continue to checkout"}
        </button>
      </form>

      <form onSubmit={onBusiness} className="card-surface space-y-4">
        <p className="section-label">Businesses</p>
        <h3 className="text-2xl font-black uppercase text-hero-accent">Business sponsorship</h3>
        <p className="text-sm text-hero-light">Suggested tiers. Names and amounts can change.</p>
        <fieldset className="space-y-3">
          <legend className="section-label mb-3">Tier</legend>
          {BUSINESS_SPONSOR_TIERS.map((tier) => (
            <label key={tier.id} className="flex items-center justify-between gap-3 border border-hero-gray px-4 py-3">
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="business-tier"
                  value={tier.id}
                  checked={tierId === tier.id}
                  onChange={() => setTierId(tier.id)}
                />
                <span className="font-bold uppercase tracking-wide">{tier.name}</span>
              </span>
              <span>{publicDollars(tier.priceCents)}</span>
            </label>
          ))}
        </fieldset>
        <label className="block text-sm">
          <span className="section-label mb-2 block">Business name</span>
          <input className="input-field" name="businessName" autoComplete="organization" required />
        </label>
        <label className="block text-sm">
          <span className="section-label mb-2 block">Contact name</span>
          <input className="input-field" name="name" autoComplete="name" required />
        </label>
        <label className="block text-sm">
          <span className="section-label mb-2 block">Email</span>
          <input className="input-field" type="email" name="email" autoComplete="email" required />
        </label>
        <label className="block text-sm">
          <span className="section-label mb-2 block">Phone</span>
          <input className="input-field" type="tel" name="phone" autoComplete="tel" required />
        </label>
        <label className="block text-sm">
          <span className="section-label mb-2 block">Logo</span>
          <input
            className="input-field"
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp"
            disabled={emailLogo}
            required={!emailLogo}
          />
        </label>
        <label className="flex items-center gap-3 text-sm text-hero-light">
          <input type="checkbox" checked={emailLogo} onChange={(event) => setEmailLogo(event.target.checked)} />
          I&apos;ll email the logo instead
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" name="payment" value="card" className="btn-primary" disabled={pending !== ""}>
            {pending === "card" ? "…" : "Pay with card"}
          </button>
          <button type="submit" name="payment" value="invoice" className="btn-ghost" disabled={pending !== ""}>
            {pending === "invoice" ? "…" : "Invoice me / pay by check"}
          </button>
        </div>
      </form>
    </div>
  );
}
