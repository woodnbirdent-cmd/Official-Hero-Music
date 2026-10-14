"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TIER_DETAILS, tierAtLeast, type Tier } from "@/lib/tiers";

type MemberSnapshot = {
  email: string;
  name: string;
  tier: Tier;
};

const ORDER: Tier[] = ["free", "supporter", "vip"];

export default function MembershipTiers() {
  const [ready, setReady] = useState(false);
  const [member, setMember] = useState<MemberSnapshot | null>(null);
  const [pending, setPending] = useState<Tier | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/membership/me")
      .then((response) => response.json())
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== "object" || !("member" in data)) return;
        const snapshot = data.member;
        if (
          snapshot &&
          typeof snapshot === "object" &&
          "tier" in snapshot &&
          (snapshot.tier === "free" || snapshot.tier === "supporter" || snapshot.tier === "vip") &&
          "email" in snapshot &&
          typeof snapshot.email === "string" &&
          "name" in snapshot &&
          typeof snapshot.name === "string"
        ) {
          setMember({ email: snapshot.email, name: snapshot.name, tier: snapshot.tier });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function subscribe(tier: "supporter" | "vip") {
    setError("");
    setPending(tier);
    try {
      const response = await fetch("/api/membership/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data: unknown = await response.json();
      const url =
        data && typeof data === "object" && "url" in data && typeof data.url === "string" ? data.url : "";
      const message =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Could not start checkout.";
      if (!response.ok || !url) {
        setError(message);
        return;
      }
      window.location.assign(url);
    } catch {
      setError("Could not start checkout.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-hero-accent" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-3">
        {ORDER.map((tier) => {
          const details = TIER_DETAILS[tier];
          const current = member ? tierAtLeast(member.tier, tier) && member.tier === tier : false;
          const included = member ? tierAtLeast(member.tier, tier) && member.tier !== tier : false;
          return (
            <article
              key={tier}
              className={`card-surface flex flex-col ${tier === "supporter" ? "border-white ring-1 ring-white" : ""}`}
            >
              <p className="section-label mb-2">{details.name}</p>
              <p className="mb-2 text-4xl font-black text-white">
                {details.priceLabel}
                <span className="text-base font-normal text-hero-muted">{details.period}</span>
              </p>
              <p className="mb-6 text-sm text-hero-light">{details.description}</p>
              <ul className="mb-8 flex-1 space-y-2 text-sm text-hero-light">
                {details.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span aria-hidden className="text-white">
                      ■
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {tier === "free" ? (
                member ? (
                  <Link href="/members" className="btn-ghost w-full text-center">
                    Member updates
                  </Link>
                ) : (
                  <Link href="/sign-up" className="btn-ghost w-full text-center">
                    Create free account
                  </Link>
                )
              ) : current ? (
                <Link href="/account" className="btn-primary w-full text-center">
                  Current plan
                </Link>
              ) : included ? (
                <p className="text-center text-xs font-bold uppercase tracking-wider text-hero-muted">
                  Included in your plan
                </p>
              ) : member ? (
                <button
                  type="button"
                  className={tier === "supporter" ? "btn-primary w-full" : "btn-accent w-full"}
                  disabled={!ready || pending !== null}
                  onClick={() => void subscribe(tier)}
                >
                  {pending === tier ? "Starting checkout…" : `Join ${details.name}`}
                </button>
              ) : (
                <Link
                  href={`/sign-up?tier=${tier}`}
                  className={`${tier === "supporter" ? "btn-primary" : "btn-accent"} w-full text-center`}
                >
                  Join {details.name}
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
