"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
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
} from "lucide-react";

interface CommandItem {
  label: string;
  href: string;
  icon: React.ElementType;
  group: string;
}

const dashboardPages: CommandItem[] = [
  { label: "Overview", href: "/app/myapp-prod/overview", icon: LayoutDashboard, group: "Pages" },
  { label: "Database", href: "/app/myapp-prod/database", icon: Database, group: "Pages" },
  { label: "Authentication", href: "/app/myapp-prod/auth", icon: Shield, group: "Pages" },
  { label: "Storage", href: "/app/myapp-prod/storage", icon: HardDrive, group: "Pages" },
  { label: "APIs", href: "/app/myapp-prod/apis", icon: Plug, group: "Pages" },
  { label: "Agents", href: "/app/myapp-prod/agents", icon: Bot, group: "Pages" },
  { label: "Knowledge Base", href: "/app/myapp-prod/knowledge", icon: Brain, group: "Pages" },
  { label: "Logs", href: "/app/myapp-prod/logs", icon: FileText, group: "Pages" },
  { label: "Monitoring", href: "/app/myapp-prod/monitoring", icon: BarChart3, group: "Pages" },
  { label: "Billing", href: "/app/myapp-prod/billing", icon: CreditCard, group: "Pages" },
  { label: "Team", href: "/app/myapp-prod/team", icon: Users, group: "Pages" },
  { label: "Settings", href: "/app/myapp-prod/settings", icon: Settings, group: "Pages" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <Command className="bg-surface-card rounded-xl shadow-2xl border border-neutral-border overflow-hidden">
          <Command.Input
            placeholder="Search pages, actions..."
            className="w-full px-4 py-3 text-sm border-b border-neutral-border bg-transparent outline-none text-dash-heading placeholder:text-dash-disabled"
            autoFocus
          />
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-dash-muted">
              No results found.
            </Command.Empty>
            <Command.Group heading="Pages" className="text-xs text-dash-muted px-2 py-1.5">
              {dashboardPages.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.href}
                    value={item.label}
                    onSelect={() => handleSelect(item.href)}
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-dash-body cursor-pointer data-[selected=true]:bg-surface-hover"
                  >
                    <Icon className="w-4 h-4 text-dash-muted" />
                    <span>{item.label}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
