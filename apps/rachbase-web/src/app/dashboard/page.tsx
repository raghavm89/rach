'use client';

import { useAuth } from '@rach/ui/contexts/AuthContext';
import { Monitor, CreditCard, User } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@rach/ui/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();

  const cards = [
    ...(user?.role === 'admin' ? [{
      title: 'Monitoring',
      description: 'View real-time CPU, memory, and uptime for all VMs across the cluster.',
      href: '/dashboard/monitoring',
      icon: <Monitor size={22} />,
      gradient: true,
    }] : []),
    {
      title: 'Billing',
      description: 'Manage your subscription, view invoices, and update payment details.',
      href: '/dashboard/billing',
      icon: <CreditCard size={22} />,
      gradient: false,
    },
    {
      title: 'Profile',
      description: 'Update your account information and security settings.',
      href: '/dashboard/profile',
      icon: <User size={22} />,
      gradient: false,
    },
  ];

  return (
    <div className="max-w-4xl">
      {/* Welcome */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold font-display text-text-primary">
          Welcome back, {user?.name.split(' ')[0]} 👋
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Here&apos;s an overview of your account.
        </p>
      </div>

      {/* Quick access cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={cn(
              'group relative flex flex-col gap-3 rounded-xl border border-neutral-border bg-surface-card p-6 transition-all duration-200',
              'hover:-translate-y-1 hover:shadow-md',
            )}
          >
            {/* Gradient accent top line */}
            <div
              className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{ background: 'var(--gradient-cta)' }}
            />
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                card.gradient
                  ? 'bg-gradient-to-br from-primary-blue to-primary-purple text-white'
                  : 'bg-bg-secondary text-text-secondary',
              )}
            >
              {card.icon}
            </div>
            <div>
              <p className="font-semibold text-text-primary">{card.title}</p>
              <p className="mt-1 text-xs text-text-muted leading-relaxed">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
