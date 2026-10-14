import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import Link from "next/link";
import SignOutButton from "@/components/auth/SignOutButton";
import { requireTier } from "@/lib/members";
import { TIER_DETAILS } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "Account",
  description: "Your #Hero membership.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; billing?: string }>;
}) {
  const member = await requireTier("free", "/account");
  const params = await searchParams;
  const details = TIER_DETAILS[member.tier];
  const billingNote =
    params.billing === "none"
      ? "Billing opens after you subscribe to Supporter or VIP."
      : params.billing === "error"
        ? "Stripe could not open the billing portal. In the Stripe Dashboard, enable the customer portal, then try again."
        : params.billing === "unconfigured"
          ? "Billing is not configured yet."
          : "";

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="section-label mb-3">Members</p>
      <h1 className="graffiti-heading mb-4">Account</h1>
      {params.checkout === "success" && (
        <p className="mb-6 text-sm text-hero-light">
          Stripe checkout finished. Your plan updates when the subscription webhook lands.
        </p>
      )}
      {billingNote && (
        <p className="mb-6 text-sm text-hero-accent" role="alert">
          {billingNote}
        </p>
      )}
      <div className="card-surface space-y-3">
        <p className="text-sm text-hero-muted">Signed in as</p>
        <p className="font-bold text-white">{member.name || member.email}</p>
        <p className="text-sm text-hero-light">{member.email}</p>
        <p className="pt-2 text-sm text-hero-muted">Current plan</p>
        <p className="text-3xl font-black text-white">
          {details.name}{" "}
          <span className="text-base font-normal text-hero-muted">
            {details.priceLabel}
            {details.period}
          </span>
        </p>
        <p className="text-sm text-hero-light">{details.description}</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/members" className="btn-primary">
          Member area
        </Link>
        {member.tier !== "vip" && (
          <Link href="/join" className="btn-accent">
            Upgrade
          </Link>
        )}
        {member.stripeCustomerId && (
          <form action="/api/membership/portal" method="post">
            <button type="submit" className="btn-ghost">
              Manage billing
            </button>
          </form>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}
