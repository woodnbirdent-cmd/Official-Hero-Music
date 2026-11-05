"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendAdminMagicLink, signInAdmin } from "@/app/admin/sign-in/actions";
import { GENERIC_LINK_MESSAGE, GENERIC_SIGN_IN_ERROR } from "@/lib/admin-security";

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
  const [sent, setSent] = useState("");
  const [pending, setPending] = useState<"link" | "password" | null>(null);

  async function onMagicLink() {
    setError("");
    setSent("");
    if (!email.trim()) {
      setError("Enter an email address.");
      return;
    }
    setPending("link");
    try {
      const result = await sendAdminMagicLink(email);
      setSent(result.ok ? result.message || GENERIC_LINK_MESSAGE : GENERIC_LINK_MESSAGE);
    } catch {
      setSent(GENERIC_LINK_MESSAGE);
    } finally {
      setPending(null);
    }
  }

  async function onPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSent("");
    setPending("password");
    try {
      const result = await signInAdmin(email, password);
      if (!result.ok) {
        setError(GENERIC_SIGN_IN_ERROR);
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setError(GENERIC_SIGN_IN_ERROR);
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
          {sent && <p className="text-sm text-hero-light">{sent}</p>}
        </div>
      ) : (
        <p className="text-sm text-hero-light">
          Email sign-in links need <span className="text-white">RESEND_API_KEY</span> and{" "}
          <span className="text-white">ADMIN_EMAIL_FROM</span>. Until those are set, use the password on an admin account that already exists.
        </p>
      )}

      <div className="space-y-4 border-t border-hero-gray pt-6">
        <p className="text-sm text-hero-muted">
          A password is optional. If you set one after signing in, use it here. Email links still work without one.
        </p>
        <label className="block">
          <span className="section-label mb-2 block">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            minLength={8}
            maxLength={128}
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
