'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, HeartPulse, RefreshCw, AlertCircle, Search, Activity, Check, X, Siren } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { icu, opd, type IcuBoardPatient, type IcuAlert, type IcuVitals, type Patient } from '@rach/ui/lib/api';

const SEV_CLS: Record<string, string> = {
  critical: 'bg-red-50 text-red-600 border-red-200',
  urgent: 'bg-wait-bg text-wait border-wait-bg',
  watch: 'bg-surface-hover text-dash-body border-neutral-border',
};
const COND_LABEL: Record<string, string> = { sepsis: 'Sepsis', mi: 'Silent MI', aki: 'AKI', arrhythmia: 'Arrhythmia', deterioration: 'Deterioration' };
const VITALS: [keyof IcuVitals, string][] = [
  ['hr', 'HR'], ['rr', 'RR'], ['sbp', 'SBP'], ['dbp', 'DBP'], ['spo2', 'SpO₂'], ['temp', 'Temp °C'],
  ['gcs', 'GCS'], ['creatinine', 'Creatinine'], ['lactate', 'Lactate'], ['troponin', 'Troponin'], ['wbc', 'WBC'], ['urine_output', 'Urine mL/hr'],
];

function newsCls(n: number | null): string {
  if (n == null) return 'bg-surface-hover text-dash-muted';
  if (n >= 7) return 'bg-red-50 text-red-600';
  if (n >= 5) return 'bg-wait-bg text-wait';
  return 'bg-ok-bg text-ok';
}

