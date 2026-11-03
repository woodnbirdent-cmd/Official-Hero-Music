"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminEmailAllowed, sendAdminMagicLink } from "@/app/admin/sign-in/actions";
import { authClient } from "@/lib/auth-client";

export default function AdminSignInForm({
  nextPath,
  magicLinkConfigured,
}: {
  nextPath: string;
  magicLinkConfigured: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState<"link" | "password" | null>(null);

  async function onMagicLink() {
    setError("");
    setSent(false);
    if (!email.trim()) {
      setError("Enter the admin email.");
      return;
    }
    setPending("link");
    try {
      const result = await sendAdminMagicLink(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    } catch {
      setError("Could not send the sign-in email.");
    } finally {
      setPending(null);
    }
  }

  async function onPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSent(false);
    setPending("password");
    try {
      const allowed = await adminEmailAllowed(email);
      if (!allowed.ok) {
        setError(allowed.error);
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
      setError("Could not sign in.");
    } finally {
      setPending(null);
    }
  }

  return (
    <form onSubmit={onPassword} className="space-y-6">
      <label className="block">
        <span className="section-label mb-2 block">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="input-field"
        />
      </label>

      {magicLinkConfigured ? (
        <div className="space-y-3">
          <button type="button" className="btn-primary w-full" disabled={pending !== null} onClick={() => void onMagicLink()}>
            {pending === "link" ? "Sending…" : "Email me a sign-in link"}
          </button>
          {sent && <p className="text-sm text-hero-light">Check that inbox for a sign-in link. It expires in 5 minutes.</p>}
        </div>
      ) : (
        <p className="text-sm text-hero-light">
          Email sign-in links need <span className="text-white">RESEND_API_KEY</span> and{" "}
          <span className="text-white">ADMIN_EMAIL_FROM</span>. Until those are set, use the password on an admin account that already exists.
        </p>
      )}

      <div className="space-y-4 border-t border-hero-gray pt-6">
        <label className="block">
          <span className="section-label mb-2 block">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input-field"
          />
        </label>
        <button type="submit" className="btn-ghost w-full" disabled={pending !== null}>
          {pending === "password" ? "Signing in…" : "Sign in with password"}
        </button>
      </div>
      {error && <p className="text-sm text-hero-accent">{error}</p>}
    </form>
  );
}
