import { toggleOrderArchived, toggleOrderFulfilled } from "@/app/admin/orders/actions";
import RefundOrderDialog from "@/components/admin/RefundOrderDialog";
import type { AdminOrder } from "@/lib/admin-data";
import { formatWhen } from "@/lib/admin-csv";
import { formatMoney } from "@/lib/merch";

export default function OrderCards({
  orders,
  manage = false,
}: {
  orders: AdminOrder[];
  manage?: boolean;
}) {
  if (orders.length === 0) {
    return <p className="card-surface text-sm text-hero-light">No paid merch orders in this view.</p>;
  }

  return (
    <>
      <ul className="space-y-4 md:hidden">
        {orders.map((order) => (
          <li key={order.id} className="card-surface space-y-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-white">{order.customerName || "Customer"}</p>
                <p className="text-hero-muted">{order.customerEmail || "No email"}</p>
              </div>
              <p className="font-bold text-white">{formatMoney(order.totalCents)}</p>
            </div>
            <p className="text-hero-light">{formatWhen(order.created)} UTC</p>
            <p className="text-hero-light">{order.itemSummary || "Items not stored"}</p>
            <p className="whitespace-pre-line text-hero-light">{order.shippingAddress || "No shipping address"}</p>
            <p className="text-hero-muted">{order.shippingRate || "No shipping rate"}</p>
            <OrderStatus order={order} manage={manage} />
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto border border-hero-gray md:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-hero-dark text-xs uppercase tracking-wider text-hero-muted">
            <tr>
              <th className="px-3 py-3 font-bold">Date</th>
              <th className="px-3 py-3 font-bold">Customer</th>
              <th className="px-3 py-3 font-bold">Items</th>
              <th className="px-3 py-3 font-bold">Ship to</th>
              <th className="px-3 py-3 font-bold">Rate</th>
              <th className="px-3 py-3 font-bold">Total</th>
              <th className="px-3 py-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-hero-gray align-top">
                <td className="px-3 py-3 text-hero-light">{formatWhen(order.created)}</td>
                <td className="px-3 py-3">
                  <p className="font-bold text-white">{order.customerName || "Customer"}</p>
                  <p className="text-hero-muted">{order.customerEmail}</p>
                </td>
                <td className="px-3 py-3 text-hero-light">{order.itemSummary || "Not stored"}</td>
                <td className="whitespace-pre-line px-3 py-3 text-hero-light">{order.shippingAddress || "—"}</td>
                <td className="px-3 py-3 text-hero-light">{order.shippingRate || "—"}</td>
                <td className="px-3 py-3 font-bold text-white">{formatMoney(order.totalCents)}</td>
                <td className="px-3 py-3">
                  <OrderStatus order={order} manage={manage} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function OrderStatus({ order, manage }: { order: AdminOrder; manage: boolean }) {
  const refundLabel =
    order.refundedCents <= 0
      ? ""
      : order.refundedCents >= order.totalCents
        ? "Refunded"
        : `Refunded ${formatMoney(order.refundedCents)}`;

  return (
    <div className="space-y-2">
      {order.archived && <p className="text-xs font-bold uppercase tracking-wider text-hero-accent">Archived</p>}
      <p className={`text-xs font-bold uppercase tracking-wider ${order.fulfilled ? "text-hero-accent" : "text-hero-muted"}`}>
        {order.fulfilled ? "Fulfilled" : "Unfulfilled"}
      </p>
      {refundLabel && <p className="text-xs font-bold uppercase tracking-wider text-hero-accent">{refundLabel}</p>}
      {manage && (
        <div className="flex flex-wrap gap-2">
          <form action={toggleOrderFulfilled}>
            <input type="hidden" name="sessionId" value={order.id} />
            <input type="hidden" name="fulfilled" value={order.fulfilled ? "false" : "true"} />
            <button type="submit" className="btn-ghost px-3 py-2 text-xs">
              {order.fulfilled ? "Mark unfulfilled" : "Mark fulfilled"}
            </button>
          </form>
          <form action={toggleOrderArchived}>
            <input type="hidden" name="sessionId" value={order.id} />
            <input type="hidden" name="archived" value={order.archived ? "false" : "true"} />
            <button type="submit" className="btn-ghost px-3 py-2 text-xs">
              {order.archived ? "Unarchive" : "Archive"}
            </button>
          </form>
          <RefundOrderDialog order={order} />
        </div>
      )}
    </div>
  );
}
