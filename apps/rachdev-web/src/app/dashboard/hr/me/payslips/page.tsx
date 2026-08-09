'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useMySpace } from '@/lib/hr/useMySpace';
import { formatMonth, formatINR } from '@/lib/hr/demo';

export default function MyPayslipsPage() {
  const { payslips, loading, error } = useMySpace();
  const sorted = [...payslips].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/hr/me" className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-muted hover:text-accent"><ArrowLeft size={15} /> My Space</Link>
      <PageHeader title="My payslips" subtitle="Monthly payslip records. Metadata only — no payroll is calculated here (simulated distribution)." />
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-border text-left text-xs text-dash-muted">
              <th className="px-5 py-2.5 font-medium">Month</th>
              <th className="px-3 py-2.5 font-medium">Gross</th>
              <th className="px-3 py-2.5 font-medium">Net</th>
              <th className="px-5 py-2.5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="px-5 py-8 text-center text-dash-muted">Loading…</td></tr>
              : sorted.length === 0 ? <tr><td colSpan={4} className="px-5 py-8 text-center text-dash-muted">No payslips yet.</td></tr>
                : sorted.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-border last:border-0">
                    <td className="px-5 py-3 font-medium text-dash-heading">{formatMonth(p.month)}</td>
                    <td className="px-3 py-3 text-dash-body">{formatINR(p.grossINR)}</td>
                    <td className="px-3 py-3 text-dash-body">{formatINR(p.netINR)}</td>
                    <td className="px-5 py-3 text-right text-[11px] text-dash-muted">{p.status}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
