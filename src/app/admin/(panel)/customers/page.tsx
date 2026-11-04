import type { Metadata } from "next";
import OrderFilters from "@/components/admin/OrderFilters";
import { requireAdmin } from "@/lib/admin";
import { getAdminData } from "@/lib/admin-data";
import { filterCustomers, filterOrders, formatChicago, isOrderType } from "@/lib/admin-orders";
import { formatMoney } from "@/lib/merch";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: "Customers" };
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const params = await searchParams;
  const type = isOrderType(params.type) ? params.type : "";
  const query = (params.q || "").slice(0, 100);
  const data = await getAdminData();
  const customers = filterCustomers(data.customers, type, query);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-heading text-3xl">Customers</h1>
        <p className="mt-2 max-w-2xl text-sm text-hero-muted">
          People from paid Checkout sessions, grouped by email. Totals add the orders in this view.
          {data.customers.length > 0 ? ` ${customers.length} shown.` : ""}
        </p>
      </div>
      <OrderFilters action="/admin/customers" type={type} query={query} />
      {!data.stripeConfigured && <p className="text-sm text-hero-accent">Stripe is not configured.</p>}
      {data.stripeError && <p className="text-sm text-hero-accent">{data.stripeError}</p>}
      {customers.length === 0 ? (
        <p className="card-surface text-sm text-hero-light">No customers in this view.</p>
      ) : (
        <ul className="space-y-4">
          {customers.map((customer) => {
            const purchases = filterOrders(customer.orders, type, query);
            const totalCents = purchases.reduce((sum, purchase) => sum + purchase.totalCents, 0);
            return (
            <li key={customer.key} className="card-surface">
              <details>
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{customer.name || "Customer"}</p>
                      <p className="text-sm text-hero-muted">{customer.email || "No email"}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-wider text-hero-muted">Show purchases</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white">{formatMoney(totalCents)}</p>
                      <p className="text-xs uppercase tracking-wider text-hero-muted">
                        {purchases.length} {purchases.length === 1 ? "order" : "orders"}
                      </p>
                    </div>
                  </div>
                </summary>
                <ul className="mt-4 space-y-3 border-t border-hero-gray pt-4 text-sm">
                  {purchases.map((purchase) => (
                    <li key={purchase.id} className="grid gap-1 sm:grid-cols-[11rem_1fr_auto] sm:gap-3">
                      <p className="text-hero-light">{formatChicago(purchase.created)}</p>
                      <div>
                        <p className="font-bold uppercase tracking-wider text-hero-accent">{purchase.typeLabel}</p>
                        <p className="text-hero-light">{purchase.itemSummary || "Items not stored"}</p>
                        {purchase.artistName && <p className="text-hero-muted">Artist: {purchase.artistName}</p>}
                        {purchase.trackUrl && (
                          <a href={purchase.trackUrl} target="_blank" rel="noopener noreferrer" className="break-all underline">
                            {purchase.trackUrl}
                          </a>
                        )}
                      </div>
                      <p className="font-bold text-white sm:text-right">{formatMoney(purchase.totalCents)}</p>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
