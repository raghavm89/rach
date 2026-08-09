'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Route, Search, AlertCircle, CalendarClock, Pill, FileText, LogIn, LogOut, ArrowRight } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { opd, journey, type Patient, type PatientJourney, type JourneyStep, type Medication } from '@rach/ui/lib/api';

const DECISION_CLS: Record<string, string> = {
  created: 'bg-surface-hover text-dash-body', confirmed: 'bg-wait-bg text-wait', modified: 'bg-wait-bg text-wait',
  signed: 'bg-ok-bg text-ok', assigned: 'bg-accent-weak text-accent', completed: 'bg-ok-bg text-ok',
  cancelled: 'bg-surface-hover text-dash-muted', overridden: 'bg-red-50 text-red-600', flagged: 'bg-red-50 text-red-600', consent: 'bg-accent-weak text-accent',
};

// Solid node colour for the flow (governance-meaningful).
function nodeColor(decision: string | null, first: boolean, last: boolean): string {
  if (first) return 'bg-accent';
  if (decision === 'flagged' || decision === 'overridden' || decision === 'cancelled') return 'bg-red-500';
  if (decision === 'signed' || decision === 'completed') return 'bg-ok';
  if (decision && ['assigned', 'consent', 'confirmed', 'modified'].includes(decision)) return 'bg-accent';
  if (last) return 'bg-ok';
  return 'bg-dash-muted';
}

export default function JourneyPage() {
  const { token } = useAuth();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [data, setData] = useState<PatientJourney | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (patientId: number) => {
    if (!token) return;
    setLoading(true); setError(''); setResults([]);
    try { setData(await journey.get(token, patientId)); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [token]);

  // Deep-link: /journey?patient=<id>
  useEffect(() => { const id = params?.get('patient'); if (id && token) load(Number(id)); }, [params, token, load]);

  const search = async () => {
    if (!token || !q.trim()) return;
    try { const { patients } = await opd.searchPatients(token, q.trim()); setResults(patients); } catch (e) { setError((e as Error).message); }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-xl font-semibold text-dash-heading">Patient Journey</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-weak px-2.5 py-0.5 text-xs font-semibold text-accent"><Route size={12} /> step-in → step-out</span>
      </div>

      <div className="mb-5 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search patient — name, HID, service no. or phone" className="w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
        <button onClick={search} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"><Search size={15} /></button>
      </div>
      {results.length > 0 && (
        <div className="mb-5 space-y-1">
          {results.map((p) => <button key={p.id} onClick={() => load(p.id)} className="flex w-full items-center justify-between rounded-lg border border-neutral-border px-3 py-2 text-left text-sm hover:bg-surface-hover"><span className="font-medium text-dash-heading">{p.name}</span><span className="text-xs text-dash-muted">{p.uhid}{p.phone ? ` · ${p.phone}` : ''}</span></button>)}
        </div>
      )}

      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle size={15} /> {error}</div>}
      {loading && <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>}

      {data && !loading && (
        <>
          {/* Patient + next steps */}
          <div className="mb-6 rounded-2xl border border-neutral-border bg-surface-card p-5">
            <div className="flex items-center justify-between">
              <div><span className="text-lg font-semibold text-dash-heading">{data.patient.name}</span> <span className="text-xs text-dash-muted">HID {data.patient.uhid}{data.patient.age ? ` · ${data.patient.age}` : ''}{data.patient.sex ? ` · ${data.patient.sex}` : ''}</span></div>
            </div>

            <div className="mt-3 rounded-xl border border-accent-weak bg-accent-weak/40 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-accent"><ArrowRight size={15} /> Next steps for the patient</p>
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dash-muted"><CalendarClock size={12} /> Follow-up</p>
                  {data.next.follow_up ? <p className="mt-0.5 text-dash-heading">{fmt(data.next.follow_up.appointment_at)}{data.next.follow_up.department ? ` · ${data.next.follow_up.department}` : ''}</p> : <p className="mt-0.5 text-dash-muted">None scheduled</p>}
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dash-muted"><Pill size={12} /> Medications</p>
                  {data.next.medications.length ? <p className="mt-0.5 text-dash-heading">{data.next.medications.map((m: Medication) => m.drug).join(', ')}</p> : <p className="mt-0.5 text-dash-muted">None recorded</p>}
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dash-muted"><FileText size={12} /> Advice</p>
                  {data.next.discharge ? <p className="mt-0.5 text-dash-body">{data.next.discharge.summary.follow_up || data.next.discharge.summary.advice || '—'}</p> : <p className="mt-0.5 text-dash-muted">No discharge yet</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline — connected flow */}
          <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
            <h3 className="mb-5 text-sm font-semibold text-dash-heading">Journey</h3>
            {data.timeline.length === 0 ? (
              <p className="text-sm text-dash-muted">No recorded events yet for this patient.</p>
            ) : (
              <div className="relative">
                {data.timeline.map((s: JourneyStep, i: number) => {
                  const first = i === 0, last = i === data.timeline.length - 1;
                  return (
                    <div key={i} className="relative flex gap-4 pb-5 last:pb-0">
                      {/* running connector line */}
                      {!last && <span className="absolute left-[19px] top-11 bottom-0 w-0.5 bg-neutral-border" aria-hidden />}
                      {/* node */}
                      <div className={'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ' + nodeColor(s.decision, first, last)}>
                        {(s.agent ?? 'S').slice(0, 1)}
                      </div>
                      {/* card */}
                      <div className="flex-1 rounded-xl border border-neutral-border bg-surface-app px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {first && <span className="inline-flex items-center gap-1 rounded-full bg-accent-weak px-2 py-0.5 text-[10px] font-semibold text-accent"><LogIn size={10} /> Step in</span>}
                          {last && !first && <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-[10px] font-semibold text-ok"><LogOut size={10} /> Latest</span>}
                          <span className="text-sm font-semibold text-dash-heading">{s.agent ?? 'System'}</span>
                          <span className="text-sm text-dash-body">{s.action}</span>
                          {s.decision && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${DECISION_CLS[s.decision] ?? 'bg-surface-hover text-dash-body'}`}>{s.decision}</span>}
                        </div>
                        <div className="mt-0.5 text-xs text-dash-muted">{fmt(s.created_at)}{s.actor_name ? ` · ${s.actor_name}` : ''}{s.source ? ` · ${s.source}` : ''}</div>
                        {s.summary && <p className="mt-1 text-xs text-dash-body">{s.summary}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
