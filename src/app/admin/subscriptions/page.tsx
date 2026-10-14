import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { formatWhen, statusLabel } from "@/lib/admin-csv";
import { getAdminData, type AdminSubscription } from "@/lib/admin-data";
import { formatMoney } from "@/lib/merch";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: "Subscriptions" };
}

export default async function AdminSubscriptionsPage() {
  const data = await getAdminData();
  const active = data.subscriptions.filter((item) => item.status === "active" || item.status === "trialing");
  const canceled = data.subscriptions.filter((item) => item.status === "canceled");
  const pastDue = data.subscriptions.filter((item) => item.status === "past_due");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="section-heading text-3xl">Subscriptions</h1>
        <p className="mt-2 text-sm text-hero-muted">Live Stripe subscriptions. Trialing plans are listed with active.</p>
      </div>
      {!data.stripeConfigured && <p className="text-sm text-hero-accent">Stripe is not configured.</p>}
      {data.stripeError && <p className="text-sm text-hero-accent">{data.stripeError}</p>}
      <SubscriptionGroup title="Active" items={active} />
      <SubscriptionGroup title="Canceled" items={canceled} />
      <SubscriptionGroup title="Past due" items={pastDue} />
    </div>
  );
}

function SubscriptionGroup({ title, items }: { title: string; items: AdminSubscription[] }) {
  return (
    <section className="space-y-4">
      <h2 className="section-heading text-2xl">
        {title} <span className="text-hero-muted">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="card-surface text-sm text-hero-light">None.</p>
      ) : (
        <>
          <ul className="space-y-4 md:hidden">
            {items.map((item) => (
              <li key={item.id} className="card-surface space-y-1 text-sm">
                <p className="font-bold text-white">{item.name || item.email || "Customer"}</p>
                <p className="text-hero-muted">{item.email}</p>
                <p className="text-hero-light">
                  {item.tierLabel} · {formatMoney(item.amountCents)}/{item.interval} · {statusLabel(item.status)}
                </p>
                <p className="text-hero-muted">{formatWhen(item.created)} UTC</p>
                <a href={item.dashboardUrl} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase tracking-wider text-hero-accent">
                  Stripe customer
                </a>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto border border-hero-gray md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-hero-dark text-xs uppercase tracking-wider text-hero-muted">
                <tr>
                  <th className="px-3 py-3 font-bold">Customer</th>
                  <th className="px-3 py-3 font-bold">Plan</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="px-3 py-3 font-bold">Started</th>
                  <th className="px-3 py-3 font-bold">Stripe</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-hero-gray">
                    <td className="px-3 py-3">
                      <p className="font-bold text-white">{item.name || "Customer"}</p>
                      <p className="text-hero-muted">{item.email}</p>
                    </td>
                    <td className="px-3 py-3 text-hero-light">
                      {item.tierLabel} · {formatMoney(item.amountCents)}/{item.interval}
                    </td>
                    <td className="px-3 py-3 text-hero-light">{statusLabel(item.status)}</td>
                    <td className="px-3 py-3 text-hero-muted">{formatWhen(item.created)}</td>
                    <td className="px-3 py-3">
                      <a href={item.dashboardUrl} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase tracking-wider text-hero-accent">
                        Customer
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
