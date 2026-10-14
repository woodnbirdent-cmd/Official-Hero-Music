"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { refundOrder } from "@/app/admin/orders/actions";
import { formatMoney } from "@/lib/merch";

export default function RefundOrderDialog({
  order,
}: {
  order: { id: string; customerName: string; customerEmail: string; totalCents: number; refundedCents: number };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const remaining = Math.max(0, order.totalCents - order.refundedCents);

  async function onConfirm() {
    if (pending || remaining <= 0) return;
    setPending(true);
    setError("");
    const result = await refundOrder(order.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    dialog.current?.close();
    router.refresh();
  }

  if (remaining <= 0) return null;

  return (
    <>
      <button
        type="button"
        className="btn-ghost px-3 py-2 text-xs"
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        Refund
      </button>
      <dialog ref={dialog} className="w-[min(100%-2rem,28rem)] border border-hero-gray bg-black p-6 text-white">
        <h2 className="text-lg font-black uppercase tracking-tight">Refund order</h2>
        <p className="mt-3 text-sm text-hero-light">
          Refund {formatMoney(remaining)} to {order.customerName || order.customerEmail || "this customer"}? Stripe
          sends the money back. The paid payment stays in Stripe and cannot be deleted from this dashboard.
        </p>
        {error && (
          <p className="mt-3 text-sm text-hero-accent" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary px-4 py-2 text-xs" disabled={pending} onClick={onConfirm}>
            {pending ? "Refunding" : "Refund payment"}
          </button>
          <button type="button" className="btn-ghost px-4 py-2 text-xs" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
        </div>
      </dialog>
    </>
  );
}
