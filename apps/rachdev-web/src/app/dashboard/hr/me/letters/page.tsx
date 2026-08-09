'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useMySpace } from '@/lib/hr/useMySpace';
import { Pill, IdChip, CARD, INPUT, BTN } from '@/components/dashboard/hr/bits';
import { LETTER_KIND_LABELS, LETTER_STATUS_LABELS, formatDate, type Letter, type LetterStatus, type LetterKind } from '@/lib/hr/demo';

const STATUS_CLASS: Record<LetterStatus, string> = {
  issued: 'bg-ok-bg text-ok', pending_approval: 'bg-amber-50 text-amber-600',
  requested: 'bg-surface-hover text-dash-muted', rejected: 'bg-red-50 text-red-600',
};
// Employees can self-request these two; confirmation is HR-issued at probation end.
const KINDS: LetterKind[] = ['employment_verification', 'address_proof'];

export default function MyLettersPage() {
  const { token } = useAuth();
  const { letters, loading, error, reload } = useMySpace();
  const [kind, setKind] = useState<LetterKind>('employment_verification');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Letter | null>(null);

  async function request() {
    if (!token) return; setBusy(true);
    try {
      await hr.requestLetter({ kind, note: note.trim() || undefined }, token);
      toast.success('Requested — HR will review and issue');
      setNote(''); await reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/hr/me" className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-muted hover:text-accent"><ArrowLeft size={15} /> My Space</Link>
      <PageHeader title="My letters" subtitle="Request an employment or address-proof letter. HR reviews the AI-drafted letter before it's issued to you." />
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className={`${CARD} mt-6 p-5`}>
        <label className="text-[12px] font-medium text-dash-heading">Letter type</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as LetterKind)} className={`${INPUT} mt-1`}>
          {KINDS.map((k) => <option key={k} value={k}>{LETTER_KIND_LABELS[k]}</option>)}
        </select>
        <label className="mt-3 block text-[12px] font-medium text-dash-heading">Purpose (optional)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={`${INPUT} mt-1`} placeholder="e.g. for a rental agreement" />
        <button className={`${BTN} mt-4`} disabled={busy} onClick={request}>{busy ? <Loader2 size={15} className="animate-spin" /> : null} Request letter</button>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold text-dash-heading">My letters</h3>
      <div className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <table className="w-full text-sm">
          <tbody>
            {loading ? <tr><td className="px-5 py-8 text-center text-dash-muted">Loading…</td></tr>
              : letters.length === 0 ? <tr><td className="px-5 py-8 text-center text-dash-muted">No letters yet.</td></tr>
                : letters.map((l) => (
                  <tr key={l.id} className="cursor-pointer border-b border-neutral-border last:border-0 hover:bg-surface-hover" onClick={() => l.status === 'issued' && setOpen(l)}>
                    <td className="px-5 py-3 font-medium text-dash-heading">{LETTER_KIND_LABELS[l.kind]}</td>
                    <td className="px-3 py-3"><IdChip id={l.serial} /></td>
                    <td className="px-3 py-3 text-[11px] text-dash-muted">{formatDate(l.requestedAt)}</td>
                    <td className="px-5 py-3 text-right"><Pill className={STATUS_CLASS[l.status]}>{LETTER_STATUS_LABELS[l.status]}</Pill></td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-dash-muted">Issued letters are clickable to view.</p>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(null)}>
          <div className={`${CARD} max-h-[80vh] w-full max-w-2xl overflow-auto p-5`} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-dash-heading">{LETTER_KIND_LABELS[open.kind]} · <span className="font-mono text-[12px] text-dash-muted">{open.serial}</span></h3>
              <button onClick={() => setOpen(null)} className="text-dash-muted hover:text-dash-heading"><X size={18} /></button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-dash-body">{open.body}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
