import Image from "next/image";
import Link from "next/link";
import { SHOW } from "@/lib/show-config";

export default function SetApartBanner() {
  return (
    <section className="border-y border-[#e10600] bg-[#14060a] text-[#f6efe4]">
      <Link
        href="/set-apart"
        className="group mx-auto grid max-w-6xl items-center gap-5 px-4 py-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f6efe4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#14060a] sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-6 sm:py-8 md:grid-cols-[10rem_minmax(0,1fr)]"
      >
        <Image
          src={SHOW.poster}
          alt=""
          width={SHOW.posterWidth}
          height={SHOW.posterHeight}
          sizes="(min-width: 768px) 10rem, 7.5rem"
          className="mx-auto h-auto w-full max-w-[10rem] border border-[#f6efe4]/30"
        />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#f6efe4]/75">
            {SHOW.presenters} present
          </p>
          <h2 className="mt-2 font-display text-5xl tracking-wide text-[#f6efe4] sm:text-6xl">{SHOW.name}</h2>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.28em] text-[#ff4b4b]">Featuring</p>
          <p className="mt-1 font-display text-3xl tracking-wide text-white sm:text-4xl">{SHOW.headliner}</p>
          <p className="mt-2 text-sm tracking-wide text-[#f6efe4]/90">With {SHOW.withLine}</p>
          <p className="mt-4 inline-block bg-[#e10600] px-3 py-2 text-sm font-black uppercase tracking-wide text-white">
            {SHOW.dateLabel} · {SHOW.timeLabel}
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.22em]">{SHOW.location}</p>
          <p className="mt-4 text-sm font-bold uppercase tracking-wider text-[#f6efe4] underline decoration-[#e10600] underline-offset-4 group-hover:decoration-[#f6efe4]">
            See the show
          </p>
        </div>
      </Link>
    </section>
  );
}
