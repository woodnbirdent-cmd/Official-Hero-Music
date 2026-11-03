import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { listAdminActivity } from "@/lib/admin-store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: "Activity" };
}

export default async function AdminActivityPage() {
  const rows = await listAdminActivity();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-heading text-3xl">Activity</h1>
        <p className="mt-2 text-sm text-hero-muted">Who did what, and when. The latest 200 admin actions.</p>
      </div>
      {rows.length === 0 ? (
        <p className="card-surface text-sm text-hero-light">No admin actions yet.</p>
      ) : (
        <>
          <ul className="space-y-4 md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="card-surface space-y-1 text-sm">
                <p className="font-bold text-white">{row.action}</p>
                <p className="text-hero-light">{row.target || "—"}</p>
                {row.detail && <p className="text-hero-muted">{row.detail}</p>}
                <p className="text-hero-muted">
                  {row.adminEmail} · {formatStamp(row.createdAt)}
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto border border-hero-gray md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-hero-dark text-xs uppercase tracking-wider text-hero-muted">
                <tr>
                  <th className="px-3 py-3 font-bold">When</th>
                  <th className="px-3 py-3 font-bold">Who</th>
                  <th className="px-3 py-3 font-bold">What</th>
                  <th className="px-3 py-3 font-bold">Target</th>
                  <th className="px-3 py-3 font-bold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-hero-gray align-top">
                    <td className="px-3 py-3 text-hero-muted">{formatStamp(row.createdAt)}</td>
                    <td className="px-3 py-3 text-white">{row.adminEmail}</td>
                    <td className="px-3 py-3 text-hero-light">{row.action}</td>
                    <td className="px-3 py-3 text-hero-light">{row.target || "—"}</td>
                    <td className="px-3 py-3 text-hero-muted">{row.detail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function formatStamp(value: Date): string {
  if (Number.isNaN(value.getTime())) return "";
  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(value)} UTC`;
}
