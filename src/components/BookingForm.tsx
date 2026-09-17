"use client";

import { useActionState } from "react";
import { submitBooking, type FormState } from "@/actions/forms";
import FormSuccess from "./FormSuccess";

const initial: FormState = { ok: false, message: "" };

export default function BookingForm() {
  const [state, action, pending] = useActionState(submitBooking, initial);

  if (state.ok) {
    return (
      <FormSuccess
        title="Request sent"
        message={state.message}
        backHref="/"
        backLabel="Back home"
      />
    );
  }

  return (
    <form action={action} className="card-surface space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="book-name" className="mb-2 block text-xs font-bold uppercase tracking-wider">
            Name
          </label>
          <input id="book-name" name="name" required className="input-field" />
        </div>
        <div>
          <label htmlFor="book-email" className="mb-2 block text-xs font-bold uppercase tracking-wider">
            Email
          </label>
          <input id="book-email" name="email" type="email" required className="input-field" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="book-org" className="mb-2 block text-xs font-bold uppercase tracking-wider">
            Organization / Venue
          </label>
          <input id="book-org" name="org" className="input-field" />
        </div>
        <div>
          <label htmlFor="book-date" className="mb-2 block text-xs font-bold uppercase tracking-wider">
            Event date
          </label>
          <input id="book-date" name="date" type="date" className="input-field" />
        </div>
      </div>
      <div>
        <label htmlFor="book-message" className="mb-2 block text-xs font-bold uppercase tracking-wider">
          Details
        </label>
        <textarea
          id="book-message"
          name="message"
          required
          rows={5}
          className="input-field"
          placeholder="Event type, city, capacity, budget range…"
        />
      </div>
      {state.error && (
        <p className="text-sm text-hero-accent" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Sending…" : "Send booking request"}
      </button>
    </form>
  );
}
