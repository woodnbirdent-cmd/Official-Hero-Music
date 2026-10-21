import type { Metadata } from "next";
import RolloutHeavenCard from "@/components/RolloutHeavenCard";

export const metadata: Metadata = {
  title: "Music Reviews",
  description: "Hero reviews tracks live on stream, with real fans in the chat. Join The Line.",
};

export default function ReviewsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="section-label mb-3">Live</p>
      <h1 className="graffiti-heading mb-4">Get reviewed live</h1>
      <p className="mb-8 max-w-xl text-hero-light">
        Hero reviews tracks on stream, with real fans in the chat.
      </p>
      <RolloutHeavenCard intro={false} />
    </div>
  );
}
