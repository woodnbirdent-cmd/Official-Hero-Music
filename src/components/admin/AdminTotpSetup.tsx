"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { beginAdminTotp, verifyAdminTotp } from "@/app/admin/sign-in/totp-actions";

export default function AdminTotpSetup() {
  const router = useRouter();
  const [qr, setQr] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"start" | "confirm" | null>(null);

  async function start() {
    setError("");
    setPending("start");
    try {
      const result = await beginAdminTotp(password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setQr(result.qr);
      setBackupCodes(result.backupCodes);
      setSaved(false);
    } catch {
      setError("That code was not accepted.");
    } finally {
      setPending(null);
    }
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending("confirm");
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

  return (
    <div className="space-y-6">
      <p className="text-sm text-hero-light">
        Admin sign-in needs an authenticator app. Save the backup codes when they appear. They are shown only once. Leave the password blank if you signed in with an email link.
      </p>
      {!qr ? (
        <div className="space-y-4">
          <label className="block">
            <span className="section-label mb-2 block">Account password, if this email has one</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field"
            />
          </label>
          <button type="button" className="btn-primary w-full" disabled={pending !== null} onClick={() => void start()}>
            {pending === "start" ? "Preparing…" : "Create authenticator"}
          </button>
        </div>
      ) : (
        <form onSubmit={confirm} className="space-y-5">
          {/* One-time authenticator QR as a data URL. The image optimizer cannot cache it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Authenticator QR code" width={220} height={220} className="border border-hero-gray bg-white p-2" />
          <div>
            <p className="section-label mb-2">Backup codes</p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-white">
              {backupCodes.map((backup) => (
                <li key={backup}>{backup}</li>
              ))}
            </ul>
          </div>
          <label className="flex items-start gap-2 text-sm text-hero-light">
            <input type="checkbox" className="mt-1" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
            I saved these backup codes somewhere safe.
          </label>
          <label className="block">
            <span className="section-label mb-2 block">6-digit code</span>
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
          <button type="submit" className="btn-primary w-full" disabled={!saved || pending !== null}>
            {pending === "confirm" ? "Checking…" : "Enable authenticator"}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-hero-accent">{error}</p>}
    </div>
  );
}
