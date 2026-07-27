"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@rach/ui/lib/utils";
import {
  LayoutDashboard,
  Database,
  Shield,
  HardDrive,
  Plug,
  Bot,
  Brain,
  FileText,
  BarChart3,
  CreditCard,
  Users,
  Settings,
  BookOpen,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Building2,
  DollarSign,
  HeartPulse,
  Ticket,
  ClipboardList,
  Rocket,
  Network,
} from "lucide-react";
import { ProjectSwitcher } from "./ProjectSwitcher";
import {
  Sheet,
  SheetContent,
} from "@/components/dashboard-ui/sheet";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface SidebarProps {
  variant: "user" | "admin";
  projectSlug?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const userNavItems = (projectSlug: string): NavItem[] => [
  { label: "Overview", href: `/app/${projectSlug}/overview`, icon: LayoutDashboard },
  { label: "Database", href: `/app/${projectSlug}/database`, icon: Database },
  { label: "Authentication", href: `/app/${projectSlug}/auth`, icon: Shield },
  { label: "Storage", href: `/app/${projectSlug}/storage`, icon: HardDrive },
  { label: "APIs", href: `/app/${projectSlug}/apis`, icon: Plug },
  { label: "Agents", href: `/app/${projectSlug}/agents`, icon: Bot },
  { label: "Knowledge Base", href: `/app/${projectSlug}/knowledge`, icon: Brain },
  { label: "Logs", href: `/app/${projectSlug}/logs`, icon: FileText },
  { label: "Monitoring", href: `/app/${projectSlug}/monitoring`, icon: BarChart3 },
  { label: "Deployment", href: `/app/${projectSlug}/deployment`, icon: Rocket },
];

const userSecondaryItems = (projectSlug: string): NavItem[] => [
  { label: "Billing", href: `/app/${projectSlug}/billing`, icon: CreditCard },
  { label: "Team", href: `/app/${projectSlug}/team`, icon: Users },
  { label: "Settings", href: `/app/${projectSlug}/settings`, icon: Settings },
];

const userBottomItems: NavItem[] = [
  { label: "Documentation", href: "/docs", icon: BookOpen },
  { label: "Support", href: "/contact", icon: MessageCircle },
];

const adminNavItems: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Tenants", href: "/admin/tenants", icon: Building2 },
  { label: "Billing", href: "/admin/billing", icon: DollarSign },
  { label: "Agents", href: "/admin/agents", icon: Bot },
  { label: "Platform Health", href: "/admin/health", icon: HeartPulse },
  { label: "Infrastructure",  href: "/admin/infrastructure", icon: Network },
  { label: "Support", href: "/admin/support", icon: Ticket },
  { label: "Audit Logs", href: "/admin/audit", icon: ClipboardList },
];

const adminSecondaryItems: NavItem[] = [
  { label: "Team", href: "/admin/team", icon: Users },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function Sidebar({ variant, projectSlug = "myapp-prod", mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      return !prev;
    });
  };

  const isActive = (href: string) => {
    if (href === "/admin" && pathname === "/admin") return true;
    if (href !== "/admin" && pathname.startsWith(href)) return true;
    return false;
  };

  const mainItems = variant === "user" ? userNavItems(projectSlug) : adminNavItems;
  const secondaryItems = variant === "user" ? userSecondaryItems(projectSlug) : adminSecondaryItems;
  const bottomItems = variant === "user" ? userBottomItems : [];

  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Top: Logo / Project Switcher */}
      <div className="flex items-center h-14 px-3 border-b border-white/10">
        {variant === "user" ? (
          !isMobile && collapsed ? (
            <Image src="/brand/rachbase-mark.png" alt="RachBase" width={40} height={40} className="w-10 h-10 rounded-lg" />
          ) : (
            <ProjectSwitcher projectSlug={projectSlug} />
          )
        ) : (
          <div className="flex items-center gap-2 overflow-hidden">
            <Image src="/brand/rachbase-mark.png" alt="RachBase" width={32} height={32} className="w-8 h-8 rounded-lg shrink-0" />
            {(isMobile || !collapsed) && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-white truncate">RachBase Admin</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-status-danger/20 text-status-danger w-fit">
                  PRODUCTION
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {mainItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            collapsed={!isMobile && collapsed}
            onClick={isMobile ? onMobileClose : undefined}
          />
        ))}

        <div className="my-3 mx-2 border-t border-white/10" />

        {secondaryItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            collapsed={!isMobile && collapsed}
            onClick={isMobile ? onMobileClose : undefined}
          />
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-2 space-y-1">
        {bottomItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            collapsed={!isMobile && collapsed}
            onClick={isMobile ? onMobileClose : undefined}
          />
        ))}

        {!isMobile && (
          <button
            onClick={toggleCollapsed}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-dash-muted hover:bg-surface-sidebar-hover hover:text-dash-sidebar transition-colors text-sm"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen bg-surface-sidebar text-dash-sidebar transition-all duration-200 shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile sidebar (Sheet drawer) */}
      <Sheet
        open={mobileOpen}
        onOpenChange={(open) => {
          if (!open) onMobileClose?.();
        }}
      >
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-60 p-0 bg-surface-sidebar text-dash-sidebar flex flex-col md:hidden"
        >
          {sidebarContent(true)}
        </SheetContent>
      </Sheet>
    </>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
        active
          ? "bg-primary-blue/15 text-white font-medium"
          : "text-dash-sidebar hover:bg-surface-sidebar-hover hover:text-white",
        collapsed && "justify-center px-0"
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
