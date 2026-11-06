import type { Metadata } from "next";
import Link from "next/link";
import { SHOW } from "@/lib/show-config";

export const metadata: Metadata = {
  title: `${SHOW.name} checkout`,
  robots: { index: false, follow: false },
};

export default async function TicketSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; method?: string }>;
}) {
  const params = await searchParams;
  const message =
    params.method === "invoice"
      ? "Your sponsorship request is recorded. It stays unpaid until an invoice is sent or a check arrives."
      : params.kind === "sponsorship"
        ? "If the card payment went through, a sponsorship receipt will arrive by email. This page does not confirm payment."
        : params.kind === "ticket"
          ? "If the card payment went through, your tickets will arrive by email after payment is confirmed. Each ticket has its own QR code. This page does not issue tickets."
          : "This page does not confirm a payment.";

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <p className="section-label mb-3">{SHOW.name}</p>
      <h1 className="graffiti-heading mb-4">Payment page closed</h1>
      <p className="text-hero-light">{message}</p>
      <Link href="/set-apart" className="btn-ghost mt-8">
        Back to SET APART
      </Link>
    </div>
  );
}
