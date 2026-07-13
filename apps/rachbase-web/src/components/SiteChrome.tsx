"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@rach/ui/components/layout/Navbar";
import { Footer } from "@rach/ui/components/layout/Footer";
import { navGroups, footerColumns, footerTagline } from "@/config/nav";
import { BrandLogo } from "@/components/BrandLogo";

// Routes that supply their own full-screen shell (no marketing Navbar/Footer):
// the dashboard (sidebar) and the auth pages (split layout).
const BARE_PREFIXES = [
  "/dashboard",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth-callback",
];

/**
 * Renders the marketing chrome (Navbar/Footer) on marketing routes, but NOT on
 * the dashboard or auth pages — those supply their own shell via their layouts.
 * This lets everything live under one root layout without route-group gymnastics.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  if (BARE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }
  return (
    <div className="bg-page text-ink">
      <Navbar navGroups={navGroups} logo={<BrandLogo />} />
      <main>{children}</main>
      <Footer columns={footerColumns} tagline={footerTagline} logo={<BrandLogo />} />
    </div>
  );
}
