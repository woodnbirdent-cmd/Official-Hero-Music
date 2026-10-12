import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatMoney, MERCH_PRODUCTS } from "@/lib/merch";

export const metadata: Metadata = {
  title: "Merch",
  description: "Official #Hero tees and snapback. $25 each.",
};

export default function MerchPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="section-label mb-3">Gear</p>
      <h1 className="graffiti-heading mb-10">Merch</h1>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MERCH_PRODUCTS.map((product) => (
          <li key={product.slug}>
            <Link
              href={`/merch/${product.slug}`}
              className="flex h-full flex-col border border-hero-gray bg-hero-dark"
            >
              <Image
                src={product.images.front}
                alt={`${product.name}, front`}
                width={1200}
                height={1200}
                className="aspect-square h-auto w-full object-cover"
                sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
              />
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-display text-3xl uppercase tracking-tight text-hero-accent">
                  {product.name}
                </h2>
                <p className="mt-2 flex-1 text-sm text-hero-light">{product.summary}</p>
                <p className="mt-4 text-sm font-bold uppercase tracking-wider text-white">
                  {formatMoney(product.priceCents)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-16 border border-dashed border-hero-gray p-6" aria-label="Music downloads">
        <p className="section-label mb-3">Downloads</p>
        <h2 className="section-heading mb-2 text-2xl">Music downloads</h2>
        <p className="text-sm text-hero-muted">Digital music downloads will live here.</p>
      </section>
    </div>
  );
}
