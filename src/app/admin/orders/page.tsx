import type { Metadata } from "next";
import Link from "next/link";
import OrderCards from "@/components/admin/OrderCards";
import { requireAdmin } from "@/lib/admin";
import { getAdminData } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: "Orders" };
}

export default async function AdminOrdersPage() {
  const data = await getAdminData();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-heading text-3xl">Orders</h1>
          <p className="mt-2 text-sm text-hero-muted">
            Paid merch checkout sessions. Fulfillment is saved in the database.
          </p>
        </div>
        <Link href="/admin/orders/export" className="btn-ghost">
          Export CSV
        </Link>
      </div>
      {!data.stripeConfigured && <p className="text-sm text-hero-accent">Stripe is not configured.</p>}
      {data.stripeError && <p className="text-sm text-hero-accent">{data.stripeError}</p>}
      <OrderCards orders={data.orders} toggle />
    </div>
  );
}
