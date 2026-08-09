'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LogOut,
  ChevronRight,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { cn } from '@rach/ui/lib/utils';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { navForUser, roleLabel } from '@/config/dashboard/registry';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-dash-body transition-colors hover:bg-surface-hover"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function WorkspaceLayout({ children }: { children: React.ReactNode }) {
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
      <div className="flex min-h-screen items-center justify-center bg-surface-app">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-border border-t-accent" />
      </div>
    );
  }

  const visibleItems = navForUser(user.role, user.tenant_industry);

  // The single active item is the LONGEST matching href — otherwise a parent
  // route (e.g. /dashboard/hr) lights up on every child (/dashboard/hr/approvals).
  const activeHref = visibleItems
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const currentLabel = visibleItems.find((i) => i.href === activeHref)?.label ?? 'Workspace';

  const Sidebar = () => (
    <>
      <div className="flex h-16 items-center border-b border-neutral-border px-6">
        <Link href="/" className="flex items-center" aria-label="RachDev home">
          <Image src="/brand/rach-dev-logo-side.svg" alt="Rach Dev LLP" width={172} height={32} priority className="h-8 w-auto" />
        </Link>
      </div>

      <div className="border-b border-neutral-border px-4 py-4">
        <div className="rounded-xl bg-surface-hover px-3 py-3">
          <p className="truncate text-sm font-semibold text-dash-heading">{user.name}</p>
          <p className="truncate text-xs text-dash-muted">{user.email}</p>
          <span className="mt-2 inline-flex items-center rounded-full bg-accent-weak px-2 py-0.5 text-xs font-semibold text-accent">
            {roleLabel(user.role, user.tenant_industry)}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.length === 0 && (
          <p className="px-3 py-2 text-xs text-dash-muted">
            No workspace views for this account.
          </p>
        )}
        {visibleItems.map((item) => {
          const isActive = item.href === activeHref;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-weak text-accent'
                  : 'text-dash-body hover:bg-surface-hover hover:text-dash-heading',
              )}
            >
              <Icon size={18} />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight size={14} className="text-accent" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-neutral-border px-3 py-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-dash-body transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-surface-app">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-neutral-border bg-surface-card transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:translate-x-0 overflow-y-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-neutral-border bg-surface-card px-4 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-dash-body hover:bg-surface-hover lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <h1 className="flex-1 text-sm font-medium text-dash-heading">
            {user.tenant_name ?? currentLabel}
            {user.tenant_name && <span className="ml-2 font-normal text-dash-muted">· {currentLabel}</span>}
          </h1>
          <ThemeToggle />
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-dash-body hover:bg-surface-hover lg:hidden"
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <WorkspaceLayout>{children}</WorkspaceLayout>
    </ThemeProvider>
  );
}
