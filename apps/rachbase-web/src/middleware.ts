import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Host-based routing for the status subdomain. A request to status.rachbase.com (or
// status.rachbase.app / status.localhost) shows the status page at the root; /sla stays
// reachable there too. Everything else on that host falls through to the status page so the
// subdomain stays focused on status only.
//
// NOTE: served by the same Next app today, so it shares fate with the main site during a
// full outage. When you move the status page to an independent deploy, this rewrite plus the
// configurable NEXT_PUBLIC_STATUS_API_URL let the page run unchanged from the new host.
const STATUS_HOST_PREFIX = "status.";

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  if (!host.startsWith(STATUS_HOST_PREFIX)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // Allow the status page and the legal pages (SLA, terms, privacy) to render directly.
  if (pathname === "/status" || pathname.startsWith("/legal")) return NextResponse.next();

  // Anything else on the status host → the status page.
  const url = req.nextUrl.clone();
  url.pathname = "/status";
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip Next internals, API routes, and static files (anything with a dot).
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
