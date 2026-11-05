"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateAdminPassword } from "@/app/admin/password/actions";

export default function AdminPasswordForm({ mode }: { mode: "set" | "change" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setMessage("");
    setPending(true);
    try {
      const result = await updateAdminPassword(new FormData(form));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.reset();
      setMessage(result.message);
      router.refresh();
    } catch {
      setError("Could not update the password.");
    } finally {
      setPending(false);
    }
  }

  const heading = mode === "change" ? "Change password" : "Set password";

  return (
    <form onSubmit={onSubmit} className="card-surface space-y-4">
      {mode === "change" && (
        <label className="block" htmlFor="admin-current-password">
          <span className="section-label mb-2 block">Current password</span>
          <input
            id="admin-current-password"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={128}
            className="input-field"
          />
        </label>
      )}
      <label className="block" htmlFor="admin-new-password">
        <span className="section-label mb-2 block">New password</span>
        <input
          id="admin-new-password"
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          minLength={12}
          maxLength={128}
          className="input-field"
        />
      </label>
      <label className="block" htmlFor="admin-confirm-password">
        <span className="section-label mb-2 block">Confirm new password</span>
        <input
          id="admin-confirm-password"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          minLength={12}
          maxLength={128}
          className="input-field"
        />
      </label>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Saving…" : heading}
      </button>
      {message && (
        <p className="text-sm text-hero-light" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-hero-accent" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
