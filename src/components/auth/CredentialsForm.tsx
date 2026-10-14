"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { TIER_DETAILS, type Tier } from "@/lib/tiers";

type Props = {
  mode: "sign-in" | "sign-up";
  nextPath: string;
  tier?: Tier;
};

export default function CredentialsForm({ mode, nextPath, tier = "free" }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        if (result.error) {
          setError(result.error.message || "Could not create the account.");
          return;
        }
        if (tier === "supporter" || tier === "vip") {
          const response = await fetch("/api/membership/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tier }),
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
            setError(`${message} Your free account is ready.`);
            return;
          }
          window.location.assign(url);
          return;
        }
        router.push("/members");
        router.refresh();
        return;
      }

      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (result.error) {
        setError(result.error.message || "Could not sign in.");
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setError(mode === "sign-up" ? "Could not create the account." : "Could not sign in.");
    } finally {
      setPending(false);
    }
  }

  const paid = tier === "supporter" || tier === "vip";

  return (
    <form onSubmit={onSubmit} className="card-surface space-y-4">
      {mode === "sign-up" && paid && (
        <p className="text-sm text-hero-light">
          Create your account, then checkout for {TIER_DETAILS[tier].name} ({TIER_DETAILS[tier].priceLabel}
          {TIER_DETAILS[tier].period}).
        </p>
      )}
      {mode === "sign-up" && (
        <div>
          <label htmlFor="auth-name" className="mb-2 block text-xs font-bold uppercase tracking-wider">
            Name
          </label>
          <input
            id="auth-name"
            required
            autoComplete="name"
            className="input-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      )}
      <div>
        <label htmlFor="auth-email" className="mb-2 block text-xs font-bold uppercase tracking-wider">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          required
          autoComplete="email"
          className="input-field"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="auth-password" className="mb-2 block text-xs font-bold uppercase tracking-wider">
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          className="input-field"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error && (
        <p className="text-sm text-hero-accent" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Working…" : mode === "sign-up" ? "Create account" : "Sign in"}
      </button>
      <p className="text-sm text-hero-muted">
        {mode === "sign-up" ? (
          <>
            Already have an account?{" "}
            <Link href={`/sign-in?next=${encodeURIComponent(nextPath)}`} className="text-white underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/sign-up" className="text-white underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
