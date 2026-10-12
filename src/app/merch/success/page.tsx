import type { Metadata } from "next";
import Link from "next/link";
import ClearCart from "@/components/merch/ClearCart";

export const metadata: Metadata = {
  title: "Order confirmed",
  description: "Your #Hero merch order was received.",
};

export default function MerchSuccessPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <ClearCart />
      <p className="section-label mb-3">Shop</p>
      <h1 className="graffiti-heading mb-4">Order confirmed</h1>
      <div className="card-surface">
        <p className="mb-6 text-hero-light">
          Thanks. Stripe will email your receipt when the payment is complete.
        </p>
        <Link href="/merch" className="btn-accent">
          Back to merch
        </Link>
      </div>
    </div>
  );
}
