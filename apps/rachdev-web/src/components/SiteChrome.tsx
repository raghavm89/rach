"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@rach/ui/components/layout/Navbar";
import { Footer } from "@rach/ui/components/layout/Footer";
import { RaeProvider } from "@/components/chat/RaeProvider";
import { navGroups, footerColumns, footerTagline } from "@/config/nav";

// Auth pages supply their own full-screen split layout — no marketing chrome.
const BARE_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth-callback",
  "/dashboard", // authenticated workspace — brings its own shell, no marketing chrome
];

/**
 * Renders the marketing Navbar/Footer everywhere except the auth pages, which
 * bring their own layout. Keeps one root layout without route-group gymnastics.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  if (BARE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }
  return (
    <div className="bg-page text-ink">
      <Navbar navGroups={navGroups} />
      <main>{children}</main>
      <Footer columns={footerColumns} tagline={footerTagline} />
      <RaeProvider />
    </div>
  );
}
