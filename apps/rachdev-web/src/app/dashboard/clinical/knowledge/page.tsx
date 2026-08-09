'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, BookOpen, Sparkles, AlertCircle, Plus, Trash2, Quote, ShieldCheck, Globe } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { knowledge, type KnowledgeDoc, type KnowledgeAnswer, type WebReferences, type WebReference } from '@rach/ui/lib/api';

export default function KnowledgePage() {
  const { token } = useAuth();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<KnowledgeAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  // Controlled web-reference bypass
  const [web, setWeb] = useState<WebReferences | null>(null);
  const [webBusy, setWebBusy] = useState(false);

  // Add-doc form
  const [showAdd, setShowAdd] = useState(false);
  const [nd, setNd] = useState({ title: '', body: '', citation: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadDocs = useCallback(async () => {
    if (!token) return;
    try { const { docs } = await knowledge.docs(token); setDocs(docs); } catch (e) { setError((e as Error).message); }
  }, [token]);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  const ask = async () => {
    if (!token || !question.trim()) return;
    setAsking(true); setError(''); setAnswer(null); setWeb(null);
    try { setAnswer(await knowledge.ask(token, question.trim())); }
    catch (e) { setError((e as Error).message); } finally { setAsking(false); }
  };
  const lookupWeb = async () => {
    if (!token || !question.trim()) return;
    setWebBusy(true); setError('');
    try { setWeb(await knowledge.web(token, question.trim())); }
    catch (e) { setError((e as Error).message); } finally { setWebBusy(false); }
  };
  const addDoc = async () => {
    if (!token || !nd.title.trim() || !nd.body.trim()) return;
    setSaving(true); setError('');
    try { await knowledge.addDoc(token, { title: nd.title.trim(), body: nd.body.trim(), citation: nd.citation.trim() || undefined });
      setNd({ title: '', body: '', citation: '' }); setShowAdd(false); loadDocs();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };
  const del = async (id: number) => {
    if (!token) return;
    setDeletingId(id);
    try { await knowledge.deleteDoc(token, id); loadDocs(); } catch (e) { setError((e as Error).message); } finally { setDeletingId(null); }
  };

  const inputCls = 'w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none';

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-xl font-semibold text-dash-heading">Knowledge</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-weak px-2.5 py-0.5 text-xs font-semibold text-accent"><BookOpen size={12} /> Ira</span>
        <span className="hidden text-sm text-dash-muted sm:inline">Answers only from approved sources · always cited · never diagnoses</span>
      </div>

      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle size={15} /> {error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ask */}
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
          <label className="mb-1 block text-sm font-medium text-dash-heading">Ask a question</label>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} placeholder="e.g. What is the AFMS protocol for suspected HAPO?" className={`${inputCls} resize-y`} />
          <button onClick={ask} disabled={asking || !question.trim()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {asking ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {asking ? 'Searching sources…' : 'Ask Ira'}
          </button>

          {answer && (
            <div className="mt-4 rounded-xl border border-neutral-border p-4">
              {!answer.can_answer ? (
                <div className="flex items-start gap-2 text-sm text-wait"><ShieldCheck size={15} className="mt-0.5" /><p>{answer.answer}</p></div>
              ) : (
                <>
                  <p className="text-sm text-dash-body">{answer.answer}</p>
                  {answer.citations.length > 0 && (
                    <div className="mt-3 border-t border-neutral-border pt-3">
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dash-muted"><Quote size={12} /> Sources</p>
                      <ul className="space-y-1">
                        {answer.citations.map((c: { title: string; ref: string }, i: number) => (
                          <li key={i} className="text-xs text-dash-body"><span className="font-medium text-dash-heading">{c.title}</span>{c.ref ? <span className="text-dash-muted"> — {c.ref}</span> : null}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              <p className="mt-3 text-[11px] text-dash-muted">General information from approved sources only — not a diagnosis or personal medical advice.</p>
              <div className="mt-3 border-t border-neutral-border pt-2">
                <button onClick={lookupWeb} disabled={webBusy} className="inline-flex items-center gap-1.5 text-xs text-dash-muted hover:text-dash-heading disabled:opacity-50">
                  {webBusy ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />} Look up web references (external)
                </button>
              </div>
            </div>
          )}

          {web && (
            <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-orange-700"><Globe size={13} /> External web references — unverified</p>
              {!web.enabled ? (
                <p className="mt-1 text-sm text-orange-700">{web.note}</p>
              ) : (
                <>
                  <ul className="mt-2 space-y-1.5">
                    {web.references.map((r: WebReference, i: number) => (
                      <li key={i} className="text-sm"><a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-orange-800 underline">{r.title}</a><span className="block text-xs text-orange-700">{r.snippet}</span></li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-orange-700">{web.note || 'External sources — clinician reference only.'} No patient data was sent; this lookup is logged.</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Approved library */}
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-dash-heading"><BookOpen size={15} /> Approved sources <span className="font-normal text-dash-muted">({docs.length})</span></h3>
            <button onClick={() => setShowAdd((x) => !x)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"><Plus size={13} /> Add source</button>
          </div>

          {showAdd && (
            <div className="mb-3 space-y-2 rounded-xl border border-dashed border-neutral-border p-3">
              <input value={nd.title} onChange={(e) => setNd({ ...nd, title: e.target.value })} placeholder="Title — e.g. AFMS High-Altitude Pulmonary Oedema Protocol" className={inputCls} />
              <textarea value={nd.body} onChange={(e) => setNd({ ...nd, body: e.target.value })} rows={4} placeholder="Approved content Ira may answer from…" className={`${inputCls} resize-y`} />
              <input value={nd.citation} onChange={(e) => setNd({ ...nd, citation: e.target.value })} placeholder="Citation / source reference (optional)" className={inputCls} />
              <button onClick={addDoc} disabled={saving || !nd.title.trim() || !nd.body.trim()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />} Save source</button>
            </div>
          )}

          {docs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-border px-3 py-8 text-center text-sm text-dash-muted">No approved sources yet. Ira only answers from content you add here.</p>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="rounded-lg border border-neutral-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-dash-heading">{d.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-dash-muted">{d.body}</p>
                      {d.citation && <p className="mt-1 text-[11px] text-dash-muted">— {d.citation}</p>}
                    </div>
                    <button onClick={() => del(d.id)} disabled={deletingId === d.id} aria-label="Delete source" className="shrink-0 rounded-md p-1 text-dash-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                      {deletingId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
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
