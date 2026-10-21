import Image from "next/image";
import { ROLLOUT_HEAVEN } from "@/lib/constants";

export default function RolloutHeavenCard() {
  const image = (
    <Image
      src={ROLLOUT_HEAVEN.image}
      alt={ROLLOUT_HEAVEN.imageAlt}
      width={ROLLOUT_HEAVEN.imageWidth}
      height={ROLLOUT_HEAVEN.imageHeight}
      className="h-auto w-full"
      sizes="(min-width: 768px) 720px, 100vw"
    />
  );

  return (
    <article className="overflow-hidden border border-hero-gray bg-hero-dark">
      <div className="border-b border-hero-surface">
        <a href={ROLLOUT_HEAVEN.watchUrl} target="_blank" rel="noopener noreferrer" className="block">
          {image}
        </a>
      </div>
      <div className="p-6">
        <p className="section-label mb-2">The Line</p>
        <h3 className="mb-3 text-2xl font-black uppercase tracking-tight text-white">
          {ROLLOUT_HEAVEN.show}
        </h3>
        <p className="text-sm text-hero-light">
          This is where Hero reviews music live. Drop your song in The Line to claim your
          spot. We&apos;ll email you the moment it&apos;s about to play, so you can come back
          and watch your review happen live.
        </p>
        <p className="mt-3 text-sm font-bold uppercase tracking-wider text-white">
          {ROLLOUT_HEAVEN.when}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-hero-light">
          {ROLLOUT_HEAVEN.tiers.map((tier) => (
            <li key={tier.name}>
              <span className="text-hero-muted">{tier.group} · </span>
              <span className="font-bold text-white">{tier.name}</span>
              <span className="text-hero-accent"> {tier.price}</span>
              <span> — {tier.detail}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-hero-muted">
          Standard is a 1-min spin. Paid tiers play the full track and get longer feedback.
          Feedback can be critical, and no outcome is promised. No refund if your song is
          skipped. Positive and clean music only.
        </p>
        <a
          href={ROLLOUT_HEAVEN.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-accent mt-5"
        >
          Get reviewed live
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </article>
  );
}
