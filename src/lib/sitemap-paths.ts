import { NAV_LINKS } from "./constants";
import { MERCH_PRODUCTS } from "./merch";

/** Public URLs for the sitemap. Admin routes are never included. */
export function publicSitemapPaths(): string[] {
  const paths = new Set<string>(["/"]);
  for (const link of NAV_LINKS) paths.add(link.href);
  for (const product of MERCH_PRODUCTS) paths.add(`/merch/${product.slug}`);
  return [...paths].filter((path) => path === "/" || (path.startsWith("/") && !path.startsWith("/admin"))).sort();
}
