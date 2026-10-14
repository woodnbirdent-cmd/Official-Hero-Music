import { getProduct } from "@/lib/merch";

/** Stripe metadata values are limited to 500 characters. */
const META_VALUE_LIMIT = 500;

export type OrderLine = {
  slug: string;
  size: string;
  quantity: number;
  /** Used when the line was read from Stripe and has no slug. */
  label?: string;
};

export function encodeOrderItems(items: OrderLine[]): Record<string, string> {
  const metadata: Record<string, string> = {};
  let index = 0;
  let current = "";

  const push = () => {
    if (!current) return;
    metadata[index === 0 ? "items" : `items_${index}`] = current;
    index += 1;
    current = "";
  };

  for (const item of items) {
    const part = `${item.slug}|${item.size}|${item.quantity}`;
    if (part.length > META_VALUE_LIMIT) continue;
    const next = current ? `${current};${part}` : part;
    if (next.length > META_VALUE_LIMIT) {
      push();
      current = part;
    } else {
      current = next;
    }
  }
  push();
  return metadata;
}

function metaIndex(key: string): number {
  if (key === "items") return 0;
  return Number(key.slice("items_".length));
}

export function decodeOrderItems(metadata: Record<string, string> | null | undefined): OrderLine[] {
  if (!metadata) return [];
  const keys = Object.keys(metadata).filter((key) => key === "items" || /^items_\d+$/.test(key));
  keys.sort((a, b) => metaIndex(a) - metaIndex(b));
  if (keys.length === 0) return [];

  const lines: OrderLine[] = [];
  for (const part of keys.map((key) => metadata[key] || "").join(";").split(";")) {
    if (!part) continue;
    const [slug, size, quantity] = part.split("|");
    const parsed = Number(quantity);
    if (!slug || !size || !Number.isInteger(parsed) || parsed < 1) continue;
    lines.push({ slug, size, quantity: parsed });
  }
  return lines;
}

export function hasOrderItemMetadata(metadata: Record<string, string> | null | undefined): boolean {
  if (!metadata) return false;
  return Object.keys(metadata).some((key) => key === "items" || /^items_\d+$/.test(key));
}

export function orderLineLabel(line: OrderLine): string {
  if (line.label) return `${line.quantity}× ${line.label}`;
  const product = getProduct(line.slug);
  const name = product?.name || line.slug;
  return `${line.quantity}× ${name} (${line.size})`;
}
