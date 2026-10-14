import type { Metadata } from "next";
import SupportTiers from "@/components/SupportTiers";

export const metadata: Metadata = {
  title: "Support",
  description: "Support #Hero — Free, Supporter $7/mo, or VIP $15/mo.",
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="section-label mb-3">Partners</p>
      <h1 className="graffiti-heading mb-4">Support</h1>
      <p className="mb-10 max-w-2xl text-hero-light">
        Help keep uncompromised Christian hip-hop in the streets. Free, Supporter, or VIP.
      </p>
      <SupportTiers />
    </div>
  );
}
