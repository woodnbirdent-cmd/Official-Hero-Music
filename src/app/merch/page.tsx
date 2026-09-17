import type { Metadata } from "next";
import MerchWaitlistForm from "@/components/MerchWaitlistForm";

export const metadata: Metadata = {
  title: "Merch",
  description: "Official #Hero merch — shop coming soon.",
};

export default function MerchPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="section-label mb-3">Gear</p>
      <h1 className="graffiti-heading mb-4">Merch</h1>
      <div className="card-surface mb-10">
        <p className="section-heading mb-2 text-2xl">Shop coming soon</p>
        <p className="mb-6 text-hero-light">
          Official #Hero merch is on the way. Drop your email and we&apos;ll hit you when
          the shop goes live. External shop link stub ready for later wiring.
        </p>
        {/* TODO: Replace waitlist with external shop URL when store is live */}
        <MerchWaitlistForm />
      </div>
      <p className="text-sm text-hero-muted">
        External shop stub:{" "}
        <span className="text-hero-light">https://officialheromusic.com/shop</span>{" "}
        (not live — placeholder)
      </p>
    </div>
  );
}
