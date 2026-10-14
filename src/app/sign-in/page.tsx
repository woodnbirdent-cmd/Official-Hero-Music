import type { Metadata } from "next";
import CredentialsForm from "@/components/auth/CredentialsForm";
import { safeNextPath } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your #Hero member account.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next, "/account");

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="section-label mb-3">Members</p>
      <h1 className="graffiti-heading mb-4">Sign in</h1>
      <p className="mb-8 text-hero-light">Use the email and password on your member account.</p>
      <CredentialsForm mode="sign-in" nextPath={nextPath} />
    </div>
  );
}
