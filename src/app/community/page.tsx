import type { Metadata } from "next";
import Link from "next/link";
import PrayerForm from "@/components/PrayerForm";

export const metadata: Metadata = {
  title: "Community",
  description: "Prayer, testimony, and give-back with the #Hero community.",
};

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="section-label mb-3">Together</p>
      <h1 className="graffiti-heading mb-4">Community</h1>
      <p className="mb-12 max-w-2xl text-hero-light">
        This platform is for people who would never walk into a church — and for those
        who already know the fight. Share prayer. Give testimony. Walk in freedom.
      </p>

      <div className="mb-16 grid gap-8 md:grid-cols-3">
        <article className="card-surface">
          <p className="section-label mb-3">Give-back</p>
          <h2 className="mb-3 text-xl font-bold uppercase">Reach the streets</h2>
          <p className="text-sm text-hero-light">
            Music and ministry aimed at real life — addiction recovery, second chances,
            and uncompromised hope in Jesus.
          </p>
        </article>
        <article className="card-surface">
          <p className="section-label mb-3">Testimony</p>
          <h2 className="mb-3 text-xl font-bold uppercase">I ain&apos;t who I used to be</h2>
          <p className="text-sm text-hero-light">
            Delivered from addiction, prison, and homelessness. Husband. Father of two.
            Still refusing to compromise.
          </p>
        </article>
        <article className="card-surface">
          <p className="section-label mb-3">Support</p>
          <h2 className="mb-3 text-xl font-bold uppercase">Fuel the mission</h2>
          <p className="mb-4 text-sm text-hero-light">
            Free updates, monthly support, or Inner Circle — every tier helps keep the
            message moving.
          </p>
          <Link href="/support" className="btn-ghost text-xs">
            View tiers
          </Link>
        </article>
      </div>

      <div className="max-w-2xl">
        <p className="section-label mb-3">Prayer</p>
        <h2 className="mb-4 text-2xl font-black uppercase">Send a prayer request</h2>
        <PrayerForm />
      </div>
    </div>
  );
}
