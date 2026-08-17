'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Network, AlertCircle, Plus, Search, X, Check, BedDouble, Send, Sparkles, RefreshCw, CalendarClock } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { coordination, opd, type Bed, type Referral, type DischargeSummary, type DischargeSummaryBody, type Patient, type Visit } from '@rach/ui/lib/api';

const BED_STATUS_CLS: Record<string, string> = {
  available: 'bg-ok-bg text-ok border-ok-line',
  occupied: 'bg-accent-weak text-accent border-accent-weak',
  reserved: 'bg-wait-bg text-wait border-wait-bg',
  maintenance: 'bg-surface-hover text-dash-muted border-neutral-border',
};

// Small inline patient picker.
function PatientPick({ token, onPick, onError }: { token: string; onPick: (p: Patient) => void; onError: (m: string) => void }) {
  const [q, setQ] = useState(''); const [res, setRes] = useState<Patient[]>([]); const [busy, setBusy] = useState(false);
  const go = async () => { if (!q.trim()) return; setBusy(true); try { const { patients } = await opd.searchPatients(token, q.trim()); setRes(patients); } catch (e) { onError((e as Error).message); } finally { setBusy(false); } };
  return (
    <div>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} placeholder="Search patient…" className="w-full rounded-lg border border-neutral-border bg-surface-app px-2 py-1.5 text-sm text-dash-heading focus:border-accent focus:outline-none" />
        <button onClick={go} disabled={busy} className="rounded-lg bg-accent px-3 py-1.5 text-white hover:opacity-90 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}</button>
      </div>
      {res.length > 0 && (
        <div className="mt-1 space-y-1">
          {res.map((p) => <button key={p.id} onClick={() => { onPick(p); setRes([]); setQ(''); }} className="block w-full rounded-lg border border-neutral-border px-2 py-1 text-left text-sm hover:bg-surface-hover">{p.name} <span className="text-xs text-dash-muted">{p.uhid}</span></button>)}
        </div>
      )}
    </div>
  );
}

export default function CoordinationPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<'beds' | 'referrals' | 'discharge'>('beds');
  const [error, setError] = useState('');

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-xl font-semibold text-dash-heading">Coordination</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-weak px-2.5 py-0.5 text-xs font-semibold text-accent"><Network size={12} /> Kabir</span>
        <span className="hidden text-sm text-dash-muted sm:inline">Beds &amp; OT · referrals · discharge summaries · follow-ups</span>
      </div>

      <div className="mb-5 flex gap-1 border-b border-neutral-border">
        {([['beds', 'Beds & OT'], ['referrals', 'Referrals'], ['discharge', 'Discharge & Follow-up']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={'border-b-2 px-4 py-2 text-sm font-medium transition-colors ' + (tab === k ? 'border-accent text-accent' : 'border-transparent text-dash-muted hover:text-dash-heading')}>{label}</button>
        ))}
      </div>

      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle size={15} /> {error}</div>}

      {token && tab === 'beds' && <BedsTab token={token} onError={setError} />}
      {token && tab === 'referrals' && <ReferralsTab token={token} onError={setError} />}
      {token && tab === 'discharge' && <DischargeTab token={token} onError={setError} />}
    </div>
  );
}

