import Image from "next/image";
import { REVIEW_GROUPS, REVIEW_POT_LINE, ROLLOUT_HEAVEN } from "@/lib/constants";

export default function RolloutHeavenCard() {
  return (
    <div>
      <a href={ROLLOUT_HEAVEN.watchUrl} target="_blank" rel="noopener noreferrer" className="block">
        <Image
          src={ROLLOUT_HEAVEN.image}
          alt={ROLLOUT_HEAVEN.imageAlt}
          width={ROLLOUT_HEAVEN.imageWidth}
          height={ROLLOUT_HEAVEN.imageHeight}
          className="h-auto w-full border border-hero-gray"
          sizes="(min-width: 1024px) 1152px, 100vw"
        />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>

      <div className="mt-8 space-y-8">
        {REVIEW_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`review-group-${group.id}`}>
            <h3 id={`review-group-${group.id}`} className="section-label mb-3">
              {group.label}
            </h3>
            <ul
              className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
                group.id === "audio" ? "lg:grid-cols-4" : ""
              }`}
            >
              {group.tiers.map((tier) => (
                <li key={tier.id} className="h-full">
                  <a
                    href={ROLLOUT_HEAVEN.watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full flex-col border border-hero-gray bg-black p-4 transition hover:border-hero-accent focus:outline-none focus-visible:border-hero-accent focus-visible:ring-2 focus-visible:ring-hero-accent"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-black uppercase tracking-wide text-white">{tier.name}</span>
                      {"badge" in tier && tier.badge ? (
                        <span className="shrink-0 border border-hero-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-hero-accent">
                          {tier.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-3 font-display text-4xl leading-none text-hero-accent">{tier.price}</span>
                    <span className="mt-3 text-sm leading-snug text-hero-light">{tier.detail}</span>
                    {"note" in tier && tier.note ? (
                      <span className="mt-2 text-xs font-bold uppercase tracking-wider text-hero-muted">{tier.note}</span>
                    ) : null}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 border border-hero-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-hero-accent">
        {REVIEW_POT_LINE}
      </p>
    </div>
  );
}
