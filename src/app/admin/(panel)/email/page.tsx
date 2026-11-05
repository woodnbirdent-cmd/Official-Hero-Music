import type { Metadata } from "next";
import BroadcastPanel from "@/components/admin/BroadcastPanel";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: "Email" };
}

export default async function AdminEmailPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="section-heading text-3xl">Email</h1>
        <p className="mt-2 text-sm text-hero-muted">
          Send one email to each person you select. Nothing goes out until you confirm. The same subject, message, and groups cannot be sent twice.
        </p>
      </div>
      <BroadcastPanel />
    </div>
  );
}
