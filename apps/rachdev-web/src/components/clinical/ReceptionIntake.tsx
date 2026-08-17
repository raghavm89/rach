'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Sparkles, Check, Search, X } from 'lucide-react';
import { reception, opd, type Encounter, type IntakeData, type Patient } from '@rach/ui/lib/api';

import { DICTATION_LANGS as LANGS } from '@/config/languages';
const EMPTY: IntakeData = { patient: { name: '', age: '', sex: '' }, reason: '', history: '', medications: [], allergies: [], vitals: '', triage_summary: '' };

// When a patient is attached from search, that record is the source of truth for
// identity — fill Name/Age/Sex from it (the AI only extracts what's in the
// conversation, which usually omits these). Falls back to the AI values.
function withPatientIdentity(intake: IntakeData, p: Patient | null): IntakeData {
  if (!p) return intake;
  return {
    ...intake,
    patient: {
      name: p.name || intake.patient.name || '',
      age: (p.age != null && String(p.age) !== '' ? String(p.age) : intake.patient.age) || '',
      sex: p.sex || intake.patient.sex || '',
    },
  };
}

/** AI intake assist (Asha): conversation → structured intake → confirm. */
export function ReceptionIntake({ token, onConfirmed }: { token: string; onConfirmed?: () => void }) {
  const [patientRef, setPatientRef] = useState('');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lang, setLang] = useState('en-IN');
  const [enc, setEnc] = useState<Encounter | null>(null);
  const [intake, setIntake] = useState<IntakeData>(EMPTY);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recogRef = useRef<any>(null);
  useEffect(() => {
    const SR = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) { setSpeechSupported(false); return; }
    const r = new SR();
    r.continuous = true; r.interimResults = true;
    r.onresult = (ev: any) => { let f = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) f += ev.results[i][0].transcript; if (f) setTranscript((t) => (t ? t + ' ' : '') + f.trim()); };
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    recogRef.current = r;
    return () => { try { r.stop(); } catch { /* noop */ } };
  }, []);
  const toggle = () => { const r = recogRef.current; if (!r) return; if (listening) { r.stop(); setListening(false); return; } r.lang = lang; try { r.start(); setListening(true); } catch { /* */ } };

  const confirmed = enc?.status === 'confirmed';
  const patch = (p: Partial<IntakeData>) => setIntake((s: IntakeData) => ({ ...s, ...p }));

  const search = async () => {
    if (!q.trim()) return;
    setSearching(true); setError('');
    try { const { patients } = await opd.searchPatients(token, q.trim()); setResults(patients); }
    catch (e) { setError((e as Error).message); } finally { setSearching(false); }
  };
  const pick = (p: Patient) => {
    setPatient(p); setPatientRef(p.uhid || p.name); setResults([]); setQ('');
    // If an intake was already structured, backfill identity from the newly attached patient.
    if (enc) setIntake((s) => withPatientIdentity(s, p));
  };
  const clearPatient = () => { setPatient(null); setPatientRef(''); };

  // A picked patient anchors the intake to an existing record; otherwise fall back
  // to whatever was typed (name/MRN), which confirm resolves or creates.
  const refForCreate = (patient?.uhid || patient?.name || patientRef).trim();

  const generate = async () => {
    if (!transcript.trim()) return;
    setGenerating(true); setError('');
    try {
      const { encounter } = await reception.create(token, { transcript: transcript.trim(), patient_ref: refForCreate || undefined, source: listening ? 'dictation' : 'text', encounter_id: enc && enc.status === 'open' ? enc.id : undefined });
      setEnc(encounter); setIntake(withPatientIdentity(encounter.intake, patient));
    } catch (e) { setError((e as Error).message); } finally { setGenerating(false); }
  };
  const confirm = async () => {
    if (!enc) return;
    setConfirming(true); setError('');
    try { await reception.update(token, enc.id, { intake }); const { encounter } = await reception.confirm(token, enc.id); setEnc(encounter); setIntake(encounter.intake); onConfirmed?.(); }
    catch (e) { setError((e as Error).message); } finally { setConfirming(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
        {patient ? (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-accent bg-accent-weak px-3 py-2 text-sm">
            <span><span className="font-medium text-dash-heading">{patient.name}</span> <span className="text-xs text-dash-muted">HID {patient.uhid}{patient.phone ? ` · ${patient.phone}` : ''}{patient.sex ? ` · ${patient.sex}` : ''}{patient.age ? ` · ${patient.age}` : ''}</span></span>
            <button type="button" onClick={clearPatient} title="Clear patient" className="rounded-md p-1 text-dash-muted hover:bg-surface-hover hover:text-dash-heading"><X size={14} /></button>
          </div>
        ) : (
          <div className="mb-4">
            <div className="flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search patient — name, HID, service no. or phone"
                className="w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
              <button type="button" onClick={search} disabled={searching || !q.trim()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}</button>
            </div>
            {results.length > 0 && (
              <div className="mt-2 space-y-1">
                {results.map((p) => (
                  <button key={p.id} type="button" onClick={() => pick(p)} className="flex w-full items-center justify-between rounded-lg border border-neutral-border px-3 py-2 text-left text-sm hover:bg-surface-hover">
                    <span><span className="font-medium text-dash-heading">{p.name}</span> <span className="text-xs text-dash-muted">{p.uhid}{p.phone ? ` · ${p.phone}` : ''}{p.sex ? ` · ${p.sex}` : ''}{p.age ? ` · ${p.age}` : ''}</span></span>
                    {p.source_system !== 'local' && <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] uppercase text-dash-muted">{p.source_system}</span>}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-xs text-dash-muted">Optional — search to attach an existing patient, or dictate below and confirm to register a new one.</p>
          </div>
        )}
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-dash-heading">Reception conversation</label>
          <div className="flex items-center gap-2">
            <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={listening} className="rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-xs text-dash-body focus:border-accent focus:outline-none disabled:opacity-50">
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            {speechSupported && <button type="button" onClick={toggle} className={'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ' + (listening ? 'bg-red-50 text-red-600' : 'bg-surface-hover text-dash-body')}>{listening ? <MicOff size={13} /> : <Mic size={13} />} {listening ? 'Stop' : 'Dictate'}</button>}
          </div>
        </div>
        <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={10} placeholder="Type or paste the intake conversation…"
          className="w-full resize-y rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button onClick={generate} disabled={generating || !transcript.trim()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {generating ? 'Structuring…' : 'Structure intake'}
        </button>
      </div>

      <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
        {!enc ? (
          <div className="flex h-full min-h-[260px] items-center justify-center text-center text-sm text-dash-muted">The structured intake appears here.</div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-dash-heading">Patient intake</h3>
              {confirmed ? <span className="rounded-full border border-ok-line bg-ok-bg px-2.5 py-0.5 text-xs font-semibold text-ok">Confirmed</span> : <span className="rounded-full bg-wait-bg px-2.5 py-0.5 text-xs font-semibold text-wait">Draft</span>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['name', 'age', 'sex'] as const).map((k) => (
                <div key={k}><label className="mb-1 block text-xs uppercase text-dash-muted">{k}</label>
                  <input value={intake.patient[k]} readOnly={confirmed} onChange={(e) => patch({ patient: { ...intake.patient, [k]: e.target.value } })} className="w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" /></div>
              ))}
            </div>
            <div className="mt-3 space-y-3">
              {([['reason', 'Reason for visit'], ['triage_summary', 'Triage summary']] as const).map(([k, label]) => (
                <div key={k}><label className="mb-1 block text-xs uppercase text-dash-muted">{label}</label>
                  <textarea value={intake[k]} readOnly={confirmed} rows={k === 'triage_summary' ? 6 : 2} onChange={(e) => patch({ [k]: e.target.value } as Partial<IntakeData>)} className="w-full resize-y rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" /></div>
              ))}
            </div>
            {!confirmed && <button onClick={confirm} disabled={confirming} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ok px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{confirming ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Confirm intake</button>}
          </>
        )}
      </div>
    </div>
  );
}
