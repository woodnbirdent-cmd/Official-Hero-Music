"use client";

import { useActionState } from "react";
import { submitJoin, type FormState } from "@/actions/forms";
import FormSuccess from "./FormSuccess";

const initial: FormState = { ok: false, message: "" };

export default function JoinForm() {
  const [state, action, pending] = useActionState(submitJoin, initial);

  if (state.ok) {
    return (
      <FormSuccess
        title="You're in"
        message={state.message}
        backHref="/music"
        backLabel="Stream the music"
      />
    );
  }

  return (
    <form action={action} className="card-surface space-y-4">
      <div>
        <label htmlFor="join-name" className="mb-2 block text-xs font-bold uppercase tracking-wider">
          Name
        </label>
        <input id="join-name" name="name" required className="input-field" autoComplete="name" />
      </div>
      <div>
        <label htmlFor="join-email" className="mb-2 block text-xs font-bold uppercase tracking-wider">
          Email
        </label>
        <input
          id="join-email"
          name="email"
          type="email"
          required
          className="input-field"
          autoComplete="email"
        />
      </div>
      {state.error && (
        <p className="text-sm text-hero-accent" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
        {pending ? "Submitting…" : "Join the list"}
      </button>
    </form>
  );
}
