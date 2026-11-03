import { toggleOrderArchived, toggleOrderFulfilled } from "@/app/admin/orders/actions";
import type { AdminOrder } from "@/lib/admin-data";
import { formatChicago } from "@/lib/admin-orders";
import { formatMoney } from "@/lib/merch";

export default function OrderCards({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) {
    return <p className="card-surface text-sm text-hero-light">No paid orders in this view.</p>;
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
            <p className="text-xs font-bold uppercase tracking-wider text-hero-accent">{order.typeLabel}</p>
            <p className="text-hero-light">{formatChicago(order.created)}</p>
            <p className="text-hero-light">{order.itemSummary || "Items not stored"}</p>
            <OrderDetails order={order} />
            <p className="whitespace-pre-line text-hero-light">{order.shippingAddress || "No shipping address"}</p>
            <p className="text-hero-muted">{order.shippingRate || "No shipping method"}</p>
            <OrderStatus order={order} />
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto border border-hero-gray md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-hero-dark text-xs uppercase tracking-wider text-hero-muted">
            <tr>
              <th className="px-3 py-3 font-bold">When</th>
              <th className="px-3 py-3 font-bold">Customer</th>
              <th className="px-3 py-3 font-bold">Type</th>
              <th className="px-3 py-3 font-bold">Items</th>
              <th className="px-3 py-3 font-bold">Ship to</th>
              <th className="px-3 py-3 font-bold">Shipping</th>
              <th className="px-3 py-3 font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-hero-gray align-top">
                <td className="px-3 py-3 text-hero-light">{formatChicago(order.created)}</td>
                <td className="px-3 py-3">
                  <p className="font-bold text-white">{order.customerName || "Customer"}</p>
                  <p className="text-hero-muted">{order.customerEmail || "No email"}</p>
                </td>
                <td className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-hero-accent">{order.typeLabel}</td>
                <td className="px-3 py-3 text-hero-light">
                  <p>{order.itemSummary || "Not stored"}</p>
                  <OrderDetails order={order} />
                </td>
                <td className="whitespace-pre-line px-3 py-3 text-hero-light">{order.shippingAddress || "—"}</td>
                <td className="px-3 py-3 text-hero-light">{order.shippingRate || "—"}</td>
                <td className="px-3 py-3">
                  <p className="font-bold text-white">{formatMoney(order.totalCents)}</p>
                  <OrderStatus order={order} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function OrderDetails({ order }: { order: AdminOrder }) {
  if (order.details.length === 0) return null;
  return (
    <dl className="mt-2 space-y-1">
      {order.details.map((detail) => (
        <div key={`${detail.label}-${detail.value}`}>
          <dt className="text-xs font-bold uppercase tracking-wider text-hero-muted">{detail.label}</dt>
          <dd className="break-all text-hero-light">
            {detail.href ? (
              <a href={detail.href} target="_blank" rel="noopener noreferrer" className="underline">
                {detail.value}
              </a>
            ) : (
              detail.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function OrderStatus({ order }: { order: AdminOrder }) {
  const refundLabel =
    order.refundedCents <= 0
      ? ""
      : order.refundedCents >= order.totalCents
        ? "Refunded"
        : `Refunded ${formatMoney(order.refundedCents)}`;

  return (
    <div className="mt-2 space-y-2">
      {order.archived && <p className="text-xs font-bold uppercase tracking-wider text-hero-accent">Archived</p>}
      {order.type === "merch" && (
        <p className={`text-xs font-bold uppercase tracking-wider ${order.fulfilled ? "text-hero-accent" : "text-hero-muted"}`}>
          {order.fulfilled ? "Fulfilled" : "Unfulfilled"}
        </p>
      )}
      {refundLabel && <p className="text-xs font-bold uppercase tracking-wider text-hero-accent">{refundLabel}</p>}
      {order.shippoOrderId && (
        <p className="text-xs">
          <span className="font-bold uppercase tracking-wider text-hero-accent">Sent to Shippo</span>
          <span className="mt-1 block break-all font-mono text-hero-light">{order.shippoOrderId}</span>
        </p>
      )}
      {order.type === "merch" && (
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
        </div>
      )}
    </div>
  );
}
