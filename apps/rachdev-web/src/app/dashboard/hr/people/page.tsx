'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Search } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import { Pill, IdChip } from '@/components/dashboard/hr/bits';
import {
  EMPLOYEE_STATUS_LABELS, formatDate, type Employee, type EmployeeStatus,
} from '@/lib/hr/demo';

const STATUS_CLASS: Record<EmployeeStatus, string> = {
  probation: 'bg-amber-50 text-amber-600',
  confirmed: 'bg-ok-bg text-ok',
  exited: 'bg-surface-hover text-dash-muted',
};

export default function HrPeoplePage() {
  const { get, loading, error, reload, setLoading } = useHr(['employees']);
  const employees = get<Employee>('employees');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('all');
  const [status, setStatus] = useState('all');

  const depts = useMemo(() => Array.from(new Set(employees.map((e) => e.dept))).sort(), [employees]);
  const visible = employees.filter((e) => {
    if (dept !== 'all' && e.dept !== dept) return false;
    if (status !== 'all' && e.status !== status) return false;
    if (q && !`${e.name} ${e.empCode} ${e.title}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const sel = 'rounded-lg border border-neutral-border bg-surface-app px-2 py-1.5 text-sm text-dash-body focus:border-accent focus:outline-none';

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="People"
        subtitle="The employee directory across the lifecycle — onboarding, probation, and confirmed. Click a person for their full record."
        actions={
          <button onClick={() => { setLoading(true); reload(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dash-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code, title…"
            className="w-full rounded-lg border border-neutral-border bg-surface-app py-1.5 pl-9 pr-3 text-sm text-dash-body focus:border-accent focus:outline-none" />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className={sel}>
          <option value="all">All departments</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
          <option value="all">All statuses</option>
          {Object.entries(EMPLOYEE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-border text-left text-xs text-dash-muted">
              <th className="px-5 py-2.5 font-medium">Employee</th>
              <th className="px-3 py-2.5 font-medium">Title</th>
              <th className="px-3 py-2.5 font-medium">Department</th>
              <th className="px-3 py-2.5 font-medium">Manager</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 text-right font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-dash-muted">Loading…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-dash-muted">No employees match.</td></tr>
            ) : visible.map((e) => (
              <tr key={e.id} className="border-b border-neutral-border last:border-0 hover:bg-surface-hover">
                <td className="px-5 py-3">
                  <Link href={`/dashboard/hr/people/${e.id}`} className="block">
                    <span className="font-medium text-dash-heading hover:text-accent">{e.name}</span>
                    <span className="ml-2"><IdChip id={e.empCode} /></span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-dash-body">{e.title}</td>
                <td className="px-3 py-3 text-dash-body">{e.dept}</td>
                <td className="px-3 py-3 text-dash-muted">{e.managerName}</td>
                <td className="px-3 py-3"><Pill className={STATUS_CLASS[e.status]}>{EMPLOYEE_STATUS_LABELS[e.status]}</Pill></td>
                <td className="px-5 py-3 text-right text-[11px] text-dash-muted">{formatDate(e.joinDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
