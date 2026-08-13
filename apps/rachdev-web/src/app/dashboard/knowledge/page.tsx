'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, BookOpen, Plus, Upload, Trash2, RefreshCw, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { knowledgeBase, type KbDoc } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';

const INPUT = 'w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading outline-none focus:border-accent';

export default function KnowledgePage() {
  const { token } = useAuth();
  const [docs, setDocs] = useState<KbDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [citation, setCitation] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try { setDocs(await knowledgeBase.list(token)); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!token || !title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await knowledgeBase.add({ title: title.trim(), body: body.trim(), citation: citation.trim() || undefined }, token);
      setTitle(''); setBody(''); setCitation(''); toast.success('Added to knowledge base'); await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setBusy(true);
    try { await knowledgeBase.upload(file, token); toast.success(`Imported ${file.name}`); await load(); }
    catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function reindex() {
    if (!token) return;
    setBusy(true);
    try {
      const r = await knowledgeBase.reindex(token);
      toast.success(r.embedded > 0 ? `Indexed ${r.embedded} chunk${r.embedded === 1 ? '' : 's'} for semantic search` : (r.pending > 0 ? 'Embeddings not configured on this server' : 'Everything already indexed'));
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(d: KbDoc) {
    if (!token || !window.confirm(`Delete “${d.title}”? Agents will stop citing it.`)) return;
    try { await knowledgeBase.remove(d.id, token); toast.success('Deleted'); await load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Knowledge"
        subtitle="Reference docs your agents answer from. Add a knowledge tool to an agent or team, and it searches these — citing sources, grounded in your content."
        actions={
          <div className="flex gap-2">
            <button onClick={reindex} disabled={busy || docs.length === 0} title="Embed docs for semantic search" className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-body hover:bg-surface-hover disabled:opacity-50"><Sparkles size={15} /> Reindex</button>
            <button onClick={() => { setLoading(true); load(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
          </div>
        }
      />

      {/* Add / upload */}
      <div className="mt-6 rounded-2xl border border-neutral-border bg-surface-card p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-dash-heading"><Plus size={15} className="text-accent" /> Add a document</h3>
        <div className="mt-3 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Refund policy)" className={INPUT} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Paste the reference text…" rows={5} className={`${INPUT} resize-y`} />
          <input value={citation} onChange={(e) => setCitation(e.target.value)} placeholder="Source label or URL (optional)" className={INPUT} />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button onClick={add} disabled={busy || !title.trim() || !body.trim()} className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add</button>
            <span className="text-[12px] text-dash-muted">or</span>
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-3.5 py-2 text-[13px] font-medium text-dash-body hover:bg-surface-hover disabled:opacity-50"><Upload size={14} /> Upload .txt / .md / .pdf</button>
            <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.csv,.pdf" onChange={onFile} className="hidden" />
          </div>
        </div>
      </div>

      {/* Library */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-dash-heading">Library {docs.length > 0 && <span className="text-dash-muted">({docs.length})</span>}</h3>
        {loading ? (
          <p className="text-sm text-dash-muted">Loading…</p>
        ) : docs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-border p-8 text-center">
            <BookOpen size={22} className="mx-auto text-dash-muted" />
            <p className="mt-2 text-sm text-dash-muted">No documents yet. Add or upload your first reference above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-border bg-surface-card px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText size={16} className="shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-dash-heading">{d.title}</p>
                    <p className="text-[11px] text-dash-muted">{d.chunk_count} chunk{d.chunk_count === 1 ? '' : 's'} · {(d.char_len ?? 0).toLocaleString()} chars{d.citation ? ` · ${d.citation}` : ''}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {d.chunk_count > 0 && d.embedded_count === d.chunk_count ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-weak px-2 py-0.5 text-[10px] font-semibold text-accent"><Sparkles size={10} /> Semantic</span>
                  ) : d.embedded_count > 0 ? (
                    <span className="rounded-full bg-wait-bg px-2 py-0.5 text-[10px] font-semibold text-wait">Partial</span>
                  ) : (
                    <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-medium text-dash-muted">Keyword</span>
                  )}
                  <button onClick={() => remove(d)} title="Delete" className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-2.5 py-1.5 text-[12px] font-medium text-dash-body hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
