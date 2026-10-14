import type { Metadata } from "next";
import AdminNav from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="section-label mb-3">Private</p>
      <AdminNav />
      {children}
    </div>
  );
}
