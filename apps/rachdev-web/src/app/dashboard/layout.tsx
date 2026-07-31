'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Radio,
  Stethoscope,
  ClipboardList,
  Package,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { cn } from '@rach/ui/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
  /** Only show when the tenant's industry matches (e.g. 'healthcare'). */
  industry?: string;
}

// Healthcare workspace nav — role- and industry-scoped. Mirrors the
// `workspace.views` declared on the medical industry in data/industries.ts.
const NAV_ITEMS: NavItem[] = [
  { label: 'Control Tower', href: '/dashboard/clinical/control-tower', icon: <Radio size={18} />,         roles: ['tenant_admin', 'admin'],          industry: 'healthcare' },
  { label: 'Scribe',        href: '/dashboard/clinical/scribe',        icon: <Stethoscope size={18} />,   roles: ['doctor'],                          industry: 'healthcare' },
  { label: 'Reception',     href: '/dashboard/clinical/reception',     icon: <ClipboardList size={18} />, roles: ['reception'],                       industry: 'healthcare' },
  { label: 'Inventory',     href: '/dashboard/clinical/inventory',     icon: <Package size={18} />,       roles: ['store_manager', 'tenant_admin'],   industry: 'healthcare' },
  { label: 'Audit',         href: '/dashboard/clinical/audit',         icon: <ShieldCheck size={18} />,   roles: ['tenant_admin', 'admin'],           industry: 'healthcare' },

  // Not industry-gated — reachable before an industry is chosen (bootstraps the workspace).
  { label: 'Settings',      href: '/dashboard/settings',               icon: <Settings size={18} />,      roles: ['tenant_admin', 'admin'] },
];

export default function ClinicalDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Auth guard
  useEffect(() => {
    if (!loading && !token) router.replace('/login');
  }, [loading, token, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );
  }

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.roles && !item.roles.includes(user.role)) return false;
    if (item.industry && user.tenant_industry !== item.industry) return false;
    return true;
  });

  const currentLabel =
    visibleItems.find((i) => pathname === i.href || pathname.startsWith(i.href + '/'))?.label ??
    'Workspace';

  const Sidebar = () => (
    <>
      <div className="flex h-16 items-center border-b border-line px-6">
        <Link href="/" className="text-lg font-semibold text-ink" aria-label="RachDev home">
          Rach<span className="text-accent">Dev</span>
        </Link>
      </div>

      <div className="border-b border-line px-4 py-4">
        <div className="rounded-xl bg-band px-3 py-3">
          <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
          <p className="truncate text-xs text-ink-3">{user.email}</p>
          <span className="mt-2 inline-flex items-center rounded-full bg-accent-weak px-2 py-0.5 text-xs font-semibold text-accent">
            {user.role.charAt(0).toUpperCase() + user.role.slice(1).replace('_', ' ')}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.length === 0 && (
          <p className="px-3 py-2 text-xs text-ink-3">
            No workspace views for this account.
          </p>
        )}
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-weak text-accent'
                  : 'text-ink-2 hover:bg-band hover:text-ink',
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight size={14} className="text-accent" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-3 py-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-page">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:translate-x-0 overflow-y-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-line bg-surface px-4 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-band lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <h1 className="flex-1 text-sm font-medium text-ink-3">{currentLabel}</h1>
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-band lg:hidden"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
