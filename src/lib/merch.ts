/**
 * Flat US shipping charged once per merch order, in cents.
 * TODO: Replace this flat rate with Shippo live rates.
 */
export const SHIPPING_FLAT_CENTS = 600;

export const MERCH_PRICE_CENTS = 2500;
export const MAX_QUANTITY = 10;
export const CART_STORAGE_KEY = "hero-merch-cart";

export type MerchView = "front" | "back";

export type MerchProduct = {
  slug: string;
  name: string;
  priceCents: number;
  sizes: readonly string[];
  images: Record<MerchView, string>;
  summary: string;
  details: readonly string[];
};

export const MERCH_PRODUCTS: readonly MerchProduct[] = [
  {
    slug: "hero-tee-white",
    name: "#Hero Tee, White",
    priceCents: MERCH_PRICE_CENTS,
    sizes: ["S", "M", "L", "XL", "2X"],
    images: {
      front: "/merch/white-tee-front.jpg",
      back: "/merch/white-tee-back.jpg",
    },
    summary: "Premium blend. #Hero logo on the chest, YAH Familia on the sleeve.",
    details: [
      "Premium blend",
      "Front: #Hero logo on the chest, YAH Familia on the sleeve",
      "Back: RIP TO THE OLD ME skull with roses",
      "Sizes S, M, L, XL, and 2X",
    ],
  },
  {
    slug: "hero-tee-black",
    name: "#Hero Tee, Black",
    priceCents: MERCH_PRICE_CENTS,
    sizes: ["S", "M", "L", "XL", "2X"],
    images: {
      front: "/merch/black-tee-front.jpg",
      back: "/merch/black-tee-back.jpg",
    },
    summary: "#Hero logo on the chest, YAH Familia on the sleeve.",
    details: [
      "Front: #Hero logo on the chest, YAH Familia on the sleeve",
      "Back: RIP TO THE OLD ME skull with roses",
      "Sizes S, M, L, XL, and 2X",
    ],
  },
  {
    slug: "hero-snapback",
    name: "#Hero Snapback",
    priceCents: MERCH_PRICE_CENTS,
    sizes: ["One size"],
    images: {
      front: "/merch/hat-front.jpg",
      back: "/merch/hat-back.jpg",
    },
    summary: "Light gray crown, black brim. Adjustable, one size.",
    details: [
      "Light gray with a black brim",
      "Front: #Hero raised embroidery",
      "Back: YAH Familia",
      "Adjustable, one size",
    ],
  },
];

export function getProduct(slug: string): MerchProduct | undefined {
  return MERCH_PRODUCTS.find((product) => product.slug === slug);
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
