import type { Metadata } from "next";
import CartView from "@/components/merch/CartView";

export const metadata: Metadata = {
  title: "Cart",
  description: "Your #Hero merch cart.",
};

export default function CartPage() {
  return <CartView />;
}
