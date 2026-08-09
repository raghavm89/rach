'use client';

import Link from 'next/link';
import { Luggage, Receipt, MailOpen, MessageCircleQuestion, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useMySpace } from '@/lib/hr/useMySpace';
import { Pill, IdChip, CARD } from '@/components/dashboard/hr/bits';
import { EMPLOYEE_STATUS_LABELS, LEAVE_TYPE_LABELS, formatDate, type LeaveTypeKey } from '@/lib/hr/demo';

const TYPES: LeaveTypeKey[] = ['casual', 'sick', 'earned'];
const LINKS = [
  { href: '/dashboard/hr/me/leave', label: 'My leave', icon: Luggage },
  { href: '/dashboard/hr/me/payslips', label: 'My payslips', icon: Receipt },
  { href: '/dashboard/hr/me/letters', label: 'My letters', icon: MailOpen },
  { href: '/dashboard/hr/me/ask', label: 'Ask HR', icon: MessageCircleQuestion },
];

export default function MyProfilePage() {
  const { employee: e, balance, loading, error } = useMySpace();

  if (loading) return <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  if (error) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>;
  if (!e) return <p className="text-sm text-dash-muted">No employee record is linked to your account yet. Ask HR to set one up.</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My Space" subtitle="Your profile, leave, payslips, letters and a direct line to People Ops." />

      <div className={`${CARD} mt-6 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-dash-heading">{e.name}</h2>
              <IdChip id={e.empCode} />
            </div>
            <p className="mt-0.5 text-sm text-dash-body">{e.title} · {e.dept}</p>
            <p className="mt-0.5 text-[12px] text-dash-muted">Manager: {e.managerName} · {e.location} · Joined {formatDate(e.joinDate)}</p>
          </div>
          <Pill className={e.status === 'confirmed' ? 'bg-ok-bg text-ok' : e.status === 'probation' ? 'bg-amber-50 text-amber-600' : 'bg-surface-hover text-dash-muted'}>
            {EMPLOYEE_STATUS_LABELS[e.status]}
          </Pill>
        </div>
      </div>

      {balance && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {TYPES.map((t) => {
            const b = balance.balances[t];
            const avail = b ? b.entitled - b.used : 0;
            return (
              <div key={t} className={`${CARD} p-4`}>
                <p className="text-[11px] uppercase tracking-wide text-dash-muted">{LEAVE_TYPE_LABELS[t]}</p>
                <p className="mt-1 text-2xl font-semibold text-dash-heading">{avail}<span className="text-[12px] text-dash-muted"> / {b?.entitled ?? 0} days</span></p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`${CARD} flex items-center gap-3 p-4 hover:border-accent/50`}>
            <l.icon size={18} className="text-accent" />
            <span className="text-sm font-medium text-dash-heading">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
