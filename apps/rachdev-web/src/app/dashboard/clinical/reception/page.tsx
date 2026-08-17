'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, UserPlus, TicketCheck, Users, RefreshCw, Play, Check, X, AlertCircle, Printer, ShieldCheck, Link2, BadgeCheck } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { opd, workspace, echs, abdm, type Patient, type Visit, type VisitStatus, type MilitaryInfo, type Consent, type EligibilityCheck } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { ReceptionIntake } from '@/components/clinical/ReceptionIntake';
import { STATUS, TokenSlip, VisitDetailModal } from '@/components/clinical/VisitDetailModal';
import { DEPARTMENTS } from '@/config/clinical';

const PATIENT_TYPES = ['routine', 'urgent', 'schedule'];
const VISIT_TYPES = ['OPD', 'AME', 'PME'];

// Military (AFMS) patient fields — shown only when the org is a military hospital.
const MIL_FIELDS: [string, string][] = [
  ['service_number', 'Service No.'], ['rank', 'Rank'], ['relation', 'Relation'], ['category', 'Category (e.g. Army(ECHS))'],
  ['arms_corps', 'Arms/Corps'], ['unit', 'Unit'], ['formation', 'Formation'], ['trade', 'Trade'],
  ['record_office', 'Record Office'], ['echs_number', 'ECHS No.'], ['validity_from', 'Validity From'], ['validity_to', 'Validity To'],
];

