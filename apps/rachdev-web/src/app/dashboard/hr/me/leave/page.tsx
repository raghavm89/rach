'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useMySpace } from '@/lib/hr/useMySpace';
import { Pill, CARD, INPUT, BTN } from '@/components/dashboard/hr/bits';
import { LEAVE_TYPE_LABELS, formatDate, type LeaveTypeKey, type LeaveStatus } from '@/lib/hr/demo';

const TYPES: LeaveTypeKey[] = ['casual', 'sick', 'earned'];
const STATUS_CLASS: Record<LeaveStatus, string> = {
  approved: 'bg-ok-bg text-ok', pending: 'bg-amber-50 text-amber-600',
  rejected: 'bg-red-50 text-red-600', cancelled: 'bg-surface-hover text-dash-muted',
};

export default function MyLeavePage() {
  const { token } = useAuth();
  const { leave, balance, loading, error, reload } = useMySpace();
  const [type, setType] = useState<LeaveTypeKey>('casual');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!token) return; setBusy(true);
    try {
      const r = await hr.applyLeave({ type, from, to: to || from, reason: reason.trim() || undefined }, token);
      toast.success(`Applied — ${r.workingDays} working day(s), pending approval`);
      setFrom(''); setTo(''); setReason(''); await reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/hr/me" className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-muted hover:text-accent"><ArrowLeft size={15} /> My Space</Link>
      <PageHeader title="My leave" subtitle="Apply for leave — weekends and holidays are excluded automatically. Requests go to HR for approval." />
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      {/* Apply form */}
      <div className={`${CARD} mt-6 p-5`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-[12px] font-medium text-dash-heading">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as LeaveTypeKey)} className={`${INPUT} mt-1`}>
              {TYPES.map((t) => {
                const b = balance?.balances[t];
                const avail = b ? b.entitled - b.used : 0;
                return <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]} ({avail} left)</option>;
              })}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-dash-heading">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${INPUT} mt-1`} />
          </div>
          <div>
            <label className="text-[12px] font-medium text-dash-heading">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${INPUT} mt-1`} />
          </div>
        </div>
        <label className="mt-3 block text-[12px] font-medium text-dash-heading">Reason (optional)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={`${INPUT} mt-1`} placeholder="e.g. family function" />
        <button className={`${BTN} mt-4`} disabled={!from || busy} onClick={apply}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : null} Apply for leave
        </button>
      </div>

      {/* History */}
      <h3 className="mb-3 mt-8 text-sm font-semibold text-dash-heading">My requests</h3>
      <div className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <table className="w-full text-sm">
          <tbody>
            {loading ? <tr><td className="px-5 py-8 text-center text-dash-muted">Loading…</td></tr>
              : leave.length === 0 ? <tr><td className="px-5 py-8 text-center text-dash-muted">No leave requests yet.</td></tr>
                : leave.map((l) => (
                  <tr key={l.id} className="border-b border-neutral-border last:border-0">
                    <td className="px-5 py-3 text-dash-body">{LEAVE_TYPE_LABELS[l.type]}</td>
                    <td className="px-3 py-3 text-[12px] text-dash-muted">{formatDate(l.from)}{l.from !== l.to ? ` → ${formatDate(l.to)}` : ''}</td>
                    <td className="px-3 py-3 text-dash-body">{l.workingDays}d</td>
                    <td className="px-5 py-3 text-right"><Pill className={STATUS_CLASS[l.status]}>{l.status}</Pill></td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
