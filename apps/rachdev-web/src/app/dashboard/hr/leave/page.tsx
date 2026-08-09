'use client';

import { RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import { Pill } from '@/components/dashboard/hr/bits';
import {
  LEAVE_TYPE_LABELS, formatDate,
  type LeaveRequest, type LeaveBalance, type Employee, type LeaveStatus, type LeaveTypeKey,
} from '@/lib/hr/demo';

const STATUS_CLASS: Record<LeaveStatus, string> = {
  approved: 'bg-ok-bg text-ok', pending: 'bg-amber-50 text-amber-600',
  rejected: 'bg-red-50 text-red-600', cancelled: 'bg-surface-hover text-dash-muted',
};
const TYPES: LeaveTypeKey[] = ['casual', 'sick', 'earned'];

export default function HrLeavePage() {
  const { get, loading, error, reload, setLoading } = useHr(['leave', 'leave_balances', 'employees']);
  const requests = get<LeaveRequest>('leave');
  const balances = get<LeaveBalance>('leave_balances');
  const empMap = new Map(get<Employee>('employees').map((e) => [e.id, e]));
  const name = (id: string) => empMap.get(id)?.name ?? id;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Leave"
        subtitle="Working-day math (weekends + holidays excluded) is deterministic policy. Requests route to Approvals; balances update on approval."
        actions={<button onClick={() => { setLoading(true); reload(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>}
      />
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <h3 className="mb-3 mt-6 text-sm font-semibold text-dash-heading">Requests</h3>
      <div className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-border text-left text-xs text-dash-muted">
              <th className="px-5 py-2.5 font-medium">Employee</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium">Dates</th>
              <th className="px-3 py-2.5 font-medium">Days</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 text-right font-medium">Applied</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-5 py-8 text-center text-dash-muted">Loading…</td></tr>
              : requests.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-dash-muted">No leave requests.</td></tr>
                : requests.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-border last:border-0">
                    <td className="px-5 py-3 font-medium text-dash-heading">{name(r.employeeId)}</td>
                    <td className="px-3 py-3 text-dash-body">{LEAVE_TYPE_LABELS[r.type]}</td>
                    <td className="px-3 py-3 text-[12px] text-dash-muted">{formatDate(r.from)}{r.from !== r.to ? ` → ${formatDate(r.to)}` : ''}</td>
                    <td className="px-3 py-3 text-dash-body">{r.workingDays}</td>
                    <td className="px-3 py-3"><Pill className={STATUS_CLASS[r.status]}>{r.status}</Pill></td>
                    <td className="px-5 py-3 text-right text-[11px] text-dash-muted">{formatDate(r.appliedAt)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold text-dash-heading">Balances</h3>
      <div className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-border text-left text-xs text-dash-muted">
              <th className="px-5 py-2.5 font-medium">Employee</th>
              {TYPES.map((t) => <th key={t} className="px-3 py-2.5 font-medium">{LEAVE_TYPE_LABELS[t]}</th>)}
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.employeeId} className="border-b border-neutral-border last:border-0">
                <td className="px-5 py-3 font-medium text-dash-heading">{name(b.employeeId)}</td>
                {TYPES.map((t) => {
                  const bucket = b.balances[t];
                  const avail = bucket ? bucket.entitled - bucket.used : 0;
                  return <td key={t} className="px-3 py-3 text-dash-body">{avail}<span className="text-[11px] text-dash-muted"> / {bucket?.entitled ?? 0}</span></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
