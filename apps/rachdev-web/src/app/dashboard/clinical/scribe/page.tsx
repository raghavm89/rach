'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Sparkles, Check, AlertCircle, ShieldCheck, Trash2, Plus, ChevronRight, FileText, Pill, AlertTriangle } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { scribe, type ClinicalNote, type ClinicalNoteSummary, type SoapNote, type CodeSuggestion, type Medication, type DrugInteraction } from '@rach/ui/lib/api';

import { DICTATION_LANGS as LANGS } from '@/config/languages';

const SOAP_FIELDS: { key: keyof SoapNote; label: string }[] = [
  { key: 'subjective', label: 'Subjective' },
  { key: 'objective', label: 'Objective' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'plan', label: 'Plan' },
];

function relativeTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function dayBucket(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const t = new Date(iso).getTime();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (t >= startToday) return 'Today';
  if (t >= startToday - 86_400_000) return 'Yesterday';
  return 'Earlier';
}

const BUCKETS: ('Today' | 'Yesterday' | 'Earlier')[] = ['Today', 'Yesterday', 'Earlier'];

export default function ScribePage() {
  const { token } = useAuth();
  const [view, setView] = useState<'editor' | 'notes'>('editor');

  const [patientRef, setPatientRef] = useState('');
  const [visitId, setVisitId] = useState<number | null>(null);
  const [transcript, setTranscript] = useState('');
  const [lang, setLang] = useState('en-IN');

  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [soap, setSoap] = useState<SoapNote>({ subjective: '', objective: '', assessment: '', plan: '' });
  const [meds, setMeds] = useState<Medication[]>([]);
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [prescribing, setPrescribing] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [history, setHistory] = useState<ClinicalNoteSummary[]>([]);
  const loadHistory = async () => {
    if (!token) return;
    try { const { notes } = await scribe.list(token); setHistory(notes); } catch { /* non-fatal */ }
  };
  useEffect(() => { loadHistory(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  // Prefill from a Reception (Asha) hand-off, if present.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('rachdev_scribe_prefill');
      if (!raw) return;
      sessionStorage.removeItem('rachdev_scribe_prefill');
      const { transcript: pre, patient_ref, visit_id } = JSON.parse(raw);
      if (pre) setTranscript(pre);
      if (patient_ref) setPatientRef(patient_ref);
      if (visit_id) setVisitId(Number(visit_id));
      setView('editor');
    } catch { /* ignore */ }
  }, []);

  // ── Dictation (Web Speech API) ──────────────────────────────────────────────
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recogRef = useRef<any>(null);
  useEffect(() => {
    const SR = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) { setSpeechSupported(false); return; }
    const r = new SR();
    r.continuous = true; r.interimResults = true;
    r.onresult = (e: any) => {
      let finalChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) finalChunk += e.results[i][0].transcript;
      if (finalChunk) setTranscript((t) => (t ? t + ' ' : '') + finalChunk.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    return () => { try { r.stop(); } catch { /* noop */ } };
  }, []);
  const toggleDictation = () => {
    const r = recogRef.current; if (!r) return;
    if (listening) { r.stop(); setListening(false); return; }
    r.lang = lang; try { r.start(); setListening(true); } catch { /* already started */ }
  };
  const source = listening || note?.source === 'dictation' ? 'dictation' : 'text';

  const signed = note?.status === 'signed';
  const editingDraft = note?.status === 'draft';

  const generate = async () => {
    if (!token || !transcript.trim()) return;
    setGenerating(true); setError('');
    try {
      const { note: n } = await scribe.create(token, {
        transcript: transcript.trim(),
        patient_ref: patientRef.trim() || undefined,
        source,
        note_id: editingDraft ? note!.id : undefined, // continue the open draft in place
        visit_id: visitId ?? undefined,               // link the note to the OPD visit, if handed off
      });
      setNote(n); setSoap(n.soap); setMeds(n.medications ?? []); loadHistory();
    } catch (e) {
      setError((e as Error).message || 'Could not generate the note.');
    } finally {
      setGenerating(false);
    }
  };

  // Draft a structured e-prescription from the note's transcript/plan.
  const draftRx = async () => {
    if (!token || !note) return;
    setPrescribing(true); setError('');
    try {
      const { note: n, interactions: warn } = await scribe.prescribe(token, note.id);
      setNote(n); setMeds(n.medications ?? []); setInteractions(warn);
    } catch (e) {
      setError((e as Error).message || 'Could not draft the prescription.');
    } finally {
      setPrescribing(false);
    }
  };

  // Live drug-interaction screen whenever the medication list changes.
  useEffect(() => {
    if (!token || meds.length === 0) { setInteractions([]); return; }
    let cancelled = false;
    scribe.checkInteractions(token, meds).then((r: { interactions: DrugInteraction[] }) => { if (!cancelled) setInteractions(r.interactions); }).catch(() => {});
    return () => { cancelled = true; };
  }, [token, meds]);

  const saveDraft = async () => {
    if (!token || !note) return;
    setSaving(true); setError('');
    try {
      const { note: n } = await scribe.update(token, note.id, { soap, codes: note.codes, follow_ups: note.follow_ups, medications: meds });
      setNote(n); loadHistory();
    } catch (e) {
      setError((e as Error).message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const approveAndSign = async () => {
    if (!token || !note) return;
    setSigning(true); setError('');
    try {
      await scribe.update(token, note.id, { soap, codes: note.codes, follow_ups: note.follow_ups, medications: meds });
      const { note: n } = await scribe.sign(token, note.id);
      setNote(n); setSoap(n.soap); setMeds(n.medications ?? []); loadHistory();
    } catch (e) {
      setError((e as Error).message || 'Could not sign the note.');
    } finally {
      setSigning(false);
    }
  };

  const newNote = () => {
    setNote(null); setTranscript(''); setPatientRef(''); setVisitId(null);
    setSoap({ subjective: '', objective: '', assessment: '', plan: '' }); setMeds([]); setInteractions([]);
    setError(''); setView('editor');
  };

  const openNote = async (id: number) => {
    if (!token) return;
    setError('');
    try {
      const { note: n } = await scribe.get(token, id);
      setNote(n); setSoap(n.soap); setMeds(n.medications ?? []); setPatientRef(n.patient_ref ?? ''); setTranscript(n.transcript ?? ''); setVisitId(n.visit_id ?? null);
      setView('editor');
    } catch (e) {
      setError((e as Error).message || 'Could not open the note.');
    }
  };

  const deleteDraft = async (id: number) => {
    if (!token) return;
    setDeletingId(id); setError('');
    try {
      await scribe.remove(token, id);
      if (note?.id === id) newNote();
      loadHistory();
    } catch (e) {
      setError((e as Error).message || 'Could not delete the draft.');
    } finally {
      setDeletingId(null);
    }
  };

  const draftCount = history.filter((h) => h.status === 'draft').length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-dash-heading">Scribe</h2>
          <span className="inline-flex items-center rounded-full bg-accent-weak px-2.5 py-0.5 text-xs font-semibold text-accent">Naina</span>
          <span className="hidden text-sm text-dash-muted sm:inline">Transcript → SOAP note → your sign-off</span>
        </div>
        {/* Panel switch */}
        <div className="flex items-center gap-1 rounded-lg border border-neutral-border bg-surface-card p-0.5">
          <button
            onClick={() => setView('editor')}
            className={'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' + (view === 'editor' ? 'bg-surface-hover text-dash-heading' : 'text-dash-muted hover:text-dash-body')}
          >
            {note ? (signed ? 'Note' : 'Editing draft') : 'New note'}
          </button>
          <button
            onClick={() => { setView('notes'); loadHistory(); }}
            className={'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' + (view === 'notes' ? 'bg-surface-hover text-dash-heading' : 'text-dash-muted hover:text-dash-body')}
          >
            Notes
            {history.length > 0 && <span className="rounded-full bg-surface-hover px-1.5 text-[11px] text-dash-muted">{history.length}</span>}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {view === 'editor' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Input ── */}
          <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
            {editingDraft && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-wait-bg px-3 py-2 text-xs text-wait">
                <FileText size={13} /> Editing a draft — Generate updates this note in place.
              </div>
            )}
            {visitId && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-accent-weak px-3 py-2 text-xs text-accent">
                <FileText size={13} /> Linked to OPD visit #{visitId} — this note documents that visit and unlocks its completion.
              </div>
            )}
            <input
              value={patientRef}
              onChange={(e) => setPatientRef(e.target.value)}
              placeholder="Patient (e.g. MRN or name)"
              className="mb-4 w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading placeholder:text-dash-muted focus:border-accent focus:outline-none"
            />

            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-dash-heading">Visit transcript</label>
              <div className="flex items-center gap-2">
                <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={listening}
                  className="rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-xs text-dash-body focus:border-accent focus:outline-none disabled:opacity-50">
                  {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                {speechSupported && (
                  <button type="button" onClick={toggleDictation}
                    className={'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ' + (listening ? 'bg-red-50 text-red-600' : 'bg-surface-hover text-dash-body hover:bg-line')}>
                    {listening ? <MicOff size={13} /> : <Mic size={13} />} {listening ? 'Stop' : 'Dictate'}
                  </button>
                )}
              </div>
            </div>

            <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)}
              placeholder="Type or paste the doctor–patient conversation, or press Dictate to speak…" rows={12}
              className="w-full resize-y rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading placeholder:text-dash-muted focus:border-accent focus:outline-none" />
            {listening && <p className="mt-1 text-xs text-red-600">● Listening ({LANGS.find((l) => l.code === lang)?.label})…</p>}
            {!speechSupported && <p className="mt-1 text-xs text-dash-muted">Dictation needs a Chrome-based browser; you can type or paste instead.</p>}

            <div className="mt-4 flex items-center gap-3">
              <button type="button" onClick={generate} disabled={generating || !transcript.trim() || signed}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {generating ? 'Drafting…' : editingDraft ? 'Regenerate draft' : 'Generate SOAP note'}
              </button>
              {note && (
                <button type="button" onClick={newNote} className="inline-flex items-center gap-1.5 text-sm text-dash-muted hover:text-dash-heading">
                  <Plus size={14} /> New note
                </button>
              )}
            </div>
          </div>

          {/* ── Output ── */}
          <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
            {!note ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center text-dash-muted">
                <Sparkles size={24} className="mb-2 opacity-60" />
                <p className="text-sm">The drafted SOAP note will appear here for your review.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-dash-heading">SOAP note</h3>
                  {signed ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-ok-line bg-ok-bg px-2.5 py-0.5 text-xs font-semibold text-ok"><ShieldCheck size={12} /> Signed</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-wait-bg px-2.5 py-0.5 text-xs font-semibold text-wait">Draft</span>
                  )}
                </div>

                <div className="space-y-3">
                  {SOAP_FIELDS.map((f) => (
                    <div key={String(f.key)}>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dash-muted">{f.label}</label>
                      <textarea value={soap[f.key]} onChange={(e) => setSoap((s: SoapNote) => ({ ...s, [f.key]: e.target.value }))}
                        readOnly={signed} rows={2}
                        className="w-full resize-y rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none read-only:opacity-80" />
                    </div>
                  ))}
                </div>

                {note.codes.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-dash-muted">Suggested codes</p>
                    <div className="flex flex-wrap gap-2">
                      {note.codes.map((c: CodeSuggestion, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-md border border-neutral-border bg-surface-hover px-2 py-1 text-xs text-dash-body">
                          <span className="font-semibold text-dash-heading">{c.code}</span><span className="text-dash-muted">{c.system}</span>
                          {c.description && <span className="max-w-[180px] truncate">· {c.description}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {note.follow_ups.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-dash-muted">Follow-ups</p>
                    <ul className="list-inside list-disc space-y-0.5 text-sm text-dash-body">
                      {note.follow_ups.map((f: string, i: number) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}

                {/* ── E-prescription ── */}
                <div className="mt-5 border-t border-neutral-border pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dash-muted"><Pill size={13} /> Prescription {meds.length > 0 && <span className="font-normal text-dash-muted">({meds.length})</span>}</p>
                    <div className="flex items-center gap-2">
                      {!signed && <button type="button" onClick={draftRx} disabled={prescribing} className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50">{prescribing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Draft Rx</button>}
                      {!signed && <button type="button" onClick={() => setMeds([...meds, { drug: '', dose: '', frequency: '', route: '', duration: '' }])} className="inline-flex items-center gap-1 text-xs text-accent hover:underline"><Plus size={12} /> Add</button>}
                    </div>
                  </div>

                  {/* Interaction warnings */}
                  {interactions.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {interactions.map((w: DrugInteraction, i: number) => (
                        <div key={i} className={'flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ' + (w.severity === 'major' ? 'border-red-200 bg-red-50 text-red-600' : w.severity === 'moderate' ? 'border-wait-bg bg-wait-bg text-wait' : 'border-neutral-border bg-surface-hover text-dash-body')}>
                          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                          <span><span className="font-semibold uppercase">{w.severity}</span> · {w.description}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {meds.length === 0 ? (
                    <p className="text-xs text-dash-muted">No medications. Draft from the transcript or add manually.</p>
                  ) : (
                    <div className="space-y-1">
                      {meds.map((m: Medication, i: number) => (
                        <div key={i} className="flex flex-wrap items-center gap-1.5">
                          <input value={m.drug} readOnly={signed} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, drug: e.target.value } : x))} placeholder="Drug" className="w-36 rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-heading focus:border-accent focus:outline-none" />
                          <input value={m.dose ?? ''} readOnly={signed} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, dose: e.target.value } : x))} placeholder="Dose" className="w-20 rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-heading focus:border-accent focus:outline-none" />
                          <input value={m.frequency ?? ''} readOnly={signed} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, frequency: e.target.value } : x))} placeholder="Freq" className="w-20 rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-heading focus:border-accent focus:outline-none" />
                          <input value={m.route ?? ''} readOnly={signed} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, route: e.target.value } : x))} placeholder="Route" className="w-16 rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-heading focus:border-accent focus:outline-none" />
                          <input value={m.duration ?? ''} readOnly={signed} onChange={(e) => setMeds(meds.map((x, j) => j === i ? { ...x, duration: e.target.value } : x))} placeholder="Duration" className="w-24 rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-heading focus:border-accent focus:outline-none" />
                          {!signed && <button type="button" onClick={() => setMeds(meds.filter((_, j) => j !== i))} className="rounded-md p-1 text-dash-muted hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <p className="mt-4 text-xs text-dash-muted">
                  {signed
                    ? `Signed ${note.signed_at ? new Date(note.signed_at).toLocaleString() : ''}.`
                    : 'Draft — nothing is final until you approve and sign.'}
                </p>

                {!signed && (
                  <div className="mt-5 flex items-center gap-3">
                    <button type="button" onClick={approveAndSign} disabled={signing || saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-ok px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                      {signing ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Approve &amp; Sign
                    </button>
                    <button type="button" onClick={saveDraft} disabled={saving || signing}
                      className="inline-flex items-center gap-2 rounded-lg border border-neutral-border px-4 py-2.5 text-sm font-medium text-dash-body transition-colors hover:bg-surface-hover disabled:opacity-50">
                      {saving && <Loader2 size={15} className="animate-spin" />} Save draft
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── Notes panel ── */
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-dash-heading">Notes {draftCount > 0 && <span className="ml-1 text-xs font-normal text-dash-muted">· {draftCount} draft{draftCount > 1 ? 's' : ''}</span>}</h3>
            <button onClick={newNote} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
              <Plus size={13} /> New note
            </button>
          </div>

          {history.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <FileText size={22} className="mx-auto mb-2 text-dash-muted" />
              <p className="text-sm font-medium text-dash-heading">No notes yet</p>
              <p className="mt-1 text-xs text-dash-muted">Generate your first SOAP note to see it here.</p>
            </div>
          ) : (
            BUCKETS.map((bucket) => {
              const items = history.filter((h) => dayBucket(h.signed_at || h.updated_at) === bucket);
              if (items.length === 0) return null;
              return (
                <div key={bucket} className="mb-1">
                  <div className="mt-3 mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-dash-muted">{bucket}</div>
                  {items.map((h) => {
                    const isSigned = h.status === 'signed';
                    const active = note?.id === h.id;
                    return (
                      <div key={h.id}
                        className={'group flex items-center gap-3 rounded-lg px-2.5 py-2.5 ' + (active ? 'bg-accent-weak/40 ring-1 ring-accent/30' : 'hover:bg-surface-hover/50')}>
                        <span className={'h-2 w-2 shrink-0 rounded-full ' + (isSigned ? 'bg-ok' : 'bg-wait')} />
                        <button onClick={() => openNote(h.id)} className="flex min-w-0 flex-1 flex-col items-start text-left">
                          <span className="flex items-center gap-2">
                            <span className="text-[13.5px] font-medium text-dash-heading">{h.patient_ref || 'Unnamed patient'}</span>
                            <span className={'rounded-full px-1.5 py-0.5 text-[10px] font-semibold ' + (isSigned ? 'bg-ok-bg text-ok' : 'bg-wait-bg text-wait')}>{isSigned ? 'Signed' : 'Draft'}</span>
                          </span>
                          <span className="mt-0.5 max-w-full truncate text-[12px] text-dash-muted">{h.preview || 'No content yet'}</span>
                        </button>
                        <span className="shrink-0 text-[11px] text-dash-muted">{relativeTime(h.signed_at || h.updated_at)}</span>
                        {isSigned ? (
                          <ChevronRight size={15} className="shrink-0 text-dash-muted" />
                        ) : (
                          <button
                            onClick={() => deleteDraft(h.id)}
                            disabled={deletingId === h.id}
                            aria-label="Delete draft"
                            className="shrink-0 rounded-md p-1 text-dash-muted opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
                          >
                            {deletingId === h.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
