import type { Metadata } from "next";
import JoinForm from "@/components/JoinForm";

export const metadata: Metadata = {
  title: "Join",
  description: "Join the official #Hero mailing list.",
};

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="section-label mb-3">Mailing list</p>
      <h1 className="graffiti-heading mb-4">Join</h1>
      <p className="mb-8 text-hero-light">
        Get new music, show dates, and community updates. No spam — just the real drops.
      </p>
      <JoinForm />
    </div>
  );
}
