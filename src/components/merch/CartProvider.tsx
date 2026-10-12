"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CART_STORAGE_KEY, MAX_QUANTITY, getProduct } from "@/lib/merch";

export type CartLine = {
  slug: string;
  size: string;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  addItem: (slug: string, size: string, quantity: number) => void;
  setQuantity: (slug: string, size: string, quantity: number) => void;
  removeItem: (slug: string, size: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function clampQuantity(quantity: number): number {
  return Math.max(1, Math.min(MAX_QUANTITY, Math.floor(quantity)));
}

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.slug === "string" &&
    typeof line.size === "string" &&
    typeof line.quantity === "number" &&
    Number.isInteger(line.quantity)
  );
}

function readStoredCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const lines: CartLine[] = [];
    for (const entry of parsed) {
      if (!isCartLine(entry)) continue;
      const product = getProduct(entry.slug);
      if (!product || !product.sizes.includes(entry.size) || entry.quantity < 1) continue;
      const existing = lines.find((line) => line.slug === entry.slug && line.size === entry.size);
      if (existing) {
        existing.quantity = clampQuantity(existing.quantity + entry.quantity);
      } else {
        lines.push({
          slug: entry.slug,
          size: entry.size,
          quantity: clampQuantity(entry.quantity),
        });
      }
    }
    return lines;
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(readStoredCart());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  }, [lines, ready]);

  const addItem = useCallback((slug: string, size: string, quantity: number) => {
    const product = getProduct(slug);
    if (!product || !product.sizes.includes(size)) return;
    const add = clampQuantity(quantity);
    setLines((current) => {
      const existing = current.find((line) => line.slug === slug && line.size === size);
      if (!existing) return [...current, { slug, size, quantity: add }];
      return current.map((line) =>
        line.slug === slug && line.size === size
          ? { ...line, quantity: clampQuantity(line.quantity + add) }
          : line,
      );
    });
  }, []);

  const setQuantity = useCallback((slug: string, size: string, quantity: number) => {
    if (!Number.isFinite(quantity) || quantity < 1) return;
    setLines((current) =>
      current.map((line) =>
        line.slug === slug && line.size === size
          ? { ...line, quantity: clampQuantity(quantity) }
          : line,
      ),
    );
  }, []);

  const removeItem = useCallback((slug: string, size: string) => {
    setLines((current) => current.filter((line) => line.slug !== slug || line.size !== size));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    localStorage.setItem(CART_STORAGE_KEY, "[]");
  }, []);

  const count = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines],
  );

  const value = useMemo(
    () => ({ lines, ready, count, addItem, setQuantity, removeItem, clear }),
    [lines, ready, count, addItem, setQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart must be used inside CartProvider");
  return cart;
}
