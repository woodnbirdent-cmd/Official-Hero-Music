import Image from "next/image";
import { ROLLOUT_HEAVEN } from "@/lib/constants";

export default function RolloutHeavenCard() {
  const image = (
    <Image
      src={ROLLOUT_HEAVEN.image}
      alt={ROLLOUT_HEAVEN.imageAlt}
      width={1600}
      height={900}
      className="h-auto w-full object-cover"
      sizes="(min-width: 768px) 720px, 100vw"
    />
  );

  return (
    <article className="overflow-hidden border border-hero-gray bg-hero-dark">
      <div className="border-b border-hero-surface">
        {ROLLOUT_HEAVEN.watchUrl ? (
          <a href={ROLLOUT_HEAVEN.watchUrl} target="_blank" rel="noopener noreferrer">
            {image}
          </a>
        ) : (
          image
        )}
      </div>
      <div className="p-6">
        <p className="section-label mb-2">Live stream</p>
        <h3 className="mb-3 text-2xl font-black uppercase tracking-tight text-white">
          {ROLLOUT_HEAVEN.show}
        </h3>
        <p className="text-sm text-hero-light">
          #Hero&apos;s live-stream review show.
        </p>
        {ROLLOUT_HEAVEN.watchUrl ? (
          <a
            href={ROLLOUT_HEAVEN.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent mt-5"
          >
            Watch the show
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <p className="mt-4 text-sm text-hero-accent">
            Watch link coming soon. Still needed: the URL where the show streams, and a screenshot
            to replace this placeholder image.
          </p>
        )}
      </div>
    </article>
  );
}
