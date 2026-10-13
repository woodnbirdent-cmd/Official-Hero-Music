"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/merch/CartProvider";
import { formatMoney, getProduct, MAX_QUANTITY } from "@/lib/merch";
import { US_STATES } from "@/lib/us-states";

type AddressForm = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

const emptyAddress: AddressForm = {
  name: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
};

export default function CartView() {
  const { lines, ready, setQuantity, removeItem } = useCart();
  const [step, setStep] = useState<"items" | "address">("items");
  const [address, setAddress] = useState<AddressForm>(emptyAddress);
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

  if (priced.length === 0 && step === "address") {
    setStep("items");
  }

  function setField(field: keyof AddressForm, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
  }

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
          shipping: {
            name: address.name.trim(),
            line1: address.line1.trim(),
            line2: address.line2.trim(),
            city: address.city.trim(),
            state: address.state,
            postalCode: address.postalCode.trim(),
          },
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
      ) : step === "items" ? (
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

          <Totals subtotalCents={subtotalCents} />
          <p className="text-xs uppercase tracking-wider text-hero-muted">
            Ships to US addresses only.
          </p>
          <button type="button" className="btn-accent" onClick={() => setStep("address")}>
            Continue to shipping
          </button>
        </div>
      ) : (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void checkout();
          }}
        >
          <div className="space-y-2 text-sm text-hero-light">
            {priced.map(({ line, product }) => (
              <div key={`${line.slug}:${line.size}`} className="flex justify-between gap-4">
                <span>
                  {product.name} · Size {line.size} · Qty {line.quantity}
                </span>
                <span>{formatMoney(product.priceCents * line.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="card-surface space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-hero-muted">
              Shipping address
            </h2>
            <p className="text-sm text-hero-light">
              US addresses only. You&apos;ll pick a shipping speed in checkout.
            </p>
            <div>
              <label htmlFor="ship-name" className="mb-2 block text-xs font-bold uppercase tracking-wider">
                Full name
              </label>
              <input
                id="ship-name"
                required
                maxLength={80}
                autoComplete="shipping name"
                className="input-field"
                value={address.name}
                onChange={(event) => setField("name", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="ship-line1" className="mb-2 block text-xs font-bold uppercase tracking-wider">
                Street address
              </label>
              <input
                id="ship-line1"
                required
                maxLength={100}
                autoComplete="shipping address-line1"
                className="input-field"
                value={address.line1}
                onChange={(event) => setField("line1", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="ship-line2" className="mb-2 block text-xs font-bold uppercase tracking-wider">
                Apartment, suite <span className="font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <input
                id="ship-line2"
                maxLength={100}
                autoComplete="shipping address-line2"
                className="input-field"
                value={address.line2}
                onChange={(event) => setField("line2", event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="ship-city" className="mb-2 block text-xs font-bold uppercase tracking-wider">
                  City
                </label>
                <input
                  id="ship-city"
                  required
                  maxLength={50}
                  autoComplete="shipping address-level2"
                  className="input-field"
                  value={address.city}
                  onChange={(event) => setField("city", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ship-state" className="mb-2 block text-xs font-bold uppercase tracking-wider">
                  State
                </label>
                <select
                  id="ship-state"
                  required
                  autoComplete="shipping address-level1"
                  className="input-field"
                  value={address.state}
                  onChange={(event) => setField("state", event.target.value)}
                >
                  <option value="">State</option>
                  {US_STATES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ship-zip" className="mb-2 block text-xs font-bold uppercase tracking-wider">
                  ZIP code
                </label>
                <input
                  id="ship-zip"
                  required
                  inputMode="numeric"
                  autoComplete="shipping postal-code"
                  pattern="[0-9]{5}(-[0-9]{4})?"
                  maxLength={10}
                  title="5-digit ZIP code"
                  className="input-field"
                  value={address.postalCode}
                  onChange={(event) => setField("postalCode", event.target.value)}
                />
              </div>
            </div>
          </div>

          <Totals subtotalCents={subtotalCents} />

          {error && (
            <p className="text-sm text-hero-accent" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setError("");
                setStep("items");
              }}
              disabled={pending}
            >
              Back to cart
            </button>
            <button type="submit" className="btn-accent" disabled={pending}>
              {pending ? "Starting checkout…" : "Checkout"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Totals({ subtotalCents }: { subtotalCents: number }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between text-hero-light">
        <dt>Subtotal</dt>
        <dd>{formatMoney(subtotalCents)}</dd>
      </div>
      <div className="flex justify-between text-hero-light">
        <dt>Shipping</dt>
        <dd>Calculated at checkout</dd>
      </div>
    </dl>
  );
}
