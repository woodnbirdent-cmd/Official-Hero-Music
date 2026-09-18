import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import BandsintownWidget from "@/components/BandsintownWidget";
import { ParallaxLayer, ParallaxRoot } from "@/components/parallax";
import { BANDSINTOWN, SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Tour",
  description: `Upcoming ${SITE.artist} shows. Track dates on Bandsintown and get notified.`,
};

export default function TourPage() {
  return (
    <ParallaxRoot>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="section-label mb-3">On the road</p>
        <h1 className="graffiti-heading mb-4">Tour</h1>
        <p className="mb-8 max-w-2xl text-hero-light">
          Live dates for {SITE.artist}. If nothing is listed yet, the calendar still stands
          ready — track on Bandsintown or join the list and we&apos;ll hit you when shows
          drop.
        </p>

        <div className="mb-12 flex flex-wrap gap-3">
          <a
            href={BANDSINTOWN.shortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Bandsintown
          </a>
          <a
            href={BANDSINTOWN.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            Full artist page
          </a>
          <a
            href={BANDSINTOWN.trackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent"
          >
            Track / follow
          </a>
          <Link href="/join" className="btn-ghost">
            Notify me
          </Link>
        </div>

        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.7fr)]">
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 className="section-heading text-xl tracking-wide">Upcoming dates</h2>
              <p className="text-xs uppercase tracking-wider text-hero-muted">
                Powered by Bandsintown
              </p>
            </div>
            <BandsintownWidget />
            <div className="mt-6 border border-hero-surface bg-hero-dark p-6">
              <p className="section-label mb-3">Empty calendar</p>
              <h3 className="mb-3 text-xl font-black uppercase tracking-tight text-hero-accent">
                Dates drop here
              </h3>
              <p className="mb-6 max-w-xl text-sm leading-relaxed text-hero-light">
                No shows on the books is still a premium lane. Track {SITE.artist} on
                Bandsintown for city requests and on-sale alerts, or join the mailing list
                for a direct notify.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/join" className="btn-primary">
                  Notify me
                </Link>
                <a
                  href={BANDSINTOWN.trackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost"
                >
                  Track on Bandsintown
                </a>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="overflow-hidden border border-hero-surface">
              <ParallaxLayer speed={0.1}>
                <Image
                  src="/photo-2.jpg"
                  alt="#Hero"
                  width={600}
                  height={700}
                  className="w-full origin-center scale-125 object-cover grayscale"
                />
              </ParallaxLayer>
            </div>
            <div className="card-surface">
              <p className="section-label mb-3">Booking</p>
              <p className="mb-4 text-sm text-hero-light">
                Private events, churches, and outreaches go through the booking form.
              </p>
              <Link href="/booking" className="btn-ghost text-xs">
                Booking request
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </ParallaxRoot>
  );
}
