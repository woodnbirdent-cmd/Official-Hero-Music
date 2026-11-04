import AdminNav from "@/components/admin/AdminNav";
import SignOutButton from "@/components/auth/SignOutButton";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="section-label">Private</p>
        <SignOutButton />
      </div>
      <AdminNav />
      {children}
    </div>
  );
}
