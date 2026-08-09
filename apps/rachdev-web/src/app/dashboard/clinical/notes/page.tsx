'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ArrowLeft, ShieldCheck, FileText } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { scribe, type ClinicalNote, type ClinicalNoteSummary, type SoapNote, type CodeSuggestion } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';

const SOAP_FIELDS: { key: keyof SoapNote; label: string }[] = [
  { key: 'subjective', label: 'Subjective' },
  { key: 'objective', label: 'Objective' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'plan', label: 'Plan' },
];

/**
 * Read-only doctors' notes for Reception. Reception can view completed clinical
 * notes but not author or sign them (enforced by the backend routes too).
 */
export default function DoctorNotesPage() {
  const { token } = useAuth();
  const [notes, setNotes] = useState<ClinicalNoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try { const { notes } = await scribe.list(token); setNotes(notes); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  if (openId != null && token) return <NoteView id={openId} token={token} onBack={() => setOpenId(null)} />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Doctor Notes" subtitle="View clinical notes authored by doctors (read-only)" />
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-border bg-surface-card">
          {notes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-dash-muted">No notes yet.</p>
          ) : notes.map((n) => (
            <button key={n.id} onClick={() => setOpenId(n.id)} className="flex w-full items-center justify-between gap-3 border-b border-neutral-border px-5 py-3 text-left last:border-0 hover:bg-surface-hover">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-dash-heading">{n.patient_ref || 'Unlabelled patient'}</p>
                <p className="truncate text-xs text-dash-muted">{(n as any).preview || '—'}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${n.status === 'signed' ? 'bg-ok-bg text-ok' : 'bg-wait-bg text-wait'}`}>
                {n.status === 'signed' ? 'Signed' : 'Draft'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteView({ id, token, onBack }: { id: number; token: string; onBack: () => void }) {
  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { scribe.get(token, id).then((r: { note: ClinicalNote }) => setNote(r.note)).finally(() => setLoading(false)); }, [token, id]);

  if (loading || !note) return <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-muted hover:text-dash-heading"><ArrowLeft size={15} /> Back to notes</button>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-dash-heading"><FileText size={18} /> {note.patient_ref || 'Clinical note'}</h2>
          <p className="text-xs text-dash-muted">{note.model ? `Drafted by ${note.model}. ` : ''}{note.signed_at ? `Signed ${new Date(note.signed_at).toLocaleString()}` : 'Draft'}</p>
        </div>
        {note.status === 'signed' && <span className="inline-flex items-center gap-1 rounded-full border border-ok-line bg-ok-bg px-2.5 py-0.5 text-xs font-semibold text-ok"><ShieldCheck size={12} /> Signed</span>}
      </div>

      <div className="space-y-3">
        {SOAP_FIELDS.map((f) => (
          <div key={String(f.key)} className="rounded-xl border border-neutral-border bg-surface-card p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-dash-muted">{f.label}</p>
            <p className="whitespace-pre-wrap text-sm text-dash-heading">{note.soap[f.key] || <span className="text-dash-muted">—</span>}</p>
          </div>
        ))}
        {note.codes.length > 0 && (
          <div className="rounded-xl border border-neutral-border bg-surface-card p-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-dash-muted">Codes</p>
            <div className="flex flex-wrap gap-2">
              {note.codes.map((c: CodeSuggestion, i: number) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-md border border-neutral-border bg-surface-hover px-2 py-1 text-xs text-dash-body">
                  <span className="font-semibold text-dash-heading">{c.code}</span> <span className="text-dash-muted">{c.system}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
