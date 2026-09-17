"use client";

import { useActionState } from "react";
import { submitPrayer, type FormState } from "@/actions/forms";
import FormSuccess from "./FormSuccess";

const initial: FormState = { ok: false, message: "" };

export default function PrayerForm() {
  const [state, action, pending] = useActionState(submitPrayer, initial);

  if (state.ok) {
    return (
      <FormSuccess
        title="Received"
        message={state.message}
        backHref="/community"
        backLabel="Stay in community"
      />
    );
  }

  return (
    <form action={action} className="card-surface space-y-4">
      <div>
        <label htmlFor="prayer-name" className="mb-2 block text-xs font-bold uppercase tracking-wider">
          Name (optional)
        </label>
        <input id="prayer-name" name="name" className="input-field" placeholder="Anonymous OK" />
      </div>
      <div>
        <label htmlFor="prayer-request" className="mb-2 block text-xs font-bold uppercase tracking-wider">
          Prayer request
        </label>
        <textarea id="prayer-request" name="request" required rows={5} className="input-field" />
      </div>
      {state.error && (
        <p className="text-sm text-hero-accent" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn-ghost" disabled={pending}>
        {pending ? "Sending…" : "Submit prayer request"}
      </button>
    </form>
  );
}