export default function ReceptionPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<'register' | 'queue' | 'intake'>('register');
  const [error, setError] = useState('');
  const [slip, setSlip] = useState<Visit | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const [visits, setVisits] = useState<Visit[]>([]);
  const [qLoading, setQLoading] = useState(true);
  const loadQueue = useCallback(async () => {
    if (!token) return;
    try { const { visits } = await opd.visits(token, 'today'); setVisits(visits); } catch (e) { setError((e as Error).message); } finally { setQLoading(false); }
  }, [token]);
  useEffect(() => { loadQueue(); }, [loadQueue]);

  const setStatus = async (v: Visit, status: VisitStatus) => {
    if (!token) return;
    try { await opd.updateVisit(token, v.id, { status }); loadQueue(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Reception" subtitle="OPD registration, token queue and patient intake" />

      <div className="mb-5 flex gap-1 border-b border-neutral-border">
        {([['register', 'Register'], ['queue', 'OPD Queue'], ['intake', 'AI Intake']] as const).map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); if (k === 'queue') loadQueue(); }}
            className={'border-b-2 px-4 py-2 text-sm font-medium transition-colors ' + (tab === k ? 'border-accent text-accent' : 'border-transparent text-dash-muted hover:text-dash-heading')}>
            {label}{k === 'queue' && visits.length > 0 ? ` (${visits.filter((v) => v.status !== 'completed' && v.status !== 'cancelled').length})` : ''}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle size={15} /> {error}</div>}

      {tab === 'register' && token && <Register token={token} onIssued={(v) => { setSlip(v); loadQueue(); }} onError={setError} />}

      {tab === 'queue' && (
        <div className="overflow-hidden rounded-xl border border-neutral-border bg-surface-card">
          <div className="flex items-center justify-between border-b border-neutral-border px-5 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-dash-heading"><Users size={15} /> Today's queue <span className="font-normal text-xs text-dash-muted">— click a row for patient &amp; doctor details</span></h3>
            <button onClick={loadQueue} className="inline-flex items-center gap-1.5 text-xs text-dash-muted hover:text-dash-heading"><RefreshCw size={13} /> Refresh</button>
          </div>
          {qLoading ? <div className="flex items-center gap-2 px-5 py-6 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-border text-left text-xs uppercase tracking-wide text-dash-muted">
                {['Token', 'Patient', 'Type', 'Department', 'Doctor', 'Status', ''].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id} onClick={() => setDetailId(v.id)} className="cursor-pointer border-b border-neutral-border last:border-0 hover:bg-surface-hover">
                    <td className="px-4 py-3 font-semibold text-dash-heading">#{v.token_no ?? '—'}</td>
                    <td className="px-4 py-3"><div className="font-medium text-dash-heading">{v.patient_name}</div><div className="text-xs text-dash-muted">{v.uhid}</div></td>
                    <td className="px-4 py-3 text-dash-body"><span className="uppercase">{v.visit_type || 'OPD'}</span>{v.patient_type && v.patient_type !== 'routine' ? <span className="ml-1 text-xs text-wait">({v.patient_type})</span> : null}</td>
                    <td className="px-4 py-3 text-dash-body">{v.department || '—'}</td>
                    <td className="px-4 py-3 text-dash-body">{v.doctor_name || <span className="text-dash-muted">Unassigned</span>}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[v.status].cls}`}>{STATUS[v.status].label}</span></td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setSlip(v)} title="Print token" className="inline-flex items-center rounded-lg border border-neutral-border p-1.5 text-dash-body hover:bg-surface-hover"><Printer size={13} /></button>
                        {(v.status === 'waiting' || v.status === 'scheduled') && <button onClick={() => setStatus(v, 'in_consultation')} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-white hover:opacity-90"><Play size={12} /> Start</button>}
                        {v.status === 'in_consultation' && <button onClick={() => setDetailId(v.id)} className="inline-flex items-center gap-1 rounded-lg bg-ok px-2 py-1 text-xs font-semibold text-white hover:opacity-90"><Check size={12} /> Complete</button>}
                        {(v.status !== 'completed' && v.status !== 'cancelled') && <button onClick={() => setStatus(v, 'cancelled')} title="Cancel visit" className="inline-flex items-center rounded-lg border border-neutral-border p-1.5 text-dash-body hover:bg-surface-hover"><X size={12} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {visits.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-dash-muted">No visits today — register a patient.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'intake' && token && <ReceptionIntake token={token} onConfirmed={async () => { await loadQueue(); setTab('queue'); }} />}

      {slip && <TokenSlip visit={slip} onClose={() => setSlip(null)} />}
      {detailId !== null && token && (
        <VisitDetailModal token={token} visitId={detailId} onClose={() => setDetailId(null)} onChanged={loadQueue} onPrint={setSlip} />
      )}
    </div>
  );
}

// ── Register: find/add patient → Add New OPD Visit → token ─────────────────────
function Register({ token, onIssued, onError }: { token: string; onIssued: (v: Visit) => void; onError: (m: string) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [np, setNp] = useState({ name: '', age: '', sex: '', phone: '', address: '' });
  const [mil, setMil] = useState<MilitaryInfo>({});
  const [isMilitary, setIsMilitary] = useState(false);
  const [saving, setSaving] = useState(false);
  // DPDP consent
  const [np_consent, setNpConsent] = useState<{ granted: boolean; method: string }>({ granted: true, method: 'verbal' });
  const [selConsent, setSelConsent] = useState<Consent[] | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  // ABDM / ECHS
  const [elig, setElig] = useState<EligibilityCheck | null>(null);
  const [intBusy, setIntBusy] = useState<'echs' | 'abha' | null>(null);

  useEffect(() => { workspace.get(token).then((r: { tenant: { military?: boolean } | null }) => setIsMilitary(Boolean(r.tenant?.military))).catch(() => {}); }, [token]);

  // Select a patient and load their standing consent (DPDP) + latest ECHS check.
  const pickPatient = async (p: Patient) => {
    setSelected(p); setSelConsent(null); setElig(null);
    try {
      const { patient, consent } = await opd.getPatient(token, p.id);
      setSelected(patient); setSelConsent(consent);
      const { check } = await echs.latestEligibility(token, p.id); setElig(check);
    } catch { /* non-fatal */ }
  };
  const verifyEchs = async () => {
    if (!selected) return;
    setIntBusy('echs');
    try { const { check } = await echs.verifyEligibility(token, selected.id); setElig(check); }
    catch (e) { onError((e as Error).message); } finally { setIntBusy(null); }
  };
  const linkAbha = async () => {
    if (!selected) return;
    setIntBusy('abha');
    try { const { patient } = await abdm.linkAbha(token, selected.id); setSelected((s: Patient | null) => (s ? { ...s, abha_number: patient.abha_number, abha_address: patient.abha_address } : s)); }
    catch (e) { onError((e as Error).message); } finally { setIntBusy(null); }
  };
  const treatmentConsent = selConsent?.find((c) => c.purpose === 'treatment') ?? null;
  const recordConsent = async (granted: boolean, method = 'verbal') => {
    if (!selected) return;
    setConsentBusy(true);
    try { await opd.recordConsent(token, selected.id, { purpose: 'treatment', granted, method });
      const { consent } = await opd.getPatient(token, selected.id); setSelConsent(consent);
    } catch (e) { onError((e as Error).message); } finally { setConsentBusy(false); }
  };

  // Add New OPD Visit form
  const [v, setV] = useState({ patient_type: 'routine', visit_type: 'OPD', department: '', referral_hospital: '', referred_by: '' });
  const [registering, setRegistering] = useState(false);

  const search = async () => {
    setSearching(true);
    try { const { patients } = await opd.searchPatients(token, q); setResults(patients); } catch (e) { onError((e as Error).message); } finally { setSearching(false); }
  };
  const saveNew = async () => {
    if (!np.name.trim()) return;
    setSaving(true);
    try {
      const { patient } = await opd.upsertPatient(token, { ...np, name: np.name.trim(), military: isMilitary ? mil : undefined });
      // Capture the DPDP consent taken at registration.
      try { await opd.recordConsent(token, patient.id, { purpose: 'treatment', granted: np_consent.granted, method: np_consent.method }); } catch { /* non-fatal */ }
      await pickPatient(patient); setShowNew(false);
      setNp({ name: '', age: '', sex: '', phone: '', address: '' }); setMil({}); setNpConsent({ granted: true, method: 'verbal' });
    }
    catch (e) { onError((e as Error).message); } finally { setSaving(false); }
  };
  const register = async () => {
    if (!selected) return;
    setRegistering(true);
    try {
      const { visit } = await opd.createVisit(token, {
        patient_id: selected.id,
        patient_type: v.patient_type, visit_type: v.visit_type,
        department: v.department || undefined,
        referral_hospital: v.referral_hospital || undefined,
        referred_by: v.referred_by || undefined,
      });
      onIssued(visit);
      setSelected(null); setSelConsent(null); setResults([]); setQ('');
      setV({ patient_type: 'routine', visit_type: 'OPD', department: '', referral_hospital: '', referred_by: '' });
    } catch (e) { onError((e as Error).message); } finally { setRegistering(false); }
  };

  const inputCls = 'w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none';
  const Radio = ({ group, val, cur, set, label }: { group: string; val: string; cur: string; set: (x: string) => void; label: string }) => (
    <label className="inline-flex items-center gap-1.5 text-sm text-dash-body">
      <input type="radio" name={group} checked={cur === val} onChange={() => set(val)} className="h-4 w-4 text-accent" /> {label}
    </label>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Find / add patient */}
      <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-dash-heading"><Search size={15} /> Old Patient Search</h3>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Name, HID, service no. or phone" className={inputCls} />
          <button onClick={search} disabled={searching} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}</button>
        </div>
        <div className="mt-3 space-y-1">
          {results.map((p) => (
            <button key={p.id} onClick={() => pickPatient(p)} className={'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ' + (selected?.id === p.id ? 'border-accent bg-surface-hover' : 'border-neutral-border hover:bg-surface-hover')}>
              <span><span className="font-medium text-dash-heading">{p.name}</span> <span className="text-xs text-dash-muted">{p.uhid}{p.phone ? ` · ${p.phone}` : ''}{p.sex ? ` · ${p.sex}` : ''}{p.age ? ` · ${p.age}` : ''}</span></span>
              {p.source_system !== 'local' && <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] uppercase text-dash-muted">{p.source_system}</span>}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNew((x) => !x)} className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"><UserPlus size={15} /> New patient registration</button>
        {showNew && (
          <div className="mt-3 space-y-2 rounded-xl border border-dashed border-neutral-border p-3">
            <input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="Full name" className={inputCls} />
            <div className="grid grid-cols-3 gap-2">
              <input value={np.age} onChange={(e) => setNp({ ...np, age: e.target.value })} placeholder="Age" className={inputCls} />
              <input value={np.sex} onChange={(e) => setNp({ ...np, sex: e.target.value })} placeholder="Sex" className={inputCls} />
              <input value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} placeholder="Phone" className={inputCls} />
            </div>
            <input value={np.address} onChange={(e) => setNp({ ...np, address: e.target.value })} placeholder="Address" className={inputCls} />
            {isMilitary && (
              <div className="rounded-lg bg-surface-hover p-2">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-dash-muted">Service details (AFMS)</p>
                <div className="grid grid-cols-2 gap-2">
                  {MIL_FIELDS.map(([k, label]) => (
                    <input key={k} value={(mil as any)[k] || ''} onChange={(e) => setMil({ ...mil, [k]: e.target.value })} placeholder={label} className={inputCls} />
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-lg bg-surface-hover p-2">
              <label className="flex items-center gap-2 text-sm text-dash-body">
                <input type="checkbox" checked={np_consent.granted} onChange={(e) => setNpConsent({ ...np_consent, granted: e.target.checked })} className="h-4 w-4 text-accent" />
                <ShieldCheck size={14} className="text-accent" /> DPDP consent to process health data
              </label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-dash-muted">Method</span>
                <select value={np_consent.method} onChange={(e) => setNpConsent({ ...np_consent, method: e.target.value })} className="rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-xs text-dash-body focus:border-accent focus:outline-none">
                  {['verbal', 'written', 'digital'].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <button onClick={saveNew} disabled={saving || !np.name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />} Save patient</button>
          </div>
        )}
      </div>

      {/* Add New OPD Visit */}
      <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-dash-heading"><TicketCheck size={15} /> Add New OPD Visit</h3>
        {!selected ? (
          <div className="flex h-full min-h-[240px] items-center justify-center text-center text-sm text-dash-muted">Find or register a patient first.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-hover px-3 py-2 text-sm">
              <span className="font-medium text-dash-heading">{selected.name}</span> <span className="text-xs text-dash-muted">HID {selected.uhid}{selected.age ? ` · ${selected.age}` : ''}{selected.sex ? ` · ${selected.sex}` : ''}</span>
              {selected.military && Object.values(selected.military).some(Boolean) && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-dash-muted">
                  {selected.military.rank && <span>{selected.military.rank}</span>}
                  {selected.military.service_number && <span>· {selected.military.service_number}</span>}
                  {selected.military.arms_corps && <span>· {selected.military.arms_corps}</span>}
                  {selected.military.unit && <span>· Unit {selected.military.unit}</span>}
                  {selected.military.category && <span>· {selected.military.category}</span>}
                  {selected.military.echs_number && <span>· ECHS {selected.military.echs_number}</span>}
                  {(selected.military.validity_from || selected.military.validity_to) && <span>· Valid {selected.military.validity_from || ''}–{selected.military.validity_to || ''}</span>}
                </div>
              )}
            </div>
            {/* DPDP consent status */}
            <div className="flex items-center justify-between rounded-lg border border-neutral-border px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 text-dash-body">
                <ShieldCheck size={14} className={treatmentConsent?.granted ? 'text-ok' : 'text-wait'} /> DPDP consent:
                {treatmentConsent
                  ? <span className={treatmentConsent.granted ? 'font-medium text-ok' : 'font-medium text-red-600'}>{treatmentConsent.granted ? 'Granted' : 'Withdrawn'} · {treatmentConsent.method}</span>
                  : <span className="text-dash-muted">Not recorded</span>}
              </span>
              <span className="flex items-center gap-1.5">
                {consentBusy && <Loader2 size={12} className="animate-spin text-dash-muted" />}
                {(!treatmentConsent || !treatmentConsent.granted) && <button onClick={() => recordConsent(true)} disabled={consentBusy} className="rounded-md border border-neutral-border px-2 py-0.5 text-[11px] text-dash-body hover:bg-surface-hover">Record (verbal)</button>}
                {treatmentConsent?.granted && <button onClick={() => recordConsent(false)} disabled={consentBusy} className="rounded-md border border-neutral-border px-2 py-0.5 text-[11px] text-dash-muted hover:bg-surface-hover">Withdraw</button>}
              </span>
            </div>
            {/* ABDM / ECHS */}
            <div className="space-y-1.5 rounded-lg border border-neutral-border px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-dash-body">
                  <BadgeCheck size={14} className={elig?.eligible ? 'text-ok' : 'text-wait'} /> ECHS:
                  {elig
                    ? <span className={elig.eligible ? 'font-medium text-ok' : 'font-medium text-red-600'}>{elig.eligible ? `Eligible${elig.valid_to ? ` · valid to ${elig.valid_to}` : ''}` : 'Not eligible'}{elig.source === 'stub' ? ' (demo)' : ''}</span>
                    : <span className="text-dash-muted">Not verified</span>}
                </span>
                <span className="flex items-center gap-1.5">{intBusy === 'echs' && <Loader2 size={12} className="animate-spin text-dash-muted" />}<button onClick={verifyEchs} disabled={intBusy !== null} className="rounded-md border border-neutral-border px-2 py-0.5 text-[11px] text-dash-body hover:bg-surface-hover">Verify</button></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-dash-body">
                  <Link2 size={14} className={selected.abha_address ? 'text-accent' : 'text-dash-muted'} /> ABHA:
                  {selected.abha_address ? <span className="font-medium text-dash-heading">{selected.abha_address}</span> : <span className="text-dash-muted">Not linked</span>}
                </span>
                {!selected.abha_address && <span className="flex items-center gap-1.5">{intBusy === 'abha' && <Loader2 size={12} className="animate-spin text-dash-muted" />}<button onClick={linkAbha} disabled={intBusy !== null} className="rounded-md border border-neutral-border px-2 py-0.5 text-[11px] text-dash-body hover:bg-surface-hover">Link</button></span>}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase text-dash-muted">Patient Type</p>
              <div className="flex gap-4">{PATIENT_TYPES.map((t) => <Radio key={t} group="pt" val={t} cur={v.patient_type} set={(x) => setV({ ...v, patient_type: x })} label={t[0].toUpperCase() + t.slice(1)} />)}</div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase text-dash-muted">OPD / AME / PME</p>
              <div className="flex gap-4">{VISIT_TYPES.map((t) => <Radio key={t} group="vt" val={t} cur={v.visit_type} set={(x) => setV({ ...v, visit_type: x })} label={t} />)}</div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-dash-muted">Department</label>
              <select value={v.department} onChange={(e) => setV({ ...v, department: e.target.value })} className={inputCls}>
                <option value="">Select department</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1 block text-xs font-semibold uppercase text-dash-muted">Referral Hospital</label>
                <input value={v.referral_hospital} onChange={(e) => setV({ ...v, referral_hospital: e.target.value })} className={inputCls} /></div>
              <div><label className="mb-1 block text-xs font-semibold uppercase text-dash-muted">Referred By (Doctor)</label>
                <input value={v.referred_by} onChange={(e) => setV({ ...v, referred_by: e.target.value })} className={inputCls} /></div>
            </div>
            <button onClick={register} disabled={registering} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {registering ? <Loader2 size={15} className="animate-spin" /> : <TicketCheck size={15} />} Save &amp; issue token
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
