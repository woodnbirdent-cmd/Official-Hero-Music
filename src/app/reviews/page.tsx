import type { Metadata } from "next";
import RolloutHeavenCard from "@/components/RolloutHeavenCard";
import { ROLLOUT_HEAVEN } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Music Reviews",
  description: `This is where Hero reviews music live. Drop your song in The Line. ${ROLLOUT_HEAVEN.when}.`,
};

export default function ReviewsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="section-label mb-3">The Line</p>
      <h1 className="graffiti-heading mb-4">Music Reviews</h1>
      <p className="mb-8 text-hero-light">
        Drop your song in The Line. Christian and secular submissions are welcome as long
        as the music is positive and clean.
      </p>
      <RolloutHeavenCard />
    </div>
  );
}
