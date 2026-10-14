import type { Metadata } from "next";
import Link from "next/link";
import OrderCards from "@/components/admin/OrderCards";
import { requireAdmin } from "@/lib/admin";
import { formatDay } from "@/lib/admin-csv";
import { getAdminData } from "@/lib/admin-data";
import { formatMoney } from "@/lib/merch";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: "Overview" };
}

export default async function AdminOverviewPage() {
  const data = await getAdminData();
  const monthTotal = data.revenue.month.merch + data.revenue.month.subscriptions;
  const allTotal = data.revenue.allTime.merch + data.revenue.allTime.subscriptions;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="section-heading text-3xl">Overview</h1>
        <p className="mt-2 text-sm text-hero-muted">
          Merch comes from paid Stripe Checkout sessions. Subscriptions come from paid invoices. Figures refresh about once a minute.
        </p>
      </div>
      <Notices data={data} />

      <section className="grid gap-4 sm:grid-cols-2">
        <RevenueCard title="This month" merch={data.revenue.month.merch} subscriptions={data.revenue.month.subscriptions} total={monthTotal} />
        <RevenueCard title="All time" merch={data.revenue.allTime.merch} subscriptions={data.revenue.allTime.subscriptions} total={allTotal} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Free accounts" value={String(data.tiers.free)} detail="From the member database" />
        <Stat label="Supporter" value={String(data.tiers.supporter)} detail="Active and trialing" />
        <Stat label="VIP" value={String(data.tiers.vip)} detail="Active and trialing" />
        <Stat label="MRR" value={formatMoney(data.mrrCents)} detail={data.pastDue ? `${data.pastDue} past due` : "Active and trialing"} />
      </section>
      {data.tiers.other > 0 && (
        <p className="text-sm text-hero-muted">{data.tiers.other} active plans use a price other than $7 or $15.</p>
      )}

      <section className="card-surface">
        <p className="section-label mb-2">Last 30 days</p>
        <p className="text-3xl font-black text-white">{data.signups30d}</p>
        <p className="text-sm text-hero-muted">New accounts</p>
        {data.recentSignups.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {data.recentSignups.map((signup) => (
              <li key={`${signup.email}-${signup.joined.toISOString()}`} className="flex flex-wrap justify-between gap-2">
                <span className="text-white">{signup.name || signup.email}</span>
                <span className="text-hero-muted">{formatDay(signup.joined)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="section-heading text-2xl">Recent orders</h2>
          <Link href="/admin/orders" className="text-xs font-bold uppercase tracking-wider text-hero-accent">
            All orders
          </Link>
        </div>
        <OrderCards orders={data.orders.slice(0, 5)} />
      </section>
    </div>
  );
}

function RevenueCard({
  title,
  merch,
  subscriptions,
  total,
}: {
  title: string;
  merch: number;
  subscriptions: number;
  total: number;
}) {
  return (
    <div className="card-surface">
      <p className="section-label mb-3">{title}</p>
      <p className="text-3xl font-black text-white">{formatMoney(total)}</p>
      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-hero-muted">Merch</dt>
          <dd className="text-white">{formatMoney(merch)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-hero-muted">Subscriptions</dt>
          <dd className="text-white">{formatMoney(subscriptions)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="card-surface">
      <p className="section-label mb-2">{label}</p>
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-hero-muted">{detail}</p>
    </div>
  );
}

function Notices({ data }: { data: Awaited<ReturnType<typeof getAdminData>> }) {
  if (!data.stripeConfigured) {
    return <p className="text-sm text-hero-accent">Stripe is not configured. Member counts still come from the database.</p>;
  }
  return (
    <>
      {data.databaseError && <p className="text-sm text-hero-accent">{data.databaseError}</p>}
      {data.stripeError && <p className="text-sm text-hero-accent">{data.stripeError}</p>}
      {data.truncated && (
        <p className="text-sm text-hero-muted">Stripe returned more records than this dashboard loads. Totals cover the latest pages only.</p>
      )}
    </>
  );
}
