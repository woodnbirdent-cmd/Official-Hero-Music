"use client";

// Kept for when ticket sales open. The public show page does not mount this.

import { useState } from "react";
import { SHIRT_SIZES, TICKET_MAX_QUANTITY, TICKET_TIERS, formatDollars } from "@/lib/show-config";
import { describePerks } from "@/lib/show-codes";
import type { TicketAvailability } from "@/lib/show-types";

function availabilityMessage(state: TicketAvailability["state"]): string | null {
  if (state === "sold-out") return "Sold out.";
  if (state === "reserved-out") {
    return "No tickets left to reserve right now. Unfinished checkouts can release tickets.";
  }
  if (state === "closed") return "Ticket capacity is not set yet, so checkout is closed.";
  if (state === "unavailable") return "Ticket checkout is not available right now.";
  return null;
}

export default function TicketPurchase({ availability }: { availability: TicketAvailability }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");
  const closed = availability.state !== "open";
  const message = availabilityMessage(availability.state);
  const maxQuantity =
    availability.state === "open"
      ? Math.max(1, Math.min(TICKET_MAX_QUANTITY, availability.remaining ?? 1))
      : 1;

  async function checkout(tierId: string) {
    setError("");
    setPendingId(tierId);
    try {
      const response = await fetch("/api/show/tickets/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId,
          quantity: quantities[tierId] ?? 1,
          shirtSize: sizes[tierId] ?? "",
          name,
          email,
        }),
      });
      const data: unknown = await response.json();
      const url = data && typeof data === "object" && "url" in data && typeof data.url === "string" ? data.url : "";
      const messageText =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Could not start checkout.";
      if (!response.ok || !url.startsWith("https://")) {
        setError(messageText);
        return;
      }
      window.location.assign(url);
    } catch {
      setError("Could not start checkout.");
    } finally {
      setPendingId("");
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <p className="border border-hero-accent px-4 py-3 text-sm text-hero-accent" role="status">
          {message}
        </p>
      )}
      {availability.state === "open" && availability.remaining != null && (
        <p className="text-sm text-hero-light">
          {availability.remaining} {availability.remaining === 1 ? "ticket" : "tickets"} left.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="section-label mb-2 block">Name</span>
          <input className="input-field" value={name} autoComplete="name" onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="section-label mb-2 block">Email</span>
          <input
            className="input-field"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
      </div>
      {error && (
        <p className="text-sm text-hero-accent" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-4">
        {TICKET_TIERS.map((tier) => {
          const quantity = quantities[tier.id] ?? 1;
          const perks = describePerks(tier.perks);
          return (
            <article key={tier.id} data-tier={tier.id} className="card-surface">
              <p className="text-2xl font-black text-white">{formatDollars(tier.priceCents)}</p>
              <h3 className="mt-1 text-lg font-bold uppercase tracking-wide text-hero-accent">{tier.name}</h3>
              <p className="mt-3 text-sm text-hero-light">{tier.summary}</p>
              {perks.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-white">
                  {perks.map((perk) => (
                    <li key={perk}>{perk}</li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="block text-sm">
                  <span className="section-label mb-2 block">Quantity</span>
                  <select
                    className="input-field"
                    value={quantity}
                    disabled={closed}
                    onChange={(event) =>
                      setQuantities((current) => ({ ...current, [tier.id]: Number(event.target.value) }))
                    }
                  >
                    {Array.from({ length: maxQuantity }, (_, index) => index + 1).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                {tier.collectShirtSize && (
                  <label className="block min-w-36 text-sm">
                    <span className="section-label mb-2 block">Shirt size</span>
                    <select
                      className="input-field"
                      value={sizes[tier.id] ?? ""}
                      disabled={closed}
                      onChange={(event) => setSizes((current) => ({ ...current, [tier.id]: event.target.value }))}
                    >
                      <option value="">Choose</option>
                      {SHIRT_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  disabled={closed || pendingId !== ""}
                  onClick={() => void checkout(tier.id)}
                >
                  {pendingId === tier.id ? "…" : "Checkout"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
