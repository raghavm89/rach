import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private / non-marketing surfaces out of the index.
      disallow: [
        "/dashboard",
        "/api",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/auth-callback",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
