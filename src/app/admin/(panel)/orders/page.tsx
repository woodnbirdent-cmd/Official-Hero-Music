import type { Metadata } from "next";
import Link from "next/link";
import OrderCards from "@/components/admin/OrderCards";
import OrderFilters from "@/components/admin/OrderFilters";
import { requireAdmin } from "@/lib/admin";
import { getAdminData } from "@/lib/admin-data";
import { filterOrders, isOrderType } from "@/lib/admin-orders";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: "Orders" };
}

function exportHref(type: string, query: string): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `/admin/orders/export?${search}` : "/admin/orders/export";
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const params = await searchParams;
  const type = isOrderType(params.type) ? params.type : "";
  const query = (params.q || "").slice(0, 100);
  const data = await getAdminData();
  const orders = filterOrders(data.orders, type, query);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-heading text-3xl">Orders</h1>
          <p className="mt-2 max-w-2xl text-sm text-hero-muted">
            Paid Stripe Checkout sessions, newest first. Times are Central Time. This page only reads Stripe.
            {data.orders.length > 0 ? ` ${orders.length} shown.` : ""}
          </p>
        </div>
        <Link href={exportHref(type, query)} className="btn-ghost">
          Export CSV
        </Link>
      </div>
      <OrderFilters action="/admin/orders" type={type} query={query} />
      {!data.stripeConfigured && <p className="text-sm text-hero-accent">Stripe is not configured.</p>}
      {data.stripeError && <p className="text-sm text-hero-accent">{data.stripeError}</p>}
      {data.itemsIncomplete && (
        <p className="text-sm text-hero-muted">Some older orders did not load item names. Totals and customer details are still listed.</p>
      )}
      <OrderCards orders={orders} />
    </div>
  );
}
