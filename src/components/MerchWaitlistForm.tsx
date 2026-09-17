"use client";

import { useActionState } from "react";
import { submitMerchWaitlist, type FormState } from "@/actions/forms";
import FormSuccess from "./FormSuccess";

const initial: FormState = { ok: false, message: "" };

export default function MerchWaitlistForm() {
  const [state, action, pending] = useActionState(submitMerchWaitlist, initial);

  if (state.ok) {
    return (
      <FormSuccess
        title="You're on the list"
        message={state.message}
        backHref="/music"
        backLabel="Listen while you wait"
      />
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row">
      <input
        name="email"
        type="email"
        required
        placeholder="Email for merch drops"
        className="input-field flex-1"
        aria-label="Email"
      />
      <button type="submit" className="btn-primary shrink-0" disabled={pending}>
        {pending ? "…" : "Notify me"}
      </button>
      {state.error && (
        <p className="w-full text-sm text-hero-accent" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
