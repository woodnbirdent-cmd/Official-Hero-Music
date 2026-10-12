"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/merch/CartProvider";
import { formatMoney, getProduct, MAX_QUANTITY, SHIPPING_FLAT_CENTS } from "@/lib/merch";

export default function CartView() {
  const { lines, ready, setQuantity, removeItem } = useCart();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const priced = lines.flatMap((line) => {
    const product = getProduct(line.slug);
    return product ? [{ line, product }] : [];
  });
  const subtotalCents = priced.reduce(
    (sum, item) => sum + item.product.priceCents * item.line.quantity,
    0,
  );
  const shippingCents = priced.length > 0 ? SHIPPING_FLAT_CENTS : 0;
  const totalCents = subtotalCents + shippingCents;

  async function checkout() {
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: priced.map(({ line }) => ({
            slug: line.slug,
            size: line.size,
            quantity: line.quantity,
          })),
        }),
      });
      const data: unknown = await response.json();
      const url =
        data && typeof data === "object" && "url" in data && typeof data.url === "string"
          ? data.url
          : "";
      const message =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Could not start checkout.";
      if (!response.ok || !url) {
        setError(message);
        return;
      }
      window.location.assign(url);
    } catch {
      setError("Could not start checkout.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="section-label mb-3">Shop</p>
      <h1 className="graffiti-heading mb-8">Cart</h1>

      {!ready ? (
        <p className="text-hero-muted">Loading cart…</p>
      ) : priced.length === 0 ? (
        <div className="card-surface">
          <p className="mb-6 text-hero-light">Your cart is empty.</p>
          <Link href="/merch" className="btn-accent">
            Shop merch
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <ul className="divide-y divide-hero-gray border border-hero-gray">
            {priced.map(({ line, product }) => (
              <li key={`${line.slug}:${line.size}`} className="flex gap-4 bg-hero-dark p-4">
                <Link href={`/merch/${product.slug}`} className="shrink-0">
                  <Image
                    src={product.images.front}
                    alt=""
                    width={96}
                    height={96}
                    className="h-24 w-24 object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/merch/${product.slug}`} className="font-bold text-white hover:text-hero-accent">
                    {product.name}
                  </Link>
                  <p className="mt-1 text-sm text-hero-muted">Size {line.size}</p>
                  <p className="mt-1 text-sm text-hero-light">{formatMoney(product.priceCents)}</p>
                  <div className="mt-3 flex items-center gap-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-hero-muted">
                      Qty
                      <select
                        className="ml-2 border border-hero-gray bg-black px-2 py-1 text-sm text-white"
                        value={line.quantity}
                        onChange={(event) =>
                          setQuantity(line.slug, line.size, Number(event.target.value))
                        }
                      >
                        {Array.from({ length: MAX_QUANTITY }, (_, index) => index + 1).map((qty) => (
                          <option key={qty} value={qty}>
                            {qty}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="text-xs font-bold uppercase tracking-wider text-hero-muted hover:text-white"
                      onClick={() => removeItem(line.slug, line.size)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <p className="text-sm font-bold text-white">
                  {formatMoney(product.priceCents * line.quantity)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-hero-light">
              <dt>Subtotal</dt>
              <dd>{formatMoney(subtotalCents)}</dd>
            </div>
            <div className="flex justify-between text-hero-light">
              <dt>US shipping</dt>
              <dd>{formatMoney(shippingCents)}</dd>
            </div>
            <div className="flex justify-between text-base font-bold text-white">
              <dt>Total</dt>
              <dd>{formatMoney(totalCents)}</dd>
            </div>
          </dl>
          <p className="text-xs uppercase tracking-wider text-hero-muted">
            Ships to US addresses only.
          </p>

          {error && (
            <p className="text-sm text-hero-accent" role="alert">
              {error}
            </p>
          )}

          <button type="button" className="btn-accent" onClick={checkout} disabled={pending}>
            {pending ? "Starting checkout…" : "Checkout"}
          </button>
        </div>
      )}
    </div>
  );
}
