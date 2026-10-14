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

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.archived === "1";
  const data = await getAdminData();
  const archivedCount = data.orders.filter((order) => order.archived).length;
  const orders = showArchived ? data.orders : data.orders.filter((order) => !order.archived);
  const exportHref = showArchived ? "/admin/orders/export?archived=1" : "/admin/orders/export";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-heading text-3xl">Orders</h1>
          <p className="mt-2 max-w-2xl text-sm text-hero-muted">
            Paid Stripe payments cannot be deleted. Archive hides an order from this list. Refund sends the money back
            through Stripe and leaves the payment in place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={showArchived ? "/admin/orders" : "/admin/orders?archived=1"} className="btn-ghost">
            {showArchived ? "Hide archived" : `Show archived${archivedCount ? ` (${archivedCount})` : ""}`}
          </Link>
          <Link href={exportHref} className="btn-ghost">
            Export CSV
          </Link>
        </div>
      </div>
      {!data.stripeConfigured && <p className="text-sm text-hero-accent">Stripe is not configured.</p>}
      {data.stripeError && <p className="text-sm text-hero-accent">{data.stripeError}</p>}
      <OrderCards orders={orders} manage />
    </div>
  );
}
