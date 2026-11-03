import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";
import { publicSitemapPaths } from "@/lib/sitemap-paths";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicSitemapPaths().map((path) => ({
    url: path === "/" ? SITE.url : `${SITE.url}${path}`,
  }));
}
