import type { Metadata } from "next";
import RolloutHeavenCard from "@/components/RolloutHeavenCard";
import { ROLLOUT_HEAVEN } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Music Reviews",
  description: `Watch #Hero's live-stream review show, ${ROLLOUT_HEAVEN.show}.`,
};

export default function ReviewsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="section-label mb-3">Watch</p>
      <h1 className="graffiti-heading mb-4">Music Reviews</h1>
      <p className="mb-8 text-hero-light">
        {ROLLOUT_HEAVEN.show} is #Hero&apos;s live-stream review show.
      </p>
      <RolloutHeavenCard />
    </div>
  );
}
