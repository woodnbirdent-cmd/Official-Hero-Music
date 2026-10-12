import { CartProvider } from "@/components/merch/CartProvider";
import MerchChrome from "@/components/merch/MerchChrome";

export default function MerchLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <MerchChrome />
      {children}
    </CartProvider>
  );
}
