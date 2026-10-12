"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/merch/CartProvider";

export default function MerchChrome() {
  const pathname = usePathname();
  const { count, ready } = useCart();
  const onCart = pathname === "/merch/cart";

  return (
    <div className="border-b border-hero-gray bg-black">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/merch"
          className="text-xs font-bold uppercase tracking-[0.25em] text-hero-accent"
        >
          Shop
        </Link>
        <Link
          href="/merch/cart"
          className={`text-xs font-bold uppercase tracking-wider ${
            onCart ? "text-hero-accent" : "text-white hover:text-hero-accent"
          }`}
          aria-current={onCart ? "page" : undefined}
        >
          Cart{ready ? ` (${count})` : ""}
        </Link>
      </div>
    </div>
  );
}
