'use client';

import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import { Pill, IdChip, CARD } from '@/components/dashboard/hr/bits';
import {
  LETTER_KIND_LABELS, LETTER_STATUS_LABELS, formatDate,
  type Letter, type Employee, type LetterStatus,
} from '@/lib/hr/demo';

const STATUS_CLASS: Record<LetterStatus, string> = {
  issued: 'bg-ok-bg text-ok', pending_approval: 'bg-amber-50 text-amber-600',
  requested: 'bg-surface-hover text-dash-muted', rejected: 'bg-red-50 text-red-600',
};

export default function HrLettersPage() {
  const { get, loading, error, reload, setLoading } = useHr(['letters', 'employees']);
  const letters = get<Letter>('letters');
  const empMap = new Map(get<Employee>('employees').map((e) => [e.id, e]));
  const [open, setOpen] = useState<Letter | null>(null);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Letters"
        subtitle="Employment, address-proof and confirmation letters. Every letter is an AI draft that issues only after HR approval in the Approvals inbox."
        actions={<button onClick={() => { setLoading(true); reload(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>}
      />
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-border text-left text-xs text-dash-muted">
              <th className="px-5 py-2.5 font-medium">Employee</th>
              <th className="px-3 py-2.5 font-medium">Kind</th>
              <th className="px-3 py-2.5 font-medium">Serial</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 text-right font-medium">Requested</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-5 py-8 text-center text-dash-muted">Loading…</td></tr>
              : letters.length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center text-dash-muted">No letters yet.</td></tr>
                : letters.map((l) => (
                  <tr key={l.id} className="cursor-pointer border-b border-neutral-border last:border-0 hover:bg-surface-hover" onClick={() => setOpen(l)}>
                    <td className="px-5 py-3 font-medium text-dash-heading">{empMap.get(l.employeeId)?.name ?? l.employeeId}</td>
                    <td className="px-3 py-3 text-dash-body">{LETTER_KIND_LABELS[l.kind]}</td>
                    <td className="px-3 py-3"><IdChip id={l.serial} /></td>
                    <td className="px-3 py-3"><Pill className={STATUS_CLASS[l.status]}>{LETTER_STATUS_LABELS[l.status]}</Pill></td>
                    <td className="px-5 py-3 text-right text-[11px] text-dash-muted">{formatDate(l.requestedAt)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(null)}>
          <div className={`${CARD} max-h-[80vh] w-full max-w-2xl overflow-auto p-5`} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-dash-heading">{LETTER_KIND_LABELS[open.kind]} · <span className="font-mono text-[12px] text-dash-muted">{open.serial}</span></h3>
              <button onClick={() => setOpen(null)} className="text-dash-muted hover:text-dash-heading"><X size={18} /></button>
            </div>
            {open.body ? <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-dash-body">{open.body}</pre> : <p className="text-sm text-dash-muted">No body drafted.</p>}
            {open.issuedByName && <p className="mt-3 text-[11px] text-dash-muted">Issued by {open.issuedByName}{open.issuedAt ? ` · ${formatDate(open.issuedAt)}` : ''}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
