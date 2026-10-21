import Image from "next/image";
import { ROLLOUT_HEAVEN } from "@/lib/constants";

const BENEFITS = [
  "Honest feedback",
  "Your song in front of his audience, live",
  "A shot at the playlist",
] as const;

export default function RolloutHeavenCard({ intro = true }: { intro?: boolean }) {
  return (
    <article className="overflow-hidden border border-hero-gray bg-hero-dark">
      <div className="border-b border-hero-surface">
        <a href={ROLLOUT_HEAVEN.watchUrl} target="_blank" rel="noopener noreferrer" className="block">
          <Image
            src={ROLLOUT_HEAVEN.image}
            alt={ROLLOUT_HEAVEN.imageAlt}
            width={ROLLOUT_HEAVEN.imageWidth}
            height={ROLLOUT_HEAVEN.imageHeight}
            className="h-auto w-full"
            sizes="(min-width: 768px) 720px, 100vw"
          />
        </a>
      </div>
      <div className="p-6">
        {intro && (
          <>
            <h3 className="mb-3 text-2xl font-black uppercase tracking-tight text-white">
              Get reviewed live
            </h3>
            <p className="text-sm text-hero-light">
              Hero reviews tracks on stream, with real fans in the chat.
            </p>
          </>
        )}
        <ul className={`space-y-2 text-sm text-white ${intro ? "mt-4" : ""}`}>
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex gap-2">
              <span className="text-hero-accent" aria-hidden="true">
                ▸
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
        <a
          href={ROLLOUT_HEAVEN.watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-accent mt-5"
        >
          Join The Line
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </article>
  );
}
