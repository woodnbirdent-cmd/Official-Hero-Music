import type { Metadata } from "next";
import CredentialsForm from "@/components/auth/CredentialsForm";
import { isTier, safeNextPath, type Tier } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a #Hero member account.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; next?: string }>;
}) {
  const params = await searchParams;
  const tier: Tier = isTier(params.tier) ? params.tier : "free";
  const nextPath = safeNextPath(params.next, "/members");

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="section-label mb-3">Members</p>
      <h1 className="graffiti-heading mb-4">Create account</h1>
      <p className="mb-8 text-hero-light">
        Free accounts get the updates feed. Supporter and VIP start here, then go to Stripe.
      </p>
      <CredentialsForm mode="sign-up" nextPath={nextPath} tier={tier} />
    </div>
  );
}
