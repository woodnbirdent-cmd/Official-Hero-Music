import type { Metadata } from "next";
import BookingForm from "@/components/BookingForm";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Booking",
  description: `Book ${SITE.artist} for your event, church, or outreach.`,
};

export default function BookingPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="section-label mb-3">Bookings</p>
      <h1 className="graffiti-heading mb-4">Booking</h1>
      <p className="mb-8 text-hero-light">
        Book {SITE.artist} ({SITE.legalName}) for concerts, church events, outreaches,
        and ministry nights. Managed in partnership with Woodnbird Entertainment LLC /
        Lee McKinney context. Tell us about your event below.
      </p>
      <BookingForm />
    </div>
  );
}
