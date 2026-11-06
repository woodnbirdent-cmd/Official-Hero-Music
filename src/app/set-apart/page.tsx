import type { Metadata } from "next";
import { UnifrakturCook } from "next/font/google";
import Image from "next/image";
import SponsorshipForms from "@/components/show/SponsorshipForms";
import VolunteerForm from "@/components/show/VolunteerForm";
import { SHOW } from "@/lib/show-config";

const gothic = UnifrakturCook({
  weight: "700",
  subsets: ["latin"],
  display: "swap",
});

const description = `${SHOW.presenters} present ${SHOW.name}, featuring ${SHOW.headliner}, with ${SHOW.withLine}. ${SHOW.dateLabel}, ${SHOW.timeLabel}. ${SHOW.location}.`;

const flyerAlt = `${SHOW.name} flyer. ${SHOW.presenters} present. Featuring ${SHOW.headliner}, with ${SHOW.withLine}. ${SHOW.dateLabel}, ${SHOW.timeLabel}. ${SHOW.location}.`;

export const metadata: Metadata = {
  title: SHOW.name,
  description,
  openGraph: {
    title: SHOW.name,
    description,
    images: [
      {
        url: SHOW.poster,
        width: SHOW.posterWidth,
        height: SHOW.posterHeight,
        alt: flyerAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SHOW.name,
    description,
    images: [SHOW.poster],
  },
};

export default async function SetApartPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="bg-[#14060a] text-[#f6efe4]">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-[#f6efe4]/80">
          {SHOW.presenters} present
        </p>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-12">
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <Image
              src={SHOW.story}
              alt={flyerAlt}
              width={SHOW.storyWidth}
              height={SHOW.storyHeight}
              priority
              className="h-auto w-full border border-[#f6efe4]/30 md:hidden"
            />
            <Image
              src={SHOW.poster}
              alt={flyerAlt}
              width={SHOW.posterWidth}
              height={SHOW.posterHeight}
              priority
              className="hidden h-auto w-full border border-[#f6efe4]/30 md:block"
            />
          </div>

          <div className="lg:pt-4">
            <h1 className={`${gothic.className} text-6xl leading-none text-[#f6efe4] sm:text-7xl md:text-8xl`}>
              {SHOW.name}
            </h1>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.35em] text-[#ff4b4b]">Featuring</p>
            <p className="mt-2 font-display text-5xl tracking-wide text-white sm:text-6xl">{SHOW.headliner}</p>
            <p className="mt-4 text-base tracking-wide text-[#f6efe4]/90">With {SHOW.withLine}</p>

            <div className="mt-8 bg-[#e10600] px-4 py-4 text-center text-white">
              <p className="text-base font-black uppercase tracking-wide sm:text-lg">{SHOW.dateLabel}</p>
              <p className="mt-1 text-sm font-black uppercase tracking-[0.22em]">{SHOW.timeLabel}</p>
            </div>
            <p className="mt-3 text-center text-sm font-bold uppercase tracking-[0.28em] text-[#f6efe4]">
              {SHOW.location}
            </p>

            {params.canceled === "1" && (
              <p className="mt-6 border border-[#e10600] px-4 py-3 text-sm text-[#f6efe4]" role="status">
                Checkout was canceled. No charge was made.
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#sponsorship"
                className="inline-flex items-center justify-center border-2 border-[#f6efe4] bg-[#f6efe4] px-6 py-3 text-sm font-bold uppercase tracking-wider text-[#14060a] transition hover:bg-transparent hover:text-[#f6efe4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f6efe4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#14060a]"
              >
                Sponsor
              </a>
              <a
                href="#volunteer"
                className="inline-flex items-center justify-center border-2 border-[#f6efe4]/50 px-6 py-3 text-sm font-bold uppercase tracking-wider text-[#f6efe4] transition hover:border-[#f6efe4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f6efe4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#14060a]"
              >
                Volunteer
              </a>
            </div>
          </div>
        </div>

        <section id="sponsorship" className="mt-16 border-t border-[#f6efe4]/15 pt-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#ff4b4b]">Sponsorship</p>
          <h2 className="mt-3 font-display text-5xl tracking-wide text-[#f6efe4] sm:text-6xl">Sponsor the show</h2>
          <p className="mt-4 max-w-2xl text-[#f6efe4]/80">
            Community Sponsor is for individuals. Business sponsorships include a logo. Suggested business
            tiers can change. A receipt goes out by email after a card payment is confirmed. Choosing invoice
            or check records the request and does not charge a card.
          </p>
          <div className="mt-8">
            <SponsorshipForms />
          </div>
        </section>

        <section id="volunteer" className="mt-16 max-w-2xl border-t border-[#f6efe4]/15 pt-12 pb-28">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#ff4b4b]">Volunteer</p>
          <h2 className="mt-3 font-display text-5xl tracking-wide text-[#f6efe4] sm:text-6xl">Sign up to help</h2>
          <p className="mt-4 text-[#f6efe4]/80">
            Help with {SHOW.name}. Sign-up is free. Choose the parts of the day you can be there and how you
            want to help.
          </p>
          <div className="mt-8">
            <VolunteerForm />
          </div>
        </section>
      </div>
    </div>
  );
}
