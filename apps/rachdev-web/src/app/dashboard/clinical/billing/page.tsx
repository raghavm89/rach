'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Receipt, AlertCircle, Sparkles, Plus, Trash2, Send, Save, ShieldAlert, RefreshCw, FileText } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { claims, scribe, echs, type Claim, type ClaimSummary, type ClaimCode, type ClaimCharge, type ClinicalNoteSummary, type EligibilityCheck } from '@rach/ui/lib/api';

const PAYERS = ['ECHS', 'CGHS', 'ex-serviceman', 'self', 'TPA'];
const RISK_CLS: Record<string, string> = {
  low: 'bg-ok-bg text-ok border-ok-line',
  medium: 'bg-wait-bg text-wait border-wait-bg',
  high: 'bg-red-50 text-red-600 border-red-200',
};
const STATUS_CLS: Record<string, string> = {
  draft: 'bg-wait-bg text-wait', submitted: 'bg-accent-weak text-accent', paid: 'bg-ok-bg text-ok', denied: 'bg-red-50 text-red-600',
};

export default function BillingPage() {
  const { token } = useAuth();
  const [list, setList] = useState<ClaimSummary[]>([]);
  const [notes, setNotes] = useState<ClinicalNoteSummary[]>([]);
  const [payer, setPayer] = useState('ECHS');
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'gen' | 'save' | 'submit' | 'preauth' | null>(null);
  const [genId, setGenId] = useState<number | null>(null);
  const [preauth, setPreauth] = useState<EligibilityCheck | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [c, n] = await Promise.all([claims.list(token), scribe.list(token)]);
      setList(c.claims); setNotes(n.notes.filter((x: ClinicalNoteSummary) => x.status === 'signed'));
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const generate = async (noteId: number) => {
    if (!token) return;
    setBusy('gen'); setGenId(noteId); setError('');
    try { const { claim } = await claims.generate(token, noteId, payer); setClaim(claim); setPreauth(null); load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); setGenId(null); }
  };
  const openClaim = async (id: number) => {
    if (!token) return;
    setError(''); setPreauth(null);
    try { const { claim } = await claims.get(token, id); setClaim(claim); }
    catch (e) { setError((e as Error).message); }
  };
  const raisePreauth = async () => {
    if (!token || !claim) return;
    setBusy('preauth'); setError('');
    try { const { check } = await echs.preAuth(token, claim.id); setPreauth(check); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  // Local editing helpers operate on the loaded claim.
  const setC = (patch: Partial<Claim>) => setClaim((c: Claim | null) => (c ? { ...c, ...patch } : c));
  const total = (claim?.charges ?? []).reduce((s: number, x: ClaimCharge) => s + (Number(x.amount) || 0), 0);
  const editable = claim?.status === 'draft';

  const save = async () => {
    if (!token || !claim) return;
    setBusy('save'); setError('');
    try { const { claim: c } = await claims.update(token, claim.id, { codes: claim.codes, charges: claim.charges, payer: claim.payer, denial_risk: claim.denial_risk, notes: claim.notes ?? undefined }); setClaim(c); load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };
  const submit = async () => {
    if (!token || !claim) return;
    setBusy('submit'); setError('');
    try { await claims.update(token, claim.id, { codes: claim.codes, charges: claim.charges, payer: claim.payer }); const { claim: c } = await claims.submit(token, claim.id); setClaim(c); load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  const inputCls = 'rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-heading focus:border-accent focus:outline-none';

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-xl font-semibold text-dash-heading">Billing</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-weak px-2.5 py-0.5 text-xs font-semibold text-accent"><Receipt size={12} /> Rhea</span>
        <span className="hidden text-sm text-dash-muted sm:inline">Signed note → coded claim + denial-risk → coder submits</span>
        <button onClick={load} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs text-dash-body hover:bg-surface-hover"><RefreshCw size={13} /> Refresh</button>
      </div>

      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle size={15} /> {error}</div>}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: sources + claims */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-dash-heading"><FileText size={15} /> Code a signed note</h3>
            <label className="mb-2 flex items-center gap-2 text-xs text-dash-muted">Payer
              <select value={payer} onChange={(e) => setPayer(e.target.value)} className={inputCls}>{PAYERS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            </label>
            {loading ? <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={14} className="animate-spin" /> Loading…</div> : notes.length === 0 ? (
              <p className="text-xs text-dash-muted">No signed notes yet. Sign a note in Scribe to code it.</p>
            ) : (
              <div className="space-y-1">
                {notes.slice(0, 8).map((n) => (
                  <div key={n.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-border px-3 py-1.5 text-sm">
                    <span className="min-w-0 truncate"><span className="font-medium text-dash-heading">{n.patient_ref || 'Unnamed'}</span> <span className="text-xs text-dash-muted">{n.preview || ''}</span></span>
                    <button onClick={() => generate(n.id)} disabled={busy === 'gen'} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy === 'gen' && genId === n.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Code</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
            <h3 className="mb-2 text-sm font-semibold text-dash-heading">Claims</h3>
            {list.length === 0 ? <p className="text-xs text-dash-muted">No claims yet.</p> : (
              <div className="space-y-1">
                {list.map((c) => (
                  <button key={c.id} onClick={() => openClaim(c.id)} className={'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ' + (claim?.id === c.id ? 'border-accent bg-accent-weak' : 'border-neutral-border hover:bg-surface-hover')}>
                    <span className="min-w-0 truncate"><span className="font-medium text-dash-heading">{c.patient_ref || 'Unnamed'}</span> <span className="text-xs text-dash-muted">{c.payer} · ₹{Number(c.total_amount)}</span></span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${RISK_CLS[c.denial_risk]}`}>{c.denial_risk}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_CLS[c.status]}`}>{c.status}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: claim editor */}
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-6 lg:col-span-3">
          {!claim ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center text-dash-muted"><Receipt size={24} className="mb-2 opacity-60" /><p className="text-sm">Code a signed note or open a claim to review.</p></div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-dash-heading">{claim.patient_ref || 'Unnamed'}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[claim.status]}`}>{claim.status}</span>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-dash-muted">Payer
                  <select value={claim.payer} disabled={!editable} onChange={(e) => setC({ payer: e.target.value })} className={inputCls}>{PAYERS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                </label>
              </div>

              {/* Denial risk */}
              <div className={`mb-4 rounded-xl border p-3 ${RISK_CLS[claim.denial_risk]}`}>
                <p className="flex items-center gap-1.5 text-sm font-semibold"><ShieldAlert size={15} /> Denial risk: {claim.denial_risk}</p>
                {claim.denial_reasons.length > 0 && <ul className="mt-1 list-inside list-disc text-xs">{claim.denial_reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>}
              </div>

              {/* ECHS cashless pre-authorisation */}
              {claim.payer === 'ECHS' && (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-neutral-border px-3 py-2 text-sm">
                  <span className="text-dash-body">
                    ECHS pre-auth:{' '}
                    {preauth
                      ? <span className={preauth.status === 'approved' ? 'font-medium text-ok' : 'font-medium text-wait'}>{preauth.status}{preauth.reference_id ? ` · ${preauth.reference_id}` : ''}{preauth.source === 'stub' ? ' (demo)' : ''}</span>
                      : <span className="text-dash-muted">not requested</span>}
                  </span>
                  <button onClick={raisePreauth} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-2.5 py-1 text-xs text-dash-body hover:bg-surface-hover disabled:opacity-50">{busy === 'preauth' ? <Loader2 size={12} className="animate-spin" /> : null} Raise pre-auth</button>
                </div>
              )}

              {/* Codes */}
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-dash-muted">Codes</p>
                  {editable && <button onClick={() => setC({ codes: [...claim.codes, { system: 'ICD-10-CM', code: '', description: '' }] })} className="inline-flex items-center gap-1 text-xs text-accent hover:underline"><Plus size={12} /> Add code</button>}</div>
                <div className="space-y-1">
                  {claim.codes.map((c: ClaimCode, i: number) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <select value={c.system} disabled={!editable} onChange={(e) => { const codes = [...claim.codes]; codes[i] = { ...c, system: e.target.value }; setC({ codes }); }} className={`${inputCls} w-28`}><option>ICD-10-CM</option><option>CPT</option></select>
                      <input value={c.code} disabled={!editable} onChange={(e) => { const codes = [...claim.codes]; codes[i] = { ...c, code: e.target.value }; setC({ codes }); }} placeholder="Code" className={`${inputCls} w-24`} />
                      <input value={c.description} disabled={!editable} onChange={(e) => { const codes = [...claim.codes]; codes[i] = { ...c, description: e.target.value }; setC({ codes }); }} placeholder="Description" className={`${inputCls} flex-1`} />
                      {editable && <button onClick={() => setC({ codes: claim.codes.filter((_: ClaimCode, j: number) => j !== i) })} className="rounded-md p-1 text-dash-muted hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>}
                    </div>
                  ))}
                  {claim.codes.length === 0 && <p className="text-xs text-dash-muted">No codes — add at least one before submitting.</p>}
                </div>
              </div>

              {/* Charges */}
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-dash-muted">Charges (₹, indicative)</p>
                  {editable && <button onClick={() => setC({ charges: [...claim.charges, { code: '', description: '', amount: 0 }] })} className="inline-flex items-center gap-1 text-xs text-accent hover:underline"><Plus size={12} /> Add charge</button>}</div>
                <div className="space-y-1">
                  {claim.charges.map((c: ClaimCharge, i: number) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input value={c.code} disabled={!editable} onChange={(e) => { const charges = [...claim.charges]; charges[i] = { ...c, code: e.target.value }; setC({ charges }); }} placeholder="Code" className={`${inputCls} w-24`} />
                      <input value={c.description} disabled={!editable} onChange={(e) => { const charges = [...claim.charges]; charges[i] = { ...c, description: e.target.value }; setC({ charges }); }} placeholder="Description" className={`${inputCls} flex-1`} />
                      <input value={String(c.amount)} disabled={!editable} onChange={(e) => { const charges = [...claim.charges]; charges[i] = { ...c, amount: Number(e.target.value) || 0 }; setC({ charges }); }} inputMode="decimal" placeholder="0" className={`${inputCls} w-24 text-right`} />
                      {editable && <button onClick={() => setC({ charges: claim.charges.filter((_: ClaimCharge, j: number) => j !== i) })} className="rounded-md p-1 text-dash-muted hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-end text-sm"><span className="text-dash-muted">Total:&nbsp;</span><span className="font-semibold text-dash-heading">₹{total}</span></div>
              </div>

              {claim.notes && <p className="mb-3 rounded-lg bg-surface-hover px-3 py-2 text-xs text-dash-muted">{claim.notes}</p>}

              {editable ? (
                <div className="flex items-center gap-2 border-t border-neutral-border pt-4">
                  <button onClick={submit} disabled={busy !== null || claim.codes.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy === 'submit' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Submit claim</button>
                  <button onClick={save} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg border border-neutral-border px-4 py-2 text-sm text-dash-body hover:bg-surface-hover disabled:opacity-50">{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save draft</button>
                  <span className="ml-1 text-xs text-dash-muted">Amounts are indicative — verify against the fee schedule.</span>
                </div>
              ) : (
                <p className="border-t border-neutral-border pt-4 text-sm text-dash-muted">Submitted {claim.submitted_at ? new Date(claim.submitted_at).toLocaleString() : ''} — this claim is locked.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
