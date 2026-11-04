import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatDollars } from "@/lib/show-config";
import { listShowOrders } from "@/lib/show-store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: "SET APART" };
}

export default async function AdminShowPage() {
  await requireAdmin();
  const orders = await listShowOrders();
  const unnotified = orders.filter((order) => {
    if (order.ownerNotifiedAt) return false;
    if (order.kind === "volunteer") return true;
    return order.kind === "sponsorship" && (order.status === "paid" || order.status === "unpaid");
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-heading text-3xl">SET APART</h1>
          <p className="mt-2 text-sm text-hero-muted">Tickets, sponsorships, and volunteers saved in the site database.</p>
        </div>
        <Link href="/admin/show/export" className="btn-primary text-xs">
          Download CSV
        </Link>
      </div>
      {unnotified > 0 && (
        <p className="border border-hero-accent px-4 py-3 text-sm text-hero-accent" role="status">
          {unnotified} {unnotified === 1 ? "record still needs" : "records still need"} a notification email.
        </p>
      )}
      {orders.length === 0 ? (
        <p className="text-sm text-hero-muted">No tickets, sponsorships, or volunteers yet.</p>
      ) : (
        <div className="overflow-x-auto border border-hero-gray">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-hero-dark text-xs uppercase tracking-wider text-hero-muted">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Checked in</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const used = order.tickets.filter((ticket) => ticket.redeemedAt).length;
                return (
                  <tr key={order.id} className="border-t border-hero-gray">
                    <td className="px-3 py-3">
                      <div className="font-bold text-white">{order.buyerName}</div>
                      <div className="text-hero-muted">{order.buyerEmail}</div>
                    </td>
                    <td className="px-3 py-3">
                      {order.kind === "sponsorship" ? "Sponsorship" : order.kind === "volunteer" ? "Volunteer" : "Ticket"}
                    </td>
                    <td className="px-3 py-3">{order.tierName}</td>
                    <td className="px-3 py-3">{order.quantity}</td>
                    <td className="px-3 py-3">{order.shirtSize}</td>
                    <td className="px-3 py-3">{formatDollars(order.amountCents)}</td>
                    <td className="px-3 py-3">{order.status}</td>
                    <td className="px-3 py-3">{order.tickets.length ? `${used}/${order.tickets.length}` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
