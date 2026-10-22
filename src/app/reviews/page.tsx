import type { Metadata } from "next";
import RolloutHeavenCard from "@/components/RolloutHeavenCard";
import { REVIEW_HEADLINE, REVIEW_SUBLINE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Music Reviews",
  description: REVIEW_SUBLINE,
};

export default function ReviewsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="section-label mb-3">Live</p>
      <h1 className="graffiti-heading mb-4">{REVIEW_HEADLINE}</h1>
      <p className="mb-8 max-w-xl text-hero-light">{REVIEW_SUBLINE}</p>
      <RolloutHeavenCard />
    </div>
  );
}
