import Link from "next/link";
import { SUPPORT_TIERS } from "@/lib/constants";

export default function SupportTiers() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {SUPPORT_TIERS.map((tier) => (
        <article
          key={tier.id}
          className={`card-surface flex flex-col ${
            tier.highlighted ? "border-white ring-1 ring-white" : ""
          }`}
        >
          <p className="section-label mb-2">{tier.name}</p>
          <p className="mb-2 text-4xl font-black text-white">
            {tier.price}
            <span className="text-base font-normal text-hero-muted">{tier.period}</span>
          </p>
          <p className="mb-6 text-sm text-hero-light">{tier.description}</p>
          <ul className="mb-8 flex-1 space-y-2 text-sm text-hero-light">
            {tier.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span aria-hidden className="text-white">
                  ■
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {tier.id === "free" ? (
            <Link href={tier.href} className="btn-ghost w-full text-center">
              {tier.cta}
            </Link>
          ) : (
            <div className="space-y-3">
              {/*
                TODO(Stripe): Wire Checkout Session
                1. Create Products/Prices in Stripe Dashboard ($7 Support, $25 Inner Circle)
                2. Set STRIPE_SECRET_KEY + NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY + price IDs in .env
                3. Add POST /api/stripe/checkout that creates a Checkout Session for this tier
                4. Replace this button with a form that POSTs to that route
                Env key for this tier: ${tier.stripePriceEnv}
              */}
              <button
                type="button"
                className={tier.highlighted ? "btn-primary w-full" : "btn-ghost w-full"}
                disabled
                title="Stripe checkout coming soon"
              >
                {tier.cta}
              </button>
              <p className="text-center text-[10px] uppercase tracking-wider text-hero-muted">
                TODO: Stripe checkout — not live yet
              </p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
