import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { listBookingRequests } from "@/lib/booking-store";
import { formatEventDate, formatSubmittedAt } from "@/lib/bookings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: "Bookings" };
}

export default async function AdminBookingsPage() {
  const { rows, error } = await listBookingRequests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-heading text-3xl">Bookings</h1>
        <p className="mt-2 text-sm text-hero-muted">
          Requests from the Book #Hero form, newest first. The latest 200.
        </p>
      </div>
      {error && <p className="text-sm text-hero-accent">{error}</p>}
      {rows.length === 0 ? (
        <p className="card-surface text-sm text-hero-light">No booking requests yet.</p>
      ) : (
        <>
          <ul className="space-y-4 md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="card-surface space-y-1 text-sm">
                <p className="font-bold text-white">{row.name}</p>
                <p>
                  <a className="text-hero-accent" href={`mailto:${row.email}`}>
                    {row.email}
                  </a>
                </p>
                <p className="text-hero-light">{row.org || "—"}</p>
                <p className="text-hero-muted">{row.eventDate ? formatEventDate(row.eventDate) : "—"}</p>
                <p className="whitespace-pre-wrap break-words text-hero-light">{row.message}</p>
                <p className="text-hero-muted">{formatSubmittedAt(row.createdAt)}</p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto border border-hero-gray md:block">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-hero-dark text-xs uppercase tracking-wider text-hero-muted">
                <tr>
                  <th className="px-3 py-3 font-bold">Name</th>
                  <th className="px-3 py-3 font-bold">Email</th>
                  <th className="px-3 py-3 font-bold">Org</th>
                  <th className="px-3 py-3 font-bold">Date</th>
                  <th className="px-3 py-3 font-bold">Message</th>
                  <th className="px-3 py-3 font-bold">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-hero-gray align-top">
                    <td className="px-3 py-3 text-white">{row.name}</td>
                    <td className="px-3 py-3">
                      <a className="text-hero-accent" href={`mailto:${row.email}`}>
                        {row.email}
                      </a>
                    </td>
                    <td className="px-3 py-3 text-hero-light">{row.org || "—"}</td>
                    <td className="px-3 py-3 text-hero-muted">
                      {row.eventDate ? formatEventDate(row.eventDate) : "—"}
                    </td>
                    <td className="max-w-md whitespace-pre-wrap break-words px-3 py-3 text-hero-light">
                      {row.message}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-hero-muted">
                      {formatSubmittedAt(row.createdAt)}
                    </td>
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
