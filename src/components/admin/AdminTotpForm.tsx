"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { verifyAdminBackupCode, verifyAdminTotp } from "@/app/admin/sign-in/totp-actions";

export default function AdminTotpForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"code" | "backup" | null>(null);

  async function onCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending("code");
    try {
      const result = await verifyAdminTotp(code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("That code was not accepted.");
    } finally {
      setPending(null);
    }
  }

  async function onBackup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending("backup");
    try {
      const result = await verifyAdminBackupCode(backup);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("That code was not accepted.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onCode} className="space-y-4">
        <label className="block">
          <span className="section-label mb-2 block">Authenticator code</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="input-field"
          />
        </label>
        <button type="submit" className="btn-primary w-full" disabled={pending !== null}>
          {pending === "code" ? "Checking…" : "Continue"}
        </button>
      </form>
      <form onSubmit={onBackup} className="space-y-4 border-t border-hero-gray pt-6">
        <label className="block">
          <span className="section-label mb-2 block">Backup code</span>
          <input
            autoComplete="off"
            required
            value={backup}
            onChange={(event) => setBackup(event.target.value)}
            className="input-field"
          />
        </label>
        <button type="submit" className="btn-ghost w-full" disabled={pending !== null}>
          {pending === "backup" ? "Checking…" : "Use a backup code"}
        </button>
      </form>
      {error && <p className="text-sm text-hero-accent">{error}</p>}
    </div>
  );
}
