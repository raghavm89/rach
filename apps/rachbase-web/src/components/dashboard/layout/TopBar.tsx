"use client";

import { usePathname } from "next/navigation";
import { Search, Bell, ChevronRight, LogOut, Settings, User, Menu } from "lucide-react";
import { useState } from "react";
import { mockCurrentUser } from "@/data/mock/users";

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const breadcrumbs = generateBreadcrumbs(pathname);

  return (
    <header className="flex items-center justify-between h-14 px-4 border-b border-neutral-border bg-white shrink-0">
      {/* Left side: hamburger + breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden p-1.5 -ml-1 rounded-md hover:bg-surface-hover transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-dash-muted" />
          </button>
        )}
      <nav className="flex items-center gap-1 text-sm min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-dash-disabled shrink-0" />}
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-dash-heading truncate">{crumb.label}</span>
            ) : (
              <span className="text-dash-muted truncate">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2">
        {/* Search Trigger */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-neutral-border text-dash-muted text-sm hover:bg-surface-hover transition-colors">
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline text-xs bg-surface-hover px-1.5 py-0.5 rounded font-mono">
            {"\u2318"}K
          </kbd>
        </button>

        {/* Notifications */}
        <button type="button" aria-label="Notifications" className="relative p-2 rounded-md hover:bg-surface-hover transition-colors">
          <Bell className="w-5 h-5 text-dash-muted" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-status-danger rounded-full" />
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-md hover:bg-surface-hover transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary-blue/20 flex items-center justify-center text-primary-blue text-xs font-bold">
              {mockCurrentUser.name.charAt(0)}
            </div>
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-neutral-border rounded-lg shadow-lg z-50 py-1">
                <div className="px-3 py-2 border-b border-neutral-border">
                  <p className="text-sm font-medium text-dash-heading">{mockCurrentUser.name}</p>
                  <p className="text-xs text-dash-muted">{mockCurrentUser.email}</p>
                </div>
                <UserMenuItem icon={User} label="Profile" />
                <UserMenuItem icon={Settings} label="Preferences" />
                <div className="border-t border-neutral-border my-1" />
                <UserMenuItem icon={LogOut} label="Log out" />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function UserMenuItem({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-dash-body hover:bg-surface-hover transition-colors">
      <Icon className="w-4 h-4 text-dash-muted" />
      <span>{label}</span>
    </button>
  );
}

function generateBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];

  const labelMap: Record<string, string> = {
    app: "Dashboard",
    admin: "Admin",
    overview: "Overview",
    database: "Database",
    auth: "Authentication",
    storage: "Storage",
    apis: "APIs",
    agents: "Agents",
    knowledge: "Knowledge Base",
    logs: "Logs",
    monitoring: "Monitoring",
    billing: "Billing",
    team: "Team",
    settings: "Settings",
    tenants: "Tenants",
    health: "Platform Health",
    support: "Support",
    audit: "Audit Logs",
    new: "New",
    templates: "Templates",
    sandbox: "Sandbox",
    edit: "Edit",
  };

  let path = "";
  for (const segment of segments) {
    path += `/${segment}`;
    const label = labelMap[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ label, href: path });
  }

  return crumbs;
}
