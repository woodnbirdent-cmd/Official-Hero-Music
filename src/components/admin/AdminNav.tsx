"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex gap-2 overflow-x-auto" aria-label="Admin">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 border px-3 py-2 text-xs font-bold uppercase tracking-wider ${
              active
                ? "border-white bg-white text-black"
                : "border-hero-gray text-hero-light hover:border-white hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
