import type { Metadata } from "next";
import AdminPasswordForm from "@/components/admin/AdminPasswordForm";
import { requireAdmin } from "@/lib/admin";
import { adminHasPassword } from "@/lib/admin-password";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: "Password" };
}

export default async function AdminPasswordPage() {
  const member = await requireAdmin();
  const hasPassword = await adminHasPassword(member.id);
  let title = "Set password";
  let detail =
    "This account has no password yet. Setting one lets you sign in with email and password. Email links keep working.";
  if (hasPassword === null) {
    title = "Password";
    detail = "Password settings could not be loaded.";
  } else if (hasPassword) {
    title = "Change password";
    detail = "Enter the current password, then choose a new one. Other sessions are signed out after this change.";
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="section-heading text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-hero-muted">{detail}</p>
      </div>
      {hasPassword === null ? (
        <p className="text-sm text-hero-accent">Could not load password settings.</p>
      ) : (
        <AdminPasswordForm mode={hasPassword ? "change" : "set"} />
      )}
      <p className="text-sm text-hero-muted">
        Use at least 12 characters. Setting or changing a password needs a sign-in from the last 8 hours. If this session is older, sign in again with an email link.
      </p>
    </div>
  );
}
