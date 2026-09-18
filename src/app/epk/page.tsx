import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SocialIcons from "@/components/SocialIcons";
import StreamingLinks from "@/components/StreamingLinks";
import {
  BIO,
  FYC,
  PRESS_ASSETS,
  SHORT_BIO,
  SITE,
  SOCIALS,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: "EPK",
  description: `Electronic press kit for ${SITE.artist} (${SITE.legalName}) — bio, highlights, photos, and booking.`,
};

export default function EpkPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="section-label mb-3">Press kit</p>
        <h1 className="graffiti-heading mb-4">EPK</h1>
        <p className="mb-10 max-w-2xl text-hero-light">
          Press and booking materials for {SITE.artist}. Facts below match the official
          hub and FYC page — no extra claims.
        </p>

        <section className="mb-16 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="overflow-hidden border border-hero-surface">
              <Image
                src="/photo-1.jpg"
                alt="#Hero press photo"
                width={1200}
                height={1500}
                className="h-full w-full object-cover grayscale"
                priority
              />
          </div>
          <div className="border border-hero-surface bg-hero-dark p-6 md:p-8">
            <p className="section-label mb-4">One-sheet</p>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-hero-muted">
                  Artist
                </dt>
                <dd className="text-lg font-black uppercase text-white">{SITE.artist}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-hero-muted">
                  Legal name
                </dt>
                <dd className="text-hero-light">{SITE.legalName}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-hero-muted">
                  Location
                </dt>
                <dd className="text-hero-light">{SITE.location}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-hero-muted">
                  Label
                </dt>
                <dd className="text-hero-light">{SITE.label}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-hero-muted">
                  Genre
                </dt>
                <dd className="text-hero-light">{SITE.genre}</dd>
              </div>
            </dl>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/booking" className="btn-primary">
                Booking
              </Link>
              <Link href="/music" className="btn-ghost">
                Listen
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <p className="section-label mb-3">Short bio</p>
          <h2 className="graffiti-heading mb-6">Cut this</h2>
          <p className="max-w-3xl text-base leading-relaxed text-hero-light sm:text-lg">
            {SHORT_BIO}
          </p>
        </section>

        <section className="mb-16">
          <p className="section-label mb-3">Long bio</p>
          <h2 className="section-heading mb-6 text-3xl">Full story</h2>
          <p className="max-w-3xl text-base leading-relaxed text-hero-light sm:text-lg">
            {BIO}
          </p>
        </section>

        <section className="mb-16 border-y border-hero-surface bg-hero-dark px-4 py-12 md:px-8">
          <p className="section-label mb-3">{FYC.title}</p>
          <h2 className="graffiti-heading mb-4">{FYC.category}</h2>
          <p className="mb-10 max-w-3xl text-sm leading-relaxed text-hero-light sm:text-base">
            {FYC.framing}
          </p>
          <ul className="grid gap-6 md:grid-cols-3">
            {FYC.highlights.map((item) => (
              <li key={item.title} className="border border-hero-surface bg-black p-6">
                <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-hero-accent">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-hero-light">{item.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-hero-muted">
            Framing adapted from the official FYC page. Not a nomination or award claim.
          </p>
        </section>

        <section className="mb-16">
          <p className="section-label mb-3">Assets</p>
          <h2 className="section-heading mb-6 text-3xl">Logos &amp; photos</h2>
          <p className="mb-8 max-w-2xl text-sm text-hero-muted">
            Download press-ready files already on this site. Credit {SITE.artist} /{" "}
            {SITE.label}.
          </p>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRESS_ASSETS.map((asset) => (
              <li key={asset.src} className="border border-hero-surface bg-black">
                <div
                  className={`relative flex items-center justify-center overflow-hidden bg-hero-dark ${
                    asset.kind === "photo" ? "aspect-[4/5]" : "aspect-[16/10] p-6"
                  }`}
                >
                  <Image
                    src={asset.src}
                    alt={asset.label}
                    width={asset.width}
                    height={asset.height}
                    className={
                      asset.kind === "photo"
                        ? "h-full w-full object-cover grayscale"
                        : "h-auto max-h-32 w-auto object-contain"
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-hero-surface px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-hero-light">
                    {asset.label}
                  </p>
                  <a
                    href={asset.src}
                    download
                    className="text-xs font-bold uppercase tracking-wider text-hero-accent hover:underline"
                  >
                    Download
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-16">
          <p className="section-label mb-3">Connect</p>
          <h2 className="section-heading mb-6 text-3xl">Socials</h2>
          <SocialIcons className="mb-4" />
          <ul className="mt-4 grid gap-2 text-sm text-hero-muted sm:grid-cols-2">
            {SOCIALS.map((social) => (
              <li key={social.name}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-hero-accent hover:underline"
                >
                  {social.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-16">
          <p className="section-label mb-3">Streaming</p>
          <h2 className="section-heading mb-6 text-3xl">Listen</h2>
          <StreamingLinks includeHub hubLabel="Players on this site" />
        </section>

        <section className="border border-hero-surface bg-black p-6 md:flex md:items-center md:justify-between md:p-8">
          <div className="mb-6 md:mb-0">
            <p className="section-label mb-2">Inquiries</p>
            <h2 className="section-heading text-3xl">Book {SITE.artist}</h2>
            <p className="mt-2 max-w-md text-sm text-hero-muted">
              Concerts, church events, outreaches, and ministry nights.
            </p>
          </div>
          <Link href="/booking" className="btn-primary">
            Booking form
          </Link>
        </section>
    </div>
  );
}
