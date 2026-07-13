'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  Monitor,
  CreditCard,
  ShoppingBag,
  User,
  Users,
  LogOut,
  ChevronRight,
  Rocket,
  Menu,
  X,
  Network,
  Coins,
} from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { cn } from '@rach/ui/lib/utils';
import { TerminalProvider, useTerminal } from '@/contexts/TerminalContext';
import { ChatProvider, useChat } from '@/contexts/ChatContext';
import { Terminal } from '@/components/dashboard/Terminal';
import { BrandLogo } from '@/components/BrandLogo';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
  desktopOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview',   href: '/dashboard',             icon: <LayoutDashboard size={18} /> },
  { label: 'Monitoring', href: '/dashboard/monitoring',  icon: <Monitor size={18} />,   roles: ['admin'] },
  { label: 'VM Monitor', href: '/dashboard/vm-monitor',  icon: <Monitor size={18} />,   roles: ['tenant_admin'] },
  { label: 'My VMs',     href: '/dashboard/my-vms',      icon: <Monitor size={18} />,   roles: ['tenant_user', 'developer'] },
  { label: 'Users',      href: '/dashboard/users',       icon: <Users size={18} />,     roles: ['admin', 'tenant_admin'] },
  { label: 'Tenants',    href: '/dashboard/tenants',     icon: <Users size={18} />,     roles: ['admin'] },
  { label: 'Orders',     href: '/dashboard/orders',      icon: <ShoppingBag size={18} />, roles: ['admin', 'tenant_admin', 'tenant_user'] },
  { label: 'Deployment',      href: '/dashboard/deployment',      icon: <Rocket size={18} />,  roles: ['tenant_admin'], desktopOnly: true },
  { label: 'Infrastructure',  href: '/dashboard/infrastructure',  icon: <Network size={18} />, roles: ['admin'] },
  { label: 'Billing',      href: '/dashboard/billing',       icon: <CreditCard size={18} />, roles: ['tenant_admin', 'tenant_user'] },
  { label: 'Credit Usage', href: '/dashboard/credit-usage',  icon: <Coins size={18} />,      roles: ['tenant_admin'] },
  { label: 'Profile',    href: '/dashboard/profile',     icon: <User size={18} /> },
];

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, token, loading, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Auth guard
  useEffect(() => {
    if (!loading && !token) router.replace('/');
  }, [loading, token, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-secondary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-border border-t-primary-blue" />
      </div>
    );
  }

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.roles && !item.roles.includes(user.role)) return false;
    return true;
  });

  const currentLabel = visibleItems.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + '/')
  )?.label ?? 'Dashboard';

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-neutral-border px-6">
        <Link href="/" className="flex items-center" aria-label="RachBase home">
          <BrandLogo />
        </Link>
      </div>

      {/* User badge */}
      <div className="px-4 py-4 border-b border-neutral-border">
        <div className="rounded-xl bg-bg-secondary px-3 py-3">
          <p className="text-sm font-semibold text-text-primary truncate">{user.name}</p>
          <p className="text-xs text-text-muted truncate">{user.email}</p>
          <span
            className={cn(
              'mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
              user.role === 'admin'
                ? 'bg-gradient-to-r from-primary-blue to-primary-purple text-white'
                : 'bg-accent-sky/30 text-primary-blue',
            )}
          >
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-gradient-to-r from-primary-blue/10 to-primary-purple/10 text-primary-blue border-l-2 border-primary-blue'
                  : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary',
                item.desktopOnly && 'hidden md:flex',
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight size={14} className="text-primary-blue" />}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-neutral-border px-3 py-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-red-50 hover:text-red-600 transition-all duration-150"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-bg-secondary">

      {/* ── Mobile overlay ───────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop: sticky, mobile: slide-in drawer) ───── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-neutral-border bg-white transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:flex-shrink-0 lg:translate-x-0 overflow-y-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent />
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-3 border-b border-neutral-border bg-white px-4 lg:px-8">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary transition-colors lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <h1 className="text-sm font-medium text-text-muted flex-1">{currentLabel}</h1>

          {/* Close button inside header when sidebar open on mobile */}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary transition-colors lg:hidden"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8 relative">
          {children}
          <PersistentTerminal />
        </main>
      </div>
    </div>
  );
}

function PersistentTerminal() {
  const { terminalVM, closeTerminal } = useTerminal();
  const { token }    = useAuth();
  const pathname     = usePathname();
  const { chatOpen } = useChat();

  if (!terminalVM || !token) return null;

  const isDeploymentPage = pathname === '/dashboard/deployment';
  // lg:p-8 = 32px padding on all sides of <main>
  // w-80 chat (320px) + right padding (32px) = 352px right offset when chat open
  const PADDING     = 32;
  const CHAT_WIDTH  = 320;
  const rightOffset = isDeploymentPage && chatOpen ? CHAT_WIDTH + PADDING : PADDING;

  return (
    <div style={{
      display:  isDeploymentPage ? 'block' : 'none',
      position: 'absolute',
      bottom:   PADDING,
      left:     PADDING,
      right:    rightOffset,
      zIndex:   30,
    }}>
      <Terminal
        key={terminalVM.id}
        vmId={terminalVM.id}
        vmName={terminalVM.name}
        token={token}
        onClose={closeTerminal}
      />
    </div>
  );
}

export default function DashboardLayoutWithTerminal({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TerminalProvider>
      <ChatProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </ChatProvider>
    </TerminalProvider>
  );
}
