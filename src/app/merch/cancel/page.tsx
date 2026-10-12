import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Checkout canceled",
  description: "Stripe checkout was canceled. Your cart is still saved.",
};

export default function MerchCancelPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="section-label mb-3">Shop</p>
      <h1 className="graffiti-heading mb-4">Checkout canceled</h1>
      <div className="card-surface">
        <p className="mb-6 text-hero-light">
          No charge was made. Your cart is still here.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/merch/cart" className="btn-accent">
            Return to cart
          </Link>
          <Link href="/merch" className="btn-ghost">
            Keep shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
