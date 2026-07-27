import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";
import { features } from "@/data/features";

// Static marketing routes with rough crawl priorities. Dashboard, API, and auth
// routes are intentionally excluded (see robots.ts). /changelog is omitted
// since it's no longer linked from the site navigation.
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/",              priority: 1.0, changeFrequency: "weekly" },
  { path: "/products/baas", priority: 0.9, changeFrequency: "monthly" },
  { path: "/features",      priority: 0.8, changeFrequency: "monthly" },
  { path: "/pricing",       priority: 0.8, changeFrequency: "monthly" },
  { path: "/integrations",  priority: 0.7, changeFrequency: "monthly" },
  { path: "/security",      priority: 0.7, changeFrequency: "monthly" },
  { path: "/docs",          priority: 0.7, changeFrequency: "weekly" },
  { path: "/about",         priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact",       priority: 0.6, changeFrequency: "monthly" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/terms",   priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/dpa",     priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/sla",     priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/cookies", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const featureEntries: MetadataRoute.Sitemap = features.map((f) => ({
    url: `${SITE_URL}/features/${f.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...featureEntries];
}
