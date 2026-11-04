import type { Metadata } from "next";
import Link from "next/link";
import DeleteMemberDialog from "@/components/admin/DeleteMemberDialog";
import { requireAdmin } from "@/lib/admin";
import { formatDay, statusLabel, tierLabel } from "@/lib/admin-csv";
import { filterMembers, getAdminData } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin();
  return { title: "Members" };
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const query = (params.q || "").slice(0, 100);
  const data = await getAdminData();
  const members = filterMembers(data.members, query);
  const exportHref = query ? `/admin/members/export?q=${encodeURIComponent(query)}` : "/admin/members/export";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-heading text-3xl">Members</h1>
          <p className="mt-2 text-sm text-hero-muted">
            Accounts from the database. Status is the live Stripe subscription, or Free when there is none.
          </p>
        </div>
        <Link href={exportHref} className="btn-ghost">
          Export CSV
        </Link>
      </div>
      {data.databaseError && <p className="text-sm text-hero-accent">{data.databaseError}</p>}
      <form action="/admin/members" className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="member-search">
          Search members
        </label>
        <input
          id="member-search"
          name="q"
          defaultValue={query}
          placeholder="Search name or email"
          className="input-field sm:max-w-md"
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>
      {members.length === 0 ? (
        <p className="card-surface text-sm text-hero-light">No members match.</p>
      ) : (
        <>
          <ul className="space-y-4 md:hidden">
            {members.map((member) => (
              <li key={member.id} className="card-surface space-y-1 text-sm">
                <p className="font-bold text-white">{member.name || member.email}</p>
                <p className="text-hero-muted">{member.email}</p>
                <p className="text-hero-light">
                  {tierLabel(member.tier)} · {statusLabel(member.status)}
                </p>
                <p className="text-hero-muted">Joined {formatDay(member.joined)}</p>
                <StripeLink href={member.stripeCustomerUrl} />
                <DeleteMemberDialog member={member} self={member.id === admin.id} />
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto border border-hero-gray md:block">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-hero-dark text-xs uppercase tracking-wider text-hero-muted">
                <tr>
                  <th className="px-3 py-3 font-bold">Email</th>
                  <th className="px-3 py-3 font-bold">Name</th>
                  <th className="px-3 py-3 font-bold">Tier</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="px-3 py-3 font-bold">Joined</th>
                  <th className="px-3 py-3 font-bold">Stripe</th>
                  <th className="px-3 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-t border-hero-gray">
                    <td className="px-3 py-3 text-white">{member.email}</td>
                    <td className="px-3 py-3 text-hero-light">{member.name}</td>
                    <td className="px-3 py-3 text-hero-light">{tierLabel(member.tier)}</td>
                    <td className="px-3 py-3 text-hero-light">{statusLabel(member.status)}</td>
                    <td className="px-3 py-3 text-hero-muted">{formatDay(member.joined)}</td>
                    <td className="px-3 py-3">
                      <StripeLink href={member.stripeCustomerUrl} />
                    </td>
                    <td className="px-3 py-3">
                      <DeleteMemberDialog member={member} self={member.id === admin.id} />
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

function StripeLink({ href }: { href: string | null }) {
  if (!href) return <span className="text-hero-muted">—</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase tracking-wider text-hero-accent">
      Customer
    </a>
  );
}
