import type { Metadata } from "next";
import Image from "next/image";
import SponsorshipForms from "@/components/show/SponsorshipForms";
import TicketPurchase from "@/components/show/TicketPurchase";
import VolunteerForm from "@/components/show/VolunteerForm";
import { SHOW, TICKET_TIERS, formatDollars } from "@/lib/show-config";
import { ticketAvailability } from "@/lib/show-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: SHOW.name,
  description: `${SHOW.presenters} present ${SHOW.name}. ${SHOW.dateLabel}, ${SHOW.timeLabel}, ${SHOW.venue}, ${SHOW.city}.`,
};

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const params = await searchParams;
  const availability = await ticketAvailability();
  const tierAlt = TICKET_TIERS.map((tier) => `${formatDollars(tier.priceCents)} ${tier.name}`).join("; ");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="section-label mb-3">Live</p>
      <h1 className="graffiti-heading mb-3">{SHOW.name}</h1>
      <p className="mb-8 max-w-2xl text-hero-light">{SHOW.presenters} present</p>
      {params.canceled === "1" && (
        <p className="mb-6 text-sm text-hero-accent" role="status">
          Checkout was canceled. No charge was made.
        </p>
      )}
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Image
          src={SHOW.flyer}
          alt={`${SHOW.name} flyer. ${SHOW.presenters} present ${SHOW.lineup.join(", ")} on ${SHOW.dateLabel}, ${SHOW.timeLabel}, at ${SHOW.venue}, ${SHOW.city}. ${tierAlt}.`}
          width={SHOW.flyerWidth}
          height={SHOW.flyerHeight}
          priority
          className="h-auto w-full border border-hero-surface"
        />
        <div>
          <p className="text-lg font-bold text-white">
            {SHOW.dateLabel} · {SHOW.timeLabel}
          </p>
          <p className="mt-1 text-hero-light">
            {SHOW.venue}, {SHOW.city}
          </p>
          <p className="mt-4 text-sm text-hero-light">With {SHOW.lineup.join(" · ")}</p>
          <p className="mt-4 text-sm text-hero-muted">
            Shirt sizes are for pickup at the show. Tickets are emailed after payment is confirmed, one QR code each.
          </p>
          <div className="mt-8" id="tickets">
            <h2 className="section-heading mb-4 text-3xl">Tickets</h2>
            <TicketPurchase availability={availability} />
          </div>
        </div>
      </div>

      <section id="sponsorship" className="mt-16">
        <p className="section-label mb-3">Support the show</p>
        <h2 className="section-heading mb-4 text-4xl">Sponsorship</h2>
        <p className="mb-8 max-w-2xl text-hero-light">
          Sponsor {SHOW.name}. Community Sponsor is for individuals. Business tiers include a logo.
          A receipt goes out by email after a card payment is confirmed.
        </p>
        <SponsorshipForms />
      </section>

      <section id="volunteer" className="mt-16 max-w-2xl">
        <p className="section-label mb-3">Hands</p>
        <h2 className="section-heading mb-4 text-4xl">Volunteer</h2>
        <p className="mb-8 text-hero-light">
          Help with {SHOW.name}. Sign-up is free. Choose the parts of the day you can be there and how you want to help.
        </p>
        <VolunteerForm />
      </section>
    </div>
  );
}
