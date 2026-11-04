import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminTotpSetup from "@/components/admin/AdminTotpSetup";
import { adminGate } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up authenticator",
  robots: { index: false, follow: false },
};

export default async function AdminTotpSetupPage() {
  const gate = await adminGate();
  if (gate.ok) redirect("/admin");
  if (gate.reason === "needs-totp") redirect("/admin/sign-in/totp");
  if (gate.reason !== "needs-enroll") redirect("/admin/sign-in");

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="section-label mb-3">Private</p>
      <h1 className="section-heading mb-4 text-4xl">Authenticator</h1>
      <AdminTotpSetup />
    </div>
  );
}