// ── Beds & OT ─────────────────────────────────────────────────────────────────
function BedsTab({ token, onError }: { token: string; onError: (m: string) => void }) {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [nb, setNb] = useState({ ward: '', bed_number: '', kind: 'general' });
  const [assignId, setAssignId] = useState<number | null>(null);

  const load = useCallback(async () => { try { const { beds } = await coordination.beds(token); setBeds(beds); } catch (e) { onError((e as Error).message); } finally { setLoading(false); } }, [token, onError]);
  useEffect(() => { load(); }, [load]);

  const add = async () => { if (!nb.ward.trim() || !nb.bed_number.trim()) return; try { await coordination.addBed(token, nb); setNb({ ward: '', bed_number: '', kind: 'general' }); load(); } catch (e) { onError((e as Error).message); } };
  const assign = async (bed: Bed, p: Patient) => { try { await coordination.updateBed(token, bed.id, { status: 'occupied', patient_id: p.id }); setAssignId(null); load(); } catch (e) { onError((e as Error).message); } };
  const release = async (bed: Bed) => { try { await coordination.updateBed(token, bed.id, { status: 'available', patient_id: null, visit_id: null }); load(); } catch (e) { onError((e as Error).message); } };

  const inputCls = 'rounded-lg border border-neutral-border bg-surface-app px-2 py-1.5 text-sm text-dash-heading focus:border-accent focus:outline-none';
  if (loading) return <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-neutral-border bg-surface-card p-3">
        <input value={nb.ward} onChange={(e) => setNb({ ...nb, ward: e.target.value })} placeholder="Ward" className={inputCls} />
        <input value={nb.bed_number} onChange={(e) => setNb({ ...nb, bed_number: e.target.value })} placeholder="Bed no." className={inputCls} />
        <select value={nb.kind} onChange={(e) => setNb({ ...nb, kind: e.target.value })} className={inputCls}>{['general', 'ICU', 'OT'].map((k) => <option key={k} value={k}>{k}</option>)}</select>
        <button onClick={add} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"><Plus size={14} /> Add bed</button>
      </div>

      {beds.length === 0 ? <p className="rounded-xl border border-dashed border-neutral-border px-4 py-10 text-center text-sm text-dash-muted">No beds yet — add wards/beds above.</p> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {beds.map((b) => (
            <div key={b.id} className="rounded-xl border border-neutral-border bg-surface-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-semibold text-dash-heading"><BedDouble size={15} /> {b.ward} · {b.bed_number}</span>
                <span className="shrink-0 rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-semibold uppercase text-dash-muted">{b.kind}</span>
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium capitalize ${BED_STATUS_CLS[b.status]}`}>{b.status}</span>
                {b.patient_name ? <span className="text-dash-body">{b.patient_name}</span> : null}
              </p>
              <div className="mt-2">
                {b.status === 'occupied' ? (
                  <button onClick={() => release(b)} className="rounded-lg border border-neutral-border bg-surface-card px-2 py-1 text-xs text-dash-body hover:bg-surface-hover">Release</button>
                ) : assignId === b.id ? (
                  <div className="rounded-lg bg-surface-card p-2"><PatientPick token={token} onPick={(p) => assign(b, p)} onError={onError} /><button onClick={() => setAssignId(null)} className="mt-1 text-[11px] text-dash-muted">cancel</button></div>
                ) : (
                  <button onClick={() => setAssignId(b.id)} className="rounded-lg border border-neutral-border bg-surface-card px-2 py-1 text-xs text-dash-body hover:bg-surface-hover">Assign patient</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Referrals ─────────────────────────────────────────────────────────────────
function ReferralsTab({ token, onError }: { token: string; onError: (m: string) => void }) {
  const [refs, setRefs] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [f, setF] = useState({ to_dept: '', to_hospital: '', reason: '', priority: 'routine' });

  const load = useCallback(async () => { try { const { referrals } = await coordination.referrals(token); setRefs(referrals); } catch (e) { onError((e as Error).message); } finally { setLoading(false); } }, [token, onError]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try { await coordination.createReferral(token, { patient_id: patient?.id, to_dept: f.to_dept || undefined, to_hospital: f.to_hospital || undefined, reason: f.reason || undefined, priority: f.priority }); setPatient(null); setF({ to_dept: '', to_hospital: '', reason: '', priority: 'routine' }); load(); }
    catch (e) { onError((e as Error).message); }
  };
  const setStatus = async (r: Referral, status: string) => { try { await coordination.updateReferral(token, r.id, status); load(); } catch (e) { onError((e as Error).message); } };

  const inputCls = 'w-full rounded-lg border border-neutral-border bg-surface-app px-2 py-1.5 text-sm text-dash-heading focus:border-accent focus:outline-none';
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-dash-heading">New referral</h3>
        {patient ? (
          <div className="mb-2 flex items-center justify-between rounded-lg border border-accent bg-surface-app px-3 py-1.5 text-sm"><span className="text-dash-heading">{patient.name} <span className="text-xs text-dash-muted">{patient.uhid}</span></span><button onClick={() => setPatient(null)}><X size={14} /></button></div>
        ) : <div className="mb-2"><PatientPick token={token} onPick={setPatient} onError={onError} /></div>}
        <div className="space-y-2">
          <input value={f.to_dept} onChange={(e) => setF({ ...f, to_dept: e.target.value })} placeholder="Refer to department" className={inputCls} />
          <input value={f.to_hospital} onChange={(e) => setF({ ...f, to_hospital: e.target.value })} placeholder="Refer to hospital (optional)" className={inputCls} />
          <textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} rows={2} placeholder="Reason" className={`${inputCls} resize-y`} />
          <label className="flex items-center gap-2 text-sm text-dash-body"><input type="checkbox" checked={f.priority === 'urgent'} onChange={(e) => setF({ ...f, priority: e.target.checked ? 'urgent' : 'routine' })} className="h-4 w-4 text-accent" /> Urgent</label>
          <button onClick={create} disabled={!f.to_dept && !f.to_hospital} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"><Send size={14} /> Create referral</button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-dash-heading">Referrals</h3>
        {loading ? <Loader2 size={16} className="animate-spin text-dash-muted" /> : refs.length === 0 ? <p className="text-sm text-dash-muted">No referrals yet.</p> : (
          <div className="space-y-2">
            {refs.map((r) => (
              <div key={r.id} className="rounded-lg border border-neutral-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-dash-heading">{r.patient_name || r.patient_ref || 'Unnamed'} → {r.to_dept || r.to_hospital}</span>
                  <span className="flex items-center gap-1">{r.priority === 'urgent' && <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">urgent</span>}<span className="rounded-full bg-surface-hover px-1.5 py-0.5 text-[10px] font-semibold text-dash-muted">{r.status}</span></span>
                </div>
                {r.reason && <p className="mt-0.5 text-xs text-dash-muted">{r.reason}</p>}
                {r.status === 'open' && <div className="mt-2 flex gap-1.5">
                  <button onClick={() => setStatus(r, 'accepted')} className="rounded-lg bg-accent px-2 py-0.5 text-xs font-semibold text-white hover:opacity-90">Accept</button>
                  <button onClick={() => setStatus(r, 'completed')} className="rounded-lg border border-neutral-border px-2 py-0.5 text-xs text-dash-body hover:bg-surface-hover">Complete</button>
                  <button onClick={() => setStatus(r, 'cancelled')} className="rounded-lg border border-neutral-border px-2 py-0.5 text-xs text-dash-muted hover:bg-surface-hover">Cancel</button>
                </div>}
                {r.status === 'accepted' && <button onClick={() => setStatus(r, 'completed')} className="mt-2 rounded-lg border border-neutral-border px-2 py-0.5 text-xs text-dash-body hover:bg-surface-hover">Mark completed</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Discharge & Follow-up ─────────────────────────────────────────────────────
const DISCHARGE_FIELDS: [keyof DischargeSummaryBody, string][] = [
  ['diagnosis', 'Diagnosis'], ['hospital_course', 'Hospital course'], ['follow_up', 'Follow-up'], ['advice', 'Advice'],
];

function DischargeTab({ token, onError }: { token: string; onError: (m: string) => void }) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [d, setD] = useState<DischargeSummary | null>(null);
  const [busy, setBusy] = useState<'gen' | 'save' | 'sign' | null>(null);
  const [genId, setGenId] = useState<number | null>(null);
  // follow-up
  const [fuPatient, setFuPatient] = useState<Patient | null>(null);
  const [fuDate, setFuDate] = useState(''); const [fuReason, setFuReason] = useState('');
  const [fuMsg, setFuMsg] = useState('');

  const load = useCallback(async () => { try { const { visits } = await opd.visits(token, 'all'); setVisits(visits.filter((v: Visit) => v.status === 'completed' || v.status === 'in_consultation')); } catch (e) { onError((e as Error).message); } }, [token, onError]);
  useEffect(() => { load(); }, [load]);

  const gen = async (visitId: number) => { setBusy('gen'); setGenId(visitId); try { const { discharge } = await coordination.generateDischarge(token, visitId); setD(discharge); } catch (e) { onError((e as Error).message); } finally { setBusy(null); setGenId(null); } };
  const setField = (k: keyof DischargeSummaryBody, v: string) => setD((c: DischargeSummary | null) => (c ? { ...c, summary: { ...c.summary, [k]: v } } : c));
  const save = async () => { if (!d) return; setBusy('save'); try { const { discharge } = await coordination.updateDischarge(token, d.id, d.summary); setD(discharge); } catch (e) { onError((e as Error).message); } finally { setBusy(null); } };
  const sign = async () => { if (!d) return; setBusy('sign'); try { await coordination.updateDischarge(token, d.id, d.summary); const { discharge } = await coordination.signDischarge(token, d.id); setD(discharge); } catch (e) { onError((e as Error).message); } finally { setBusy(null); } };
  const scheduleFu = async () => {
    if (!fuPatient || !fuDate) return; setFuMsg('');
    try { await coordination.scheduleFollowUp(token, { patient_id: fuPatient.id, appointment_at: new Date(fuDate).toISOString(), reason: fuReason || undefined }); setFuMsg(`Follow-up scheduled for ${fuPatient.name}.`); setFuPatient(null); setFuDate(''); setFuReason(''); }
    catch (e) { onError((e as Error).message); }
  };

  const inputCls = 'w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none';
  const signed = d?.status === 'signed';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-dash-heading">Draft a discharge summary</h3><button onClick={load} className="text-dash-muted hover:text-dash-heading"><RefreshCw size={13} /></button></div>
          {visits.length === 0 ? <p className="text-sm text-dash-muted">No completed/active visits. Complete a visit with notes first.</p> : (
            <div className="space-y-1">
              {visits.slice(0, 8).map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-neutral-border px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate"><span className="font-medium text-dash-heading">{v.patient_name}</span> <span className="text-xs text-dash-muted">#{v.token_no} · {v.department || 'OPD'}</span></span>
                  <button onClick={() => gen(v.id)} disabled={busy === 'gen'} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy === 'gen' && genId === v.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Draft</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Follow-up */}
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-dash-heading"><CalendarClock size={15} /> Schedule follow-up</h3>
          {fuPatient ? <div className="mb-2 flex items-center justify-between rounded-lg border border-accent bg-surface-app px-3 py-1.5 text-sm"><span className="text-dash-heading">{fuPatient.name} <span className="text-xs text-dash-muted">{fuPatient.uhid}</span></span><button onClick={() => setFuPatient(null)}><X size={14} /></button></div>
            : <div className="mb-2"><PatientPick token={token} onPick={setFuPatient} onError={onError} /></div>}
          <input type="datetime-local" value={fuDate} onChange={(e) => setFuDate(e.target.value)} className={`${inputCls} mb-2`} />
          <input value={fuReason} onChange={(e) => setFuReason(e.target.value)} placeholder="Reason (optional)" className={`${inputCls} mb-2`} />
          <button onClick={scheduleFu} disabled={!fuPatient || !fuDate} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"><CalendarClock size={14} /> Schedule</button>
          {fuMsg && <p className="mt-2 text-xs text-ok">{fuMsg}</p>}
        </div>
      </div>

      {/* Discharge editor */}
      <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
        {!d ? <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center text-dash-muted"><Sparkles size={24} className="mb-2 opacity-60" /><p className="text-sm">Draft a summary from a visit to review it here.</p></div> : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-dash-heading">Discharge summary</h3>
              {signed ? <span className="inline-flex items-center gap-1 rounded-full border border-ok-line bg-ok-bg px-2.5 py-0.5 text-xs font-semibold text-ok"><Check size={12} /> Signed</span> : <span className="rounded-full bg-wait-bg px-2.5 py-0.5 text-xs font-semibold text-wait">Draft</span>}
            </div>
            <div className="space-y-3">
              {DISCHARGE_FIELDS.map(([k, label]) => (
                <div key={String(k)}><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dash-muted">{label}</label>
                  <textarea value={d.summary[k] as string} readOnly={signed} rows={2} onChange={(e) => setField(k, e.target.value)} className="w-full resize-y rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none read-only:opacity-80" /></div>
              ))}
              <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dash-muted">Medications</label>
                <p className="rounded-lg bg-surface-hover px-3 py-2 text-sm text-dash-body">{d.summary.medications?.length ? d.summary.medications.join(', ') : '—'}</p></div>
            </div>
            {!signed && (
              <div className="mt-4 flex items-center gap-2 border-t border-neutral-border pt-4">
                <button onClick={sign} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy === 'sign' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve &amp; sign</button>
                <button onClick={save} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg border border-neutral-border px-4 py-2 text-sm text-dash-body hover:bg-surface-hover disabled:opacity-50">{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : null} Save draft</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
