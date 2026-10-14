import { toggleOrderFulfilled } from "@/app/admin/orders/actions";
import type { AdminOrder } from "@/lib/admin-data";
import { formatWhen } from "@/lib/admin-csv";
import { formatMoney } from "@/lib/merch";

export default function OrderCards({
  orders,
  toggle = false,
}: {
  orders: AdminOrder[];
  toggle?: boolean;
}) {
  if (orders.length === 0) {
    return <p className="card-surface text-sm text-hero-light">No paid merch orders yet.</p>;
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
            <Fulfillment order={order} toggle={toggle} />
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto border border-hero-gray md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
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
                <td className="whitespace-pre-line px-3 py-3 text-hero-light">
                  {order.shippingAddress || "—"}
                </td>
                <td className="px-3 py-3 text-hero-light">{order.shippingRate || "—"}</td>
                <td className="px-3 py-3 font-bold text-white">{formatMoney(order.totalCents)}</td>
                <td className="px-3 py-3">
                  <Fulfillment order={order} toggle={toggle} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Fulfillment({ order, toggle }: { order: AdminOrder; toggle: boolean }) {
  if (!toggle) {
    return (
      <p className={`text-xs font-bold uppercase tracking-wider ${order.fulfilled ? "text-hero-accent" : "text-hero-muted"}`}>
        {order.fulfilled ? "Fulfilled" : "Unfulfilled"}
      </p>
    );
  }

  return (
    <form action={toggleOrderFulfilled} className="space-y-2">
      <input type="hidden" name="sessionId" value={order.id} />
      <input type="hidden" name="fulfilled" value={order.fulfilled ? "false" : "true"} />
      <p className={`text-xs font-bold uppercase tracking-wider ${order.fulfilled ? "text-hero-accent" : "text-hero-muted"}`}>
        {order.fulfilled ? "Fulfilled" : "Unfulfilled"}
      </p>
      <button type="submit" className="btn-ghost px-3 py-2 text-xs">
        {order.fulfilled ? "Mark unfulfilled" : "Mark fulfilled"}
      </button>
    </form>
  );
}
