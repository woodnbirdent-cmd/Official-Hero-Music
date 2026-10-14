import type { Metadata } from "next";
import JoinForm from "@/components/JoinForm";
import MembershipTiers from "@/components/membership/MembershipTiers";
import { TIER_DETAILS, isTier } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "Join",
  description: "Join #Hero — Free, Supporter $7/mo, or VIP $15/mo.",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const params = await searchParams;
  const upgrade = isTier(params.upgrade) ? params.upgrade : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="section-label mb-3">Members</p>
      <h1 className="graffiti-heading mb-4">Join</h1>
      <p className="mb-8 max-w-2xl text-hero-light">
        Free gets you an account and the updates feed. Supporter adds early access. VIP adds
        free merch shipping and member downloads.
      </p>
      {upgrade && (
        <p className="mb-8 text-sm text-hero-accent" role="status">
          That page needs the {TIER_DETAILS[upgrade].name} plan.
        </p>
      )}
      <MembershipTiers />

      <div id="list" className="mx-auto mt-16 max-w-xl">
        <p className="section-label mb-3">Mailing list</p>
        <h2 className="mb-4 text-2xl font-black uppercase tracking-tight text-hero-accent">
          No account required
        </h2>
        <p className="mb-6 text-hero-light">
          Get new music, show dates, and community updates. No spam — just the real drops.
        </p>
        <JoinForm />
      </div>
    </div>
  );
}
