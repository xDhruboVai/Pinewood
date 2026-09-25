import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/menu", "/visit", "/about", "/reserve", "/privacy"].map((path) => ({
    url: `${SITE.url}${path}`,
    changeFrequency: path === "/menu" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
