'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Siren, Sparkles, AlertCircle, Check, Activity, ArrowRight, RefreshCw, Flag } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { triage, type TriageAssessment } from '@rach/ui/lib/api';

const ACUITY_CLS: Record<string, string> = {
  critical: 'bg-red-50 text-red-600 border-red-200',
  urgent: 'bg-wait-bg text-wait border-wait-bg',
  'semi-urgent': 'bg-accent-weak text-accent border-accent-weak',
  routine: 'bg-ok-bg text-ok border-ok-line',
};
const ROUTES = ['ER', 'ICU', 'OPD', 'specialist'];

export default function TriagePage() {
  const { token, user } = useAuth();
  // Assessing acuity is front-desk; acknowledging & routing is a clinician decision.
  const canAcknowledge = !!user && ['doctor', 'tenant_admin', 'admin'].includes(user.role);
  const [presentation, setPresentation] = useState('');
  const [vitals, setVitals] = useState('');
  const [patientRef, setPatientRef] = useState('');
  const [a, setA] = useState<TriageAssessment | null>(null);
  const [busy, setBusy] = useState(false);
  const [ackBusy, setAckBusy] = useState(false);
  const [error, setError] = useState('');
  const [list, setList] = useState<TriageAssessment[]>([]);

  const loadList = useCallback(async () => {
    if (!token) return;
    try { const { assessments } = await triage.list(token); setList(assessments); } catch { /* non-fatal */ }
  }, [token]);
  useEffect(() => { loadList(); }, [loadList]);

  const assess = async () => {
    if (!token || !presentation.trim()) return;
    setBusy(true); setError(''); setA(null);
    try {
      const { assessment } = await triage.create(token, { presentation: presentation.trim(), vitals: vitals.trim() || undefined, patient_ref: patientRef.trim() || undefined });
      setA(assessment); loadList();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const acknowledge = async (route?: string) => {
    if (!token || !a) return;
    setAckBusy(true); setError('');
    try { const { assessment } = await triage.acknowledge(token, a.id, route); setA(assessment); loadList(); }
    catch (e) { setError((e as Error).message); } finally { setAckBusy(false); }
  };
  const open = async (id: number) => {
    if (!token) return;
    try { const { assessment } = await triage.get(token, id); setA(assessment); setPresentation(assessment.presentation || ''); setVitals(assessment.vitals || ''); }
    catch (e) { setError((e as Error).message); }
  };

  const inputCls = 'w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none';
  const acked = a?.status === 'acknowledged';

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-xl font-semibold text-dash-heading">Triage</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-weak px-2.5 py-0.5 text-xs font-semibold text-accent"><Siren size={12} /> Vihaan</span>
        <span className="hidden text-sm text-dash-muted sm:inline">Presentation → acuity, red flags & routing → clinician acknowledges</span>
      </div>

      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle size={15} /> {error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
          <input value={patientRef} onChange={(e) => setPatientRef(e.target.value)} placeholder="Patient (HID or name) — optional" className={`${inputCls} mb-3`} />
          <label className="mb-1 block text-sm font-medium text-dash-heading">Presenting complaint</label>
          <textarea value={presentation} onChange={(e) => setPresentation(e.target.value)} rows={7} placeholder="e.g. 24M evacuated from 5,400m, breathless, SpO2 60%, confusion…" className={`${inputCls} resize-y`} />
          <label className="mb-1 mt-3 block text-sm font-medium text-dash-heading">Vitals <span className="font-normal text-dash-muted">(optional)</span></label>
          <input value={vitals} onChange={(e) => setVitals(e.target.value)} placeholder="BP 90/60 · HR 120 · RR 30 · SpO2 60% · T 37" className={inputCls} />
          <button onClick={assess} disabled={busy || !presentation.trim()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {busy ? 'Assessing…' : 'Assess acuity'}
          </button>

          {/* Recent */}
          <div className="mt-6 border-t border-neutral-border pt-4">
            <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-dash-muted">Recent</p><button onClick={loadList} className="text-dash-muted hover:text-dash-heading"><RefreshCw size={13} /></button></div>
            <div className="space-y-1">
              {list.slice(0, 6).map((x) => (
                <button key={x.id} onClick={() => open(x.id)} className="flex w-full items-center justify-between rounded-lg border border-neutral-border px-3 py-1.5 text-left text-xs hover:bg-surface-hover">
                  <span className="truncate text-dash-body">{x.patient_ref || 'Unnamed'} · <span className="text-dash-muted">{x.recommended_route}</span></span>
                  <span className={`ml-2 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${ACUITY_CLS[x.acuity ?? 'routine']}`}>{x.acuity}</span>
                </button>
              ))}
              {list.length === 0 && <p className="text-xs text-dash-muted">No assessments yet.</p>}
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
          {!a ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center text-dash-muted">
              <Activity size={24} className="mb-2 opacity-60" />
              <p className="text-sm">The acuity assessment appears here for clinician review.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold uppercase ${ACUITY_CLS[a.acuity ?? 'routine']}`}>{a.acuity}</span>
                  <span className="text-xs text-dash-muted">ESI {a.acuity_score}</span>
                </div>
                {acked ? <span className="inline-flex items-center gap-1 rounded-full border border-ok-line bg-ok-bg px-2.5 py-0.5 text-xs font-semibold text-ok"><Check size={12} /> Acknowledged</span>
                       : <span className="rounded-full bg-wait-bg px-2.5 py-0.5 text-xs font-semibold text-wait">Draft</span>}
              </div>

              {a.page_on_call && <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600"><Siren size={15} /> Recommends paging the on-call team.</div>}

              {a.red_flags.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dash-muted"><Flag size={12} /> Red flags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {a.red_flags.map((f: string, i: number) => <span key={i} className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600">{f}</span>)}
                  </div>
                </div>
              )}

              <div className="mb-3 flex items-center gap-2 rounded-lg bg-surface-hover px-3 py-2 text-sm">
                <span className="text-dash-muted">Recommended route</span> <ArrowRight size={14} className="text-dash-muted" /> <span className="font-semibold text-dash-heading">{a.recommended_route}</span>
              </div>

              {a.rationale && <p className="mb-2 text-sm text-dash-body"><span className="font-medium text-dash-heading">Rationale: </span>{a.rationale}</p>}
              {a.disposition && <p className="text-sm text-dash-body"><span className="font-medium text-dash-heading">Disposition: </span>{a.disposition}</p>}

              <p className="mt-3 text-xs text-dash-muted">Recommendation only — a clinician acknowledges and decides.</p>

              {!acked && canAcknowledge && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-border pt-4">
                  <button onClick={() => acknowledge()} disabled={ackBusy} className="inline-flex items-center gap-2 rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{ackBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Acknowledge &amp; route</button>
                  <span className="text-xs text-dash-muted">or override route:</span>
                  {ROUTES.filter((r) => r !== a.recommended_route).map((r) => (
                    <button key={r} onClick={() => acknowledge(r)} disabled={ackBusy} className="rounded-lg border border-neutral-border px-2.5 py-1 text-xs text-dash-body hover:bg-surface-hover">{r}</button>
                  ))}
                </div>
              )}
              {!acked && !canAcknowledge && (
                <div className="mt-4 rounded-lg border border-dashed border-neutral-border px-3 py-2.5 text-xs text-dash-muted">
                  A clinician will acknowledge and route this assessment.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
