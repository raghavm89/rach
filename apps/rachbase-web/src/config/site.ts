// Canonical public origin for the site. Used by metadataBase, sitemap.ts, and
// robots.ts so absolute URLs are correct once the real domain is set.
// Override per environment with NEXT_PUBLIC_SITE_URL (no trailing slash).
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://rachbase.example"
).replace(/\/$/, "");
