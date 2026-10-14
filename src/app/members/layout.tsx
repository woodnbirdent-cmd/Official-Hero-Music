import Link from "next/link";

export const dynamic = "force-dynamic";
import { requireTier } from "@/lib/members";

const LINKS = [
  { href: "/members", label: "Updates" },
  { href: "/members/early-access", label: "Early access" },
  { href: "/members/downloads", label: "Downloads" },
  { href: "/account", label: "Account" },
];

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  await requireTier("free", "/members");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="section-label mb-3">Members</p>
      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Member sections">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="border border-hero-gray px-3 py-2 text-xs font-bold uppercase tracking-wider text-hero-light hover:border-white hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
