import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminTotpForm from "@/components/admin/AdminTotpForm";
import { adminGate } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Authenticator code",
  robots: { index: false, follow: false },
};

export default async function AdminTotpPage() {
  const gate = await adminGate();
  if (gate.ok) redirect("/admin");
  if (gate.reason === "needs-enroll") redirect("/admin/sign-in/setup");
  if (gate.reason === "forbidden") redirect("/admin/sign-in");

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <p className="section-label mb-3">Private</p>
      <h1 className="section-heading mb-4 text-4xl">Authenticator</h1>
      <p className="mb-8 text-sm text-hero-light">Enter the code from your authenticator app, or one backup code.</p>
      <AdminTotpForm />
    </div>
  );
}
