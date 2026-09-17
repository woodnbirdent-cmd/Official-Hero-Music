import Image from "next/image";
import Link from "next/link";
import SocialIcons from "@/components/SocialIcons";
import { BIO, SITE, SPOTIFY_ARTIST_ID, YOUTUBE_VIDEOS } from "@/lib/constants";

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-hero-surface">
        <div className="grit absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="section-label mb-4">Official fan hub · Yahfamilia</p>
            <Image
              src="/logo-hero.png"
              alt="#Hero"
              width={420}
              height={160}
              className="mb-6 h-auto w-full max-w-md"
              priority
            />
            <p className="mb-2 text-xl font-bold uppercase tracking-wide text-white sm:text-2xl">
              {SITE.tagline}
            </p>
            <p className="mb-8 max-w-lg text-hero-light">
              Christian hip-hop from {SITE.location}. Real testimony. Unyielding faith.
              No compromise.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/music" className="btn-primary">
                Latest drops
              </Link>
              <Link href="/join" className="btn-ghost">
                Join the list
              </Link>
              <Link href="/support" className="btn-accent">
                Support
              </Link>
            </div>
          </div>
          <div className="relative">
            <Image
              src="/photo-1.jpg"
              alt="#Hero artist photo"
              width={800}
              height={1000}
              className="h-auto w-full border border-hero-surface object-cover grayscale"
              priority
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="section-label mb-3">About</p>
        <h1 className="graffiti-heading mb-6">The story</h1>
        <div className="grid gap-10 md:grid-cols-3">
          <p className="md:col-span-2 text-base leading-relaxed text-hero-light sm:text-lg">
            {BIO}
          </p>
          <div className="space-y-4">
            <Image
              src="/photo-2.jpg"
              alt="#Hero"
              width={600}
              height={700}
              className="w-full border border-hero-surface object-cover grayscale"
            />
            <SocialIcons />
          </div>
        </div>
      </section>

      <section className="border-y border-hero-surface bg-hero-dark">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-label mb-2">Listen</p>
              <h2 className="text-3xl font-black uppercase tracking-tight">On Spotify</h2>
            </div>
            <Link href="/music" className="btn-ghost">
              All platforms
            </Link>
          </div>
          <iframe
            title="#Hero on Spotify"
            src={`https://open.spotify.com/embed/artist/${SPOTIFY_ARTIST_ID}?utm_source=generator&theme=0`}
            width="100%"
            height="352"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="border-0"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-label mb-2">Watch</p>
            <h2 className="text-3xl font-black uppercase tracking-tight">Videos</h2>
          </div>
          <Link href="/videos" className="btn-ghost">
            More videos
          </Link>
        </div>
        <div className="aspect-video w-full overflow-hidden border border-hero-surface">
          <iframe
            title={YOUTUBE_VIDEOS[0].title}
            src={`https://www.youtube.com/embed/${YOUTUBE_VIDEOS[0].id}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      </section>

      <section className="border-t border-hero-surface bg-black">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="section-label mb-2">Stay locked in</p>
            <h2 className="text-3xl font-black uppercase">Join the mailing list</h2>
            <p className="mt-2 max-w-md text-hero-muted">
              New music, shows, and community — straight from the source.
            </p>
          </div>
          <Link href="/join" className="btn-primary">
            Join now
          </Link>
        </div>
      </section>
    </>
  );
}
