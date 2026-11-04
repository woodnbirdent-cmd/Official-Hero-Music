import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminSignInForm from "@/components/admin/AdminSignInForm";
import { adminGate } from "@/lib/admin";
import { safeAdminPath } from "@/lib/admin-allowlist";
import { adminMagicLinkConfigured } from "@/lib/admin-email";
import { accountsConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeAdminPath(params.next);
  const gate = await adminGate();
  if (gate.ok) redirect(nextPath);

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="section-label mb-3">Private</p>
      <h1 className="section-heading mb-4 text-4xl">Admin sign-in</h1>
      <p className="mb-8 text-sm text-hero-light">
        Only the addresses in ADMIN_EMAILS can open this area. Everyone else is denied.
      </p>
      {params.error === "link" && (
        <p className="mb-6 text-sm text-hero-accent">That sign-in link is invalid or expired. Request a new one.</p>
      )}
      {params.error === "expired" && (
        <p className="mb-6 text-sm text-hero-accent">That admin session expired. Sign in again.</p>
      )}
      {!accountsConfigured() ? (
        <p className="text-sm text-hero-accent">Accounts are not configured. Set DATABASE_URL and BETTER_AUTH_SECRET.</p>
      ) : (
        <AdminSignInForm nextPath={nextPath} magicLinkConfigured={adminMagicLinkConfigured()} />
      )}
    </div>
  );
}
