import type { Metadata } from "next";
import SupportTiers from "@/components/SupportTiers";

export const metadata: Metadata = {
  title: "Support",
  description: "Support #Hero — Free, Support $7/mo, Inner Circle $25/mo.",
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="section-label mb-3">Partners</p>
      <h1 className="graffiti-heading mb-4">Support</h1>
      <p className="mb-4 max-w-2xl text-hero-light">
        Help keep uncompromised Christian hip-hop in the streets. Choose a tier that fits
        — or just stay locked in for free.
      </p>
      <p className="mb-10 rounded border border-hero-surface bg-hero-dark px-4 py-3 text-xs text-hero-muted">
        <strong className="text-white">Stripe TODO:</strong> Paid tiers are UI-ready.
        Checkout is stubbed until{" "}
        <code className="text-hero-light">STRIPE_SECRET_KEY</code> and price IDs are set
        in <code className="text-hero-light">.env</code>. See{" "}
        <code className="text-hero-light">.env.example</code> and comments in{" "}
        <code className="text-hero-light">SupportTiers.tsx</code>.
      </p>
      <SupportTiers />
    </div>
  );
}
