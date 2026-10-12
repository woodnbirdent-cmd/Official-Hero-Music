"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/merch/CartProvider";
import { formatMoney, MAX_QUANTITY, type MerchProduct, type MerchView } from "@/lib/merch";

export default function ProductDetail({ product }: { product: MerchProduct }) {
  const { addItem } = useCart();
  const [view, setView] = useState<MerchView>("front");
  const [size, setSize] = useState(product.sizes.length === 1 ? product.sizes[0] : "");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");

  function addToCart() {
    if (!size) {
      setNotice("Choose a size.");
      return;
    }
    addItem(product.slug, size, quantity);
    setNotice("Added to cart.");
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-2">
      <div>
        <div className="border border-hero-gray bg-black">
          <Image
            src={product.images[view]}
            alt={`${product.name}, ${view}`}
            width={1200}
            height={1200}
            priority
            className="h-auto w-full"
            sizes="(min-width: 1024px) 36rem, 100vw"
          />
        </div>
        <div className="mt-3 flex gap-2" role="group" aria-label="Product photos">
          {(["front", "back"] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-pressed={view === side}
              onClick={() => setView(side)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${
                view === side
                  ? "bg-hero-accent text-black"
                  : "border border-hero-gray text-white hover:border-hero-accent"
              }`}
            >
              {side}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="section-label mb-3">
          <Link href="/merch" className="hover:text-hero-accent">
            Merch
          </Link>
        </p>
        <h1 className="graffiti-heading mb-3 text-4xl sm:text-5xl">{product.name}</h1>
        <p className="mb-6 text-2xl font-black text-white">{formatMoney(product.priceCents)}</p>
        <ul className="mb-8 space-y-2 text-sm text-hero-light">
          {product.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>

        <fieldset className="mb-6">
          <legend className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-hero-muted">
            Size
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
            {product.sizes.map((option) => {
              const selected = size === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setSize(option);
                    setNotice("");
                  }}
                  className={`min-w-12 px-4 py-2 text-sm font-bold uppercase tracking-wider ${
                    selected
                      ? "bg-white text-black"
                      : "border border-hero-gray text-white hover:border-hero-accent"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mb-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-hero-muted">
            Quantity
          </p>
          <div className="inline-flex items-center border border-hero-gray">
            <button
              type="button"
              className="px-4 py-2 text-lg text-white hover:text-hero-accent"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="min-w-8 text-center text-sm font-bold" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              className="px-4 py-2 text-lg text-white hover:text-hero-accent"
              onClick={() => setQuantity((current) => Math.min(MAX_QUANTITY, current + 1))}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>

        <button type="button" className="btn-accent" onClick={addToCart}>
          Add to cart
        </button>
        {notice && (
          <p className="mt-4 text-sm text-hero-light" role="status">
            {notice}{" "}
            {notice === "Added to cart." && (
              <Link href="/merch/cart" className="font-bold text-hero-accent underline">
                View cart
              </Link>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
