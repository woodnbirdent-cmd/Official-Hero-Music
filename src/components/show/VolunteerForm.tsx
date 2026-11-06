"use client";

import { useState, type FormEvent } from "react";
import { VOLUNTEER_ROLES, VOLUNTEER_SHIFTS } from "@/lib/show-config";

export default function VolunteerForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/show/volunteer", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const data: unknown = await response.json();
      const message =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Could not save that sign-up.";
      if (!response.ok) {
        setError(message);
        return;
      }
      setDone(true);
    } catch {
      setError("Could not save that sign-up.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className="border border-white px-4 py-4 text-hero-light" role="status">
        You&apos;re on the volunteer list. A short confirmation is on its way by email.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card-surface relative space-y-4">
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Company website
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error && (
        <p className="text-sm text-hero-accent" role="alert">
          {error}
        </p>
      )}
      <label className="block text-sm">
        <span className="section-label mb-2 block">Name</span>
        <input className="input-field" name="name" autoComplete="name" required />
      </label>
      <label className="block text-sm">
        <span className="section-label mb-2 block">Email</span>
        <input className="input-field" type="email" name="email" autoComplete="email" required />
      </label>
      <label className="block text-sm">
        <span className="section-label mb-2 block">Phone</span>
        <input className="input-field" type="tel" name="phone" autoComplete="tel" required />
      </label>
      <fieldset className="space-y-2">
        <legend className="section-label mb-2">Availability</legend>
        <p className="text-sm text-hero-light">
          Local churches are gathering a few hours before the show to do community outreach with people
          experiencing homelessness and others who need it. If you are only joining that, leave the show-day
          shifts unchecked.
        </p>
        {VOLUNTEER_SHIFTS.map((shift) => (
          <label key={shift.id} className="flex items-center gap-3 text-sm text-hero-light">
            <input type="checkbox" name="availability" value={shift.id} />
            {shift.label}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="section-label mb-2">Role interest</legend>
        {VOLUNTEER_ROLES.map((role) => (
          <label key={role.id} className="flex items-center gap-3 text-sm text-hero-light">
            <input type="checkbox" name="role" value={role.id} />
            {role.label}
          </label>
        ))}
        <label className="block text-sm">
          <span className="mb-2 block text-hero-muted">Other</span>
          <input className="input-field" name="roleOther" maxLength={120} />
        </label>
      </fieldset>
      <label className="block text-sm">
        <span className="section-label mb-2 block">Notes, optional</span>
        <textarea className="input-field min-h-28" name="notes" maxLength={1000} />
      </label>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "…" : "Sign up to volunteer"}
      </button>
    </form>
  );
}
