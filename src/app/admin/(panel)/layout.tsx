import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import SignOutButton from "@/components/auth/SignOutButton";
import { requireAdmin } from "@/lib/admin";
import { PASSWORD_OPTIONAL_NOTICE } from "@/lib/admin-password-policy";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="section-label">Private</p>
        <SignOutButton />
      </div>
      <p className="mb-6 text-sm text-hero-muted">
        {PASSWORD_OPTIONAL_NOTICE}{" "}
        <Link href="/admin/password" className="font-bold uppercase tracking-wider text-hero-accent">
          Set or change password
        </Link>
      </p>
      <AdminNav />
      {children}
    </div>
  );
}
