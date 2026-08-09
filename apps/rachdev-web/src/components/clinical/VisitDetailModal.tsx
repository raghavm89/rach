'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Play, Check, X, AlertCircle, Printer, Sparkles, Stethoscope, FileText, ShieldCheck, Route } from 'lucide-react';
import { opd, type Visit, type VisitStatus, type VisitDetail, type VisitNote, type Doctor, type Consent } from '@rach/ui/lib/api';

export const STATUS: Record<VisitStatus, { label: string; cls: string }> = {
  scheduled:       { label: 'Scheduled',       cls: 'bg-blue-100 text-blue-700' },
  waiting:         { label: 'Registered',      cls: 'bg-wait-bg text-wait' },
  in_consultation: { label: 'In consultation', cls: 'bg-accent-weak text-accent' },
  completed:       { label: 'Completed',       cls: 'bg-ok-bg text-ok' },
  cancelled:       { label: 'Cancelled',       cls: 'bg-surface-hover text-dash-muted' },
};

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-hover px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-dash-muted">{label}</p>
      <p className="text-sm text-dash-heading">{value}</p>
    </div>
  );
}

// ── Token slip (Dhanvantri-style print) ───────────────────────────────────────
export function TokenSlip({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const when = new Date(visit.created_at).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const print = () => {
    const html = `<pre style="font-family:monospace;text-align:center;line-height:1.5">
<b style="font-size:16px">${visit.hospital_name || 'Hospital'}</b>
${when}
${visit.visit_type || 'OPD'}
${visit.department || ''}
HID - ${visit.uhid || ''}
${visit.patient_name || ''}
TOKEN NUMBER
<b style="font-size:28px">#${visit.token_no}</b>
*** INSPIRING GOOD HEALTH ***
</pre>`;
    const w = window.open('', '_blank', 'width=360,height=520');
    if (!w) return;
    w.document.write(`<html><head><title>OPD Token #${visit.token_no}</title></head><body onload="window.print()">${html}</body></html>`);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-xl bg-surface-card p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-base font-bold text-dash-heading">{visit.hospital_name || 'Hospital'}</p>
        <p className="text-xs text-dash-muted">{when}</p>
        <p className="mt-2 text-sm font-semibold text-dash-heading">{visit.visit_type || 'OPD'}</p>
        <p className="text-sm text-dash-body">{visit.department}</p>
        <p className="mt-2 text-xs text-dash-muted">HID — {visit.uhid}</p>
        <p className="text-sm font-medium text-dash-heading">{visit.patient_name}</p>
        <p className="mt-3 text-xs uppercase tracking-wide text-dash-muted">Token Number</p>
        <p className="text-4xl font-bold text-accent">#{visit.token_no}</p>
        <p className="mt-3 text-[10px] uppercase tracking-wide text-dash-muted">*** Inspiring good health ***</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={print} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"><Printer size={15} /> Print</button>
          <button onClick={onClose} className="rounded-lg border border-neutral-border px-4 py-2 text-sm text-dash-body hover:bg-surface-hover">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Visit detail: patient + assigned doctor + notes, with AI assignment ───────
// `canAssign` gates the doctor-assignment controls (reception assigns; doctors view).
// `onOpenScribe` (doctor view) hands the visit off to the Scribe editor.
export function VisitDetailModal({ token, visitId, onClose, onChanged, onPrint, canAssign = true, onOpenScribe }: {
  token: string; visitId: number; onClose: () => void; onChanged: () => void;
  onPrint: (v: Visit) => void; canAssign?: boolean; onOpenScribe?: (v: VisitDetail) => void;
}) {
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [notes, setNotes] = useState<VisitNote[]>([]);
  const [consent, setConsent] = useState<Consent[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'assign' | 'ai' | 'start' | 'complete' | 'cancel' | null>(null);
  const [rationale, setRationale] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const detail = await opd.getVisit(token, visitId);
      setVisit(detail.visit); setNotes(detail.notes); setConsent(detail.consent ?? []);
      if (canAssign) { const { doctors } = await opd.doctors(token); setDoctors(doctors); }
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [token, visitId, canAssign]);
  useEffect(() => { load(); }, [load]);

  const assign = async (doctorId?: number) => {
    setBusy(doctorId ? 'assign' : 'ai'); setErr(''); setRationale('');
    try { const { rationale } = await opd.assignDoctor(token, visitId, doctorId); if (!doctorId) setRationale(rationale); await load(); onChanged(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const move = async (status: VisitStatus) => {
    setBusy(status === 'completed' ? 'complete' : status === 'cancelled' ? 'cancel' : 'start'); setErr('');
    try { await opd.updateVisit(token, visitId, { status }); await load(); onChanged(); if (status === 'completed' || status === 'cancelled') onClose(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  const mil = visit?.military && Object.values(visit.military).some(Boolean) ? visit.military : null;
  const canComplete = Boolean(visit?.doctor_id) && notes.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface-card p-6" onClick={(e) => e.stopPropagation()}>
        {loading || !visit ? (
          <div className="flex items-center gap-2 py-10 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-dash-heading">#{visit.token_no ?? '—'} · {visit.patient_name}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[visit.status].cls}`}>{STATUS[visit.status].label}</span>
                </div>
                <p className="text-xs text-dash-muted">HID {visit.uhid}{visit.age ? ` · ${visit.age}` : ''}{visit.sex ? ` · ${visit.sex}` : ''}{visit.phone ? ` · ${visit.phone}` : ''}</p>
                {(() => {
                  const c = consent.find((x) => x.purpose === 'treatment');
                  return (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px]">
                      <ShieldCheck size={12} className={c?.granted ? 'text-ok' : 'text-wait'} />
                      <span className="text-dash-muted">DPDP consent:</span>
                      {c ? <span className={c.granted ? 'font-medium text-ok' : 'font-medium text-red-600'}>{c.granted ? 'Granted' : 'Withdrawn'} · {c.method}</span> : <span className="text-dash-muted">not recorded</span>}
                    </p>
                  );
                })()}
              </div>
              <button onClick={onClose} className="rounded-md p-1 text-dash-muted hover:bg-surface-hover hover:text-dash-heading"><X size={18} /></button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Type" value={`${visit.visit_type || 'OPD'}${visit.patient_type ? ` · ${visit.patient_type}` : ''}`} />
              <Info label="Department" value={visit.department || '—'} />
              {visit.appointment_at && <Info label="Scheduled for" value={new Date(visit.appointment_at).toLocaleString()} />}
              <Info label="Reason" value={visit.reason || '—'} />
              <Info label="Referred by" value={visit.referred_by || '—'} />
            </div>

            {mil && (
              <div className="mt-3 rounded-lg bg-surface-hover p-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-dash-muted">Service details (AFMS)</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-dash-body">
                  {mil.rank && <span>{mil.rank}</span>}
                  {mil.service_number && <span>· {mil.service_number}</span>}
                  {mil.arms_corps && <span>· {mil.arms_corps}</span>}
                  {mil.unit && <span>· Unit {mil.unit}</span>}
                  {mil.category && <span>· {mil.category}</span>}
                  {mil.echs_number && <span>· ECHS {mil.echs_number}</span>}
                  {(mil.validity_from || mil.validity_to) && <span>· Valid {mil.validity_from || ''}–{mil.validity_to || ''}</span>}
                </div>
              </div>
            )}

            {/* Assigned doctor */}
            <div className="mt-4 rounded-xl border border-neutral-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-dash-heading"><Stethoscope size={15} /> Assigned doctor</p>
                {canAssign && (
                  <button onClick={() => assign()} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    {busy === 'ai' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {visit.doctor_id ? 'Reassign (AI)' : 'Auto-assign (AI)'}
                  </button>
                )}
              </div>
              <p className="text-sm text-dash-body">{visit.doctor_name || <span className="text-wait">No doctor assigned yet.</span>}</p>
              {rationale && <p className="mt-1 text-xs text-dash-muted">AI: {rationale}</p>}
              {canAssign && (
                <div className="mt-2 flex items-center gap-2">
                  <select value={visit.doctor_id ?? ''} onChange={(e) => e.target.value && assign(Number(e.target.value))} disabled={busy !== null}
                    className="rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-body focus:border-accent focus:outline-none disabled:opacity-50">
                    <option value="">Assign manually…</option>
                    {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}{d.department ? ` · ${d.department}` : ''}{typeof d.active_load === 'number' ? ` (${d.active_load})` : ''}</option>)}
                  </select>
                  {busy === 'assign' && <Loader2 size={14} className="animate-spin text-dash-muted" />}
                </div>
              )}
            </div>

            {/* Doctor's notes */}
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-dash-heading"><FileText size={15} /> Doctor&apos;s notes {notes.length > 0 && <span className="text-xs font-normal text-dash-muted">({notes.length})</span>}</p>
              {notes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-neutral-border px-3 py-4 text-center text-xs text-dash-muted">No notes recorded yet. A visit can&apos;t be completed until the doctor records notes in Scribe.</p>
              ) : (
                <div className="space-y-2">
                  {notes.map((n) => (
                    <div key={n.id} className="rounded-lg border border-neutral-border p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs text-dash-muted">{new Date(n.updated_at).toLocaleString()}</span>
                        <span className={'rounded-full px-2 py-0.5 text-[10px] font-semibold ' + (n.status === 'signed' ? 'border border-ok-line bg-ok-bg text-ok' : 'bg-wait-bg text-wait')}>{n.status}</span>
                      </div>
                      {(['assessment', 'plan'] as const).map((k) => n.soap?.[k] ? (
                        <p key={k} className="text-dash-body"><span className="font-medium capitalize text-dash-heading">{k}: </span>{n.soap[k]}</p>
                      ) : null)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {err && <div role="alert" className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"><AlertCircle size={15} /> {err}</div>}

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-border pt-4">
              <button onClick={() => onPrint(visit)} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-2 text-sm text-dash-body hover:bg-surface-hover"><Printer size={14} /> Token</button>
              <a href={`/dashboard/clinical/journey?patient=${visit.patient_id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-2 text-sm text-dash-body hover:bg-surface-hover"><Route size={14} /> Journey</a>
              {onOpenScribe && visit.status !== 'cancelled' && (
                <button onClick={() => onOpenScribe(visit)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"><FileText size={14} /> {notes.length ? 'Open in Scribe' : 'Record notes (Scribe)'}</button>
              )}
              {(visit.status === 'waiting' || visit.status === 'scheduled') && (
                <button onClick={() => move('in_consultation')} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy === 'start' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Start consultation</button>
              )}
              {visit.status === 'in_consultation' && (
                <button onClick={() => move('completed')} disabled={busy !== null || !canComplete} title={canComplete ? '' : 'Assign a doctor and record notes first'} className="inline-flex items-center gap-1.5 rounded-lg bg-ok px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy === 'complete' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Complete</button>
              )}
              {(visit.status !== 'completed' && visit.status !== 'cancelled') && (
                <button onClick={() => move('cancelled')} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-2 text-sm text-dash-body hover:bg-surface-hover disabled:opacity-50"><X size={14} /> Cancel</button>
              )}
              {visit.status === 'in_consultation' && !canComplete && (
                <span className="text-xs text-wait">{!visit.doctor_id ? 'Assign a doctor' : 'Record notes'} to enable Complete.</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