export default function IcuPage() {
  const { token } = useAuth();
  const [board, setBoard] = useState<IcuBoardPatient[]>([]);
  const [alerts, setAlerts] = useState<IcuAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try { const [b, a] = await Promise.all([icu.board(token), icu.alerts(token, 'open')]); setBoard(b.patients); setAlerts(a.alerts); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  // ── Record observation ──
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [ecg, setEcg] = useState('');
  const [busy, setBusy] = useState(false);
  const [justFired, setJustFired] = useState<IcuAlert[] | null>(null);

  const search = async () => {
    if (!token || !q.trim()) return;
    try { const { patients } = await opd.searchPatients(token, q.trim()); setResults(patients); } catch (e) { setError((e as Error).message); }
  };
  const submit = async () => {
    if (!token || !patient) return;
    setBusy(true); setError(''); setJustFired(null);
    try {
      const vitals: IcuVitals = { ecg_note: ecg.trim() || undefined };
      for (const [k] of VITALS) if (vals[k as string]?.trim()) (vitals as Record<string, string>)[k as string] = vals[k as string].trim();
      const { alerts: fired } = await icu.record(token, patient.id, vitals);
      setJustFired(fired); setVals({}); setEcg(''); load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const act = async (id: number, kind: 'ack' | 'resolve') => {
    if (!token) return;
    try { await (kind === 'ack' ? icu.acknowledge(token, id) : icu.resolve(token, id)); load(); }
    catch (e) { setError((e as Error).message); }
  };

  const inputCls = 'w-full rounded-lg border border-neutral-border bg-surface-app px-2 py-1.5 text-sm text-dash-heading focus:border-accent focus:outline-none';

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-xl font-semibold text-dash-heading">ICU Sentinel</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-weak px-2.5 py-0.5 text-xs font-semibold text-accent"><HeartPulse size={12} /> Umeed</span>
        <span className="hidden text-sm text-dash-muted sm:inline">Watches vitals &amp; labs — fires early-warning alerts for clinician review</span>
        <button onClick={load} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs text-dash-body hover:bg-surface-hover"><RefreshCw size={13} /> Refresh</button>
      </div>

      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle size={15} /> {error}</div>}

      {/* Monitoring board */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <div className="border-b border-neutral-border px-5 py-3 text-sm font-semibold text-dash-heading">Monitoring board <span className="font-normal text-dash-muted">— last 48h · sorted by NEWS2</span></div>
        {loading ? <div className="flex items-center gap-2 px-5 py-6 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-border text-left text-xs uppercase tracking-wide text-dash-muted">
              {['Patient', 'NEWS2', 'HR', 'RR', 'SBP', 'SpO₂', 'Temp', 'Alerts', 'Updated'].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {board.map((p) => (
                <tr key={p.patient_id} className="border-b border-neutral-border last:border-0">
                  <td className="px-4 py-2.5"><div className="font-medium text-dash-heading">{p.patient_name}</div><div className="text-xs text-dash-muted">{p.uhid}</div></td>
                  <td className="px-4 py-2.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${newsCls(p.news2)}`}>{p.news2 ?? '—'}</span></td>
                  <td className="px-4 py-2.5 text-dash-body">{p.hr ?? '—'}</td>
                  <td className="px-4 py-2.5 text-dash-body">{p.rr ?? '—'}</td>
                  <td className="px-4 py-2.5 text-dash-body">{p.sbp ?? '—'}</td>
                  <td className="px-4 py-2.5 text-dash-body">{p.spo2 ?? '—'}</td>
                  <td className="px-4 py-2.5 text-dash-body">{p.temp ?? '—'}</td>
                  <td className="px-4 py-2.5">{p.open_alerts > 0 ? <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${SEV_CLS[p.worst ?? 'watch']}`}><Siren size={11} /> {p.open_alerts}</span> : <span className="text-xs text-dash-muted">clear</span>}</td>
                  <td className="px-4 py-2.5 text-xs text-dash-muted">{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
              {board.length === 0 && <tr><td colSpan={9} className="px-5 py-8 text-center text-dash-muted">No monitored patients yet — record an observation below.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Record observation */}
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-dash-heading"><Activity size={15} /> Record observation</h3>
          {!patient ? (
            <div className="flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search patient — name, HID, phone" className={inputCls} />
              <button onClick={search} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"><Search size={14} /></button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-accent bg-accent-weak px-3 py-2 text-sm">
              <span><span className="font-medium text-dash-heading">{patient.name}</span> <span className="text-xs text-dash-muted">HID {patient.uhid}</span></span>
              <button onClick={() => { setPatient(null); setJustFired(null); }} className="rounded-md p-1 text-dash-muted hover:bg-surface-hover"><X size={14} /></button>
            </div>
          )}
          {!patient && results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.map((p) => (
                <button key={p.id} onClick={() => { setPatient(p); setResults([]); setQ(''); }} className="flex w-full items-center justify-between rounded-lg border border-neutral-border px-3 py-1.5 text-left text-sm hover:bg-surface-hover">
                  <span className="text-dash-heading">{p.name} <span className="text-xs text-dash-muted">{p.uhid}</span></span>
                </button>
              ))}
            </div>
          )}

          {patient && (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {VITALS.map(([k, label]) => (
                  <label key={k as string} className="block">
                    <span className="mb-0.5 block text-[11px] text-dash-muted">{label}</span>
                    <input value={vals[k as string] ?? ''} onChange={(e) => setVals({ ...vals, [k as string]: e.target.value })} inputMode="decimal" className={inputCls} />
                  </label>
                ))}
              </div>
              <input value={ecg} onChange={(e) => setEcg(e.target.value)} placeholder="ECG / rhythm note (e.g. irregular, ST elevation)" className={`${inputCls} mt-2`} />
              <button onClick={submit} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <HeartPulse size={14} />} Record &amp; evaluate</button>

              {justFired && (
                <div className="mt-3">
                  {justFired.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-ok-line bg-ok-bg px-3 py-2 text-sm text-ok"><Check size={15} /> No new alerts — within thresholds.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {justFired.map((a) => (
                        <div key={a.id} className={`rounded-lg border px-3 py-2 text-sm ${SEV_CLS[a.severity]}`}>
                          <span className="font-semibold">{COND_LABEL[a.condition] ?? a.condition} · {a.severity}</span>
                          <span className="ml-1 text-xs opacity-90">{a.evidence.join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Active alerts */}
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-dash-heading"><Siren size={15} /> Active alerts <span className="font-normal text-dash-muted">({alerts.length})</span></h3>
          {alerts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-border px-3 py-8 text-center text-sm text-dash-muted">No open alerts. The sentinel fires here as observations cross thresholds.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className="rounded-xl border border-neutral-border p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${SEV_CLS[a.severity]}`}>{a.severity}</span>
                      <span className="text-sm font-semibold text-dash-heading">{COND_LABEL[a.condition] ?? a.condition}</span>
                    </span>
                    <span className="text-xs text-dash-muted">NEWS2 {a.score ?? '—'}</span>
                  </div>
                  <p className="text-sm text-dash-body">{a.message}</p>
                  <p className="mt-1 text-xs text-dash-muted">{a.patient_name} · {a.uhid} · {new Date(a.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => act(a.id, 'ack')} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"><Check size={12} /> Acknowledge</button>
                    <button onClick={() => act(a.id, 'resolve')} className="inline-flex items-center gap-1 rounded-lg border border-neutral-border px-2.5 py-1 text-xs text-dash-body hover:bg-surface-hover">Resolve</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
