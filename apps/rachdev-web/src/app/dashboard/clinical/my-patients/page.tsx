'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, AlertCircle, CalendarClock, Users } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { opd, type Visit, type VisitDetail } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { STATUS, TokenSlip, VisitDetailModal } from '@/components/clinical/VisitDetailModal';

// A doctor's own patient list, grouped by where the patient is in their journey.
const GROUPS: { key: Visit['status'][]; label: string }[] = [
  { key: ['scheduled'], label: 'Scheduled' },
  { key: ['waiting'], label: 'Waiting' },
  { key: ['in_consultation'], label: 'In consultation' },
  { key: ['completed', 'cancelled'], label: 'Closed today' },
];

export default function MyPatientsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailId, setDetailId] = useState<number | null>(null);
  const [slip, setSlip] = useState<Visit | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try { const { visits } = await opd.visits(token, 'all', true); setVisits(visits); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  // Hand a patient off to Scribe with the patient + visit pre-filled, so the note
  // links back to THIS visit (required before the visit can be completed).
  const openScribe = (v: VisitDetail | Visit) => {
    try {
      sessionStorage.setItem('rachdev_scribe_prefill', JSON.stringify({ transcript: '', patient_ref: v.uhid || v.patient_name || '', visit_id: v.id }));
    } catch { /* ignore */ }
    router.push('/dashboard/clinical/scribe');
  };

  const active = visits.filter((v) => v.status !== 'completed' && v.status !== 'cancelled');

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="My Patients" subtitle="Patients assigned or scheduled to you — click one to see details and record notes" />

      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle size={15} /> {error}</div>}

      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-dash-muted"><Users size={15} /> {active.length} active {active.length === 1 ? 'patient' : 'patients'}</p>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-xs text-dash-muted hover:text-dash-heading"><RefreshCw size={13} /> Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : visits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-border bg-surface-card px-6 py-16 text-center">
          <CalendarClock size={26} className="mx-auto mb-2 text-dash-muted" />
          <p className="text-sm font-medium text-dash-heading">No patients assigned yet</p>
          <p className="mt-1 text-xs text-dash-muted">Reception assigns patients to you; they&apos;ll appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((g) => {
            const items = visits.filter((v) => g.key.includes(v.status));
            if (items.length === 0) return null;
            return (
              <div key={g.label} className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
                <div className="border-b border-neutral-border px-5 py-3 text-sm font-semibold text-dash-heading">{g.label} <span className="font-normal text-dash-muted">({items.length})</span></div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-neutral-border text-left text-xs uppercase tracking-wide text-dash-muted">
                    {['Token', 'Patient', 'Department', 'Scheduled', 'Reason', 'Status'].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {items.map((v) => (
                      <tr key={v.id} onClick={() => setDetailId(v.id)} className="cursor-pointer border-b border-neutral-border last:border-0 hover:bg-surface-hover">
                        <td className="px-4 py-3 font-semibold text-dash-heading">#{v.token_no ?? '—'}</td>
                        <td className="px-4 py-3"><div className="font-medium text-dash-heading">{v.patient_name}</div><div className="text-xs text-dash-muted">{v.uhid}</div></td>
                        <td className="px-4 py-3 text-dash-body">{v.department || '—'}</td>
                        <td className="px-4 py-3 text-dash-body">{v.appointment_at ? new Date(v.appointment_at).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : <span className="text-dash-muted">Walk-in</span>}</td>
                        <td className="px-4 py-3 text-dash-body">{v.reason || '—'}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[v.status].cls}`}>{STATUS[v.status].label}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {slip && <TokenSlip visit={slip} onClose={() => setSlip(null)} />}
      {detailId !== null && token && (
        <VisitDetailModal token={token} visitId={detailId} onClose={() => setDetailId(null)} onChanged={load} onPrint={setSlip} canAssign={false} onOpenScribe={openScribe} />
      )}
    </div>
  );
}
