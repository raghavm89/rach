'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Sparkles, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { scribe, type ClinicalNote, type SoapNote, type CodeSuggestion } from '@rach/ui/lib/api';

const LANGS = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'pa-IN', label: 'Punjabi' },
];

const SOAP_FIELDS: { key: keyof SoapNote; label: string }[] = [
  { key: 'subjective', label: 'Subjective' },
  { key: 'objective',  label: 'Objective' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'plan',       label: 'Plan' },
];

export default function ScribePage() {
  const { token } = useAuth();

  const [patientRef, setPatientRef] = useState('');
  const [transcript, setTranscript] = useState('');
  const [lang, setLang] = useState('en-IN');

  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [soap, setSoap] = useState<SoapNote>({ subjective: '', objective: '', assessment: '', plan: '' });

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  // ── Browser dictation (Web Speech API) — the in-browser "audio" path ────────
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recogRef = useRef<any>(null);

  useEffect(() => {
    const SR = (typeof window !== 'undefined') &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) { setSpeechSupported(false); return; }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let finalChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalChunk += e.results[i][0].transcript;
      }
      if (finalChunk) setTranscript((t) => (t ? t + ' ' : '') + finalChunk.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    return () => { try { r.stop(); } catch { /* noop */ } };
  }, []);

  const toggleDictation = () => {
    const r = recogRef.current;
    if (!r) return;
    if (listening) { r.stop(); setListening(false); return; }
    r.lang = lang;
    try { r.start(); setListening(true); } catch { /* already started */ }
  };

  const source = listening || note?.source === 'dictation' ? 'dictation' : 'text';

  const generate = async () => {
    if (!token || !transcript.trim()) return;
    setGenerating(true); setError('');
    try {
      const { note: n } = await scribe.create(token, {
        transcript: transcript.trim(),
        patient_ref: patientRef.trim() || undefined,
        source,
      });
      setNote(n);
      setSoap(n.soap);
    } catch (e) {
      setError((e as Error).message || 'Could not generate the note.');
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = async () => {
    if (!token || !note) return;
    setSaving(true); setError('');
    try {
      const { note: n } = await scribe.update(token, note.id, { soap, codes: note.codes, follow_ups: note.follow_ups });
      setNote(n);
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
      await scribe.update(token, note.id, { soap, codes: note.codes, follow_ups: note.follow_ups });
      const { note: n } = await scribe.sign(token, note.id);
      setNote(n);
      setSoap(n.soap);
    } catch (e) {
      setError((e as Error).message || 'Could not sign the note.');
    } finally {
      setSigning(false);
    }
  };

  const reset = () => {
    setNote(null); setTranscript(''); setPatientRef('');
    setSoap({ subjective: '', objective: '', assessment: '', plan: '' });
    setError('');
  };

  const signed = note?.status === 'signed';

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-xl font-semibold text-ink">Scribe</h2>
        <span className="inline-flex items-center rounded-full bg-accent-weak px-2.5 py-0.5 text-xs font-semibold text-accent">Nora</span>
        <span className="text-sm text-ink-3">Transcript → SOAP note → your sign-off</span>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Input ── */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <input
              value={patientRef}
              onChange={(e) => setPatientRef(e.target.value)}
              placeholder="Patient (e.g. MRN or name)"
              className="w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
          </div>

          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-ink">Visit transcript</label>
            <div className="flex items-center gap-2">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                disabled={listening}
                className="rounded-lg border border-line bg-page px-2 py-1 text-xs text-ink-2 focus:border-accent focus:outline-none disabled:opacity-50"
              >
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleDictation}
                  className={
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ' +
                    (listening ? 'bg-red-50 text-red-600' : 'bg-band text-ink-2 hover:bg-line')
                  }
                >
                  {listening ? <MicOff size={13} /> : <Mic size={13} />}
                  {listening ? 'Stop' : 'Dictate'}
                </button>
              )}
            </div>
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Type or paste the doctor–patient conversation, or press Dictate to speak…"
            rows={12}
            className="w-full resize-y rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          {listening && <p className="mt-1 text-xs text-red-600">● Listening ({LANGS.find((l) => l.code === lang)?.label})…</p>}
          {!speechSupported && <p className="mt-1 text-xs text-ink-3">Dictation needs a Chrome-based browser; you can type or paste instead.</p>}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={generating || !transcript.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {generating ? 'Drafting…' : 'Generate SOAP note'}
            </button>
            {note && (
              <button type="button" onClick={reset} className="text-sm text-ink-3 hover:text-ink">
                New note
              </button>
            )}
          </div>
        </div>

        {/* ── Output ── */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          {!note ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center text-ink-3">
              <Sparkles size={24} className="mb-2 opacity-60" />
              <p className="text-sm">The drafted SOAP note will appear here for your review.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">SOAP note</h3>
                {signed ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-ok-line bg-ok-bg px-2.5 py-0.5 text-xs font-semibold text-ok">
                    <ShieldCheck size={12} /> Signed
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-wait-bg px-2.5 py-0.5 text-xs font-semibold text-wait">Draft</span>
                )}
              </div>

              <div className="space-y-3">
                {SOAP_FIELDS.map((f) => (
                  <div key={String(f.key)}>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-3">{f.label}</label>
                    <textarea
                      value={soap[f.key]}
                      onChange={(e) => setSoap((s: SoapNote) => ({ ...s, [f.key]: e.target.value }))}
                      readOnly={signed}
                      rows={2}
                      className="w-full resize-y rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none read-only:opacity-80"
                    />
                  </div>
                ))}
              </div>

              {note.codes.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">Suggested codes</p>
                  <div className="flex flex-wrap gap-2">
                    {note.codes.map((c: CodeSuggestion, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md border border-line bg-band px-2 py-1 text-xs text-ink-2">
                        <span className="font-semibold text-ink">{c.code}</span>
                        <span className="text-ink-3">{c.system}</span>
                        {c.description && <span className="max-w-[180px] truncate">· {c.description}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {note.follow_ups.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">Follow-ups</p>
                  <ul className="list-inside list-disc space-y-0.5 text-sm text-ink-2">
                    {note.follow_ups.map((f: string, i: number) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}

              <p className="mt-4 text-xs text-ink-3">
                {note.model ? `Drafted by ${note.model}. ` : ''}
                {signed
                  ? `Signed ${note.signed_at ? new Date(note.signed_at).toLocaleString() : ''}.`
                  : 'Draft — nothing is final until you approve and sign.'}
              </p>

              {!signed && (
                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={approveAndSign}
                    disabled={signing || saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-ok px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {signing ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    Approve &amp; Sign
                  </button>
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={saving || signing}
                    className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-band disabled:opacity-50"
                  >
                    {saving && <Loader2 size={15} className="animate-spin" />}
                    Save draft
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
