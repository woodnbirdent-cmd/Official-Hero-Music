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
        <p className="section-label mb-2">Live stream</p>
        <h3 className="mb-3 text-2xl font-black uppercase tracking-tight text-white">
          {ROLLOUT_HEAVEN.show}
        </h3>
        <p className="text-sm text-hero-light">
          #Hero&apos;s live-stream review show.
        </p>
        <a
          href={ROLLOUT_HEAVEN.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-accent mt-5"
        >
          Watch the show
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </article>
  );
}
