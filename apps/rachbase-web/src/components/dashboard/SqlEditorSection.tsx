'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search, Play, Save, FileCode, BookOpen, Star, Share2, ChevronDown, ChevronRight, Trash2, Activity } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { projects as api } from '@rach/ui/lib/api';

/**
 * SQL Editor (Supabase-style): a snippets sidebar (Private, persisted in localStorage), a
 * Templates gallery + Examples gallery, and the editor with Save / Run and Results / Chart.
 * Runs SQL against the project DB via `baasQuery` (deploy-gated).
 */
type Snippet = { id: string; name: string; sql: string };
type Result = { fields: string[]; rows: Record<string, unknown>[]; rowCount: number };

export default function SqlEditorSection({ token, projectId, onViewRunningQueries }: { token: string; projectId: number; onViewRunningQueries?: () => void }) {
  const [view, setView] = useState<'editor' | 'templates' | 'examples'>('editor');
  const [sql, setSql] = useState('');
  const [name, setName] = useState('Untitled query');
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [q, setQ] = useState('');
  const [openPrivate, setOpenPrivate] = useState(true);

  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState(''); const [running, setRunning] = useState(false);
  const [resTab, setResTab] = useState<'results' | 'chart'>('results');
  const [saved, setSaved] = useState(false);

  const storeKey = `rb_sql_snippets_${projectId}`;
  useEffect(() => { try { const raw = localStorage.getItem(storeKey); if (raw) setSnippets(JSON.parse(raw)); } catch { /* ignore */ } }, [storeKey]);
  function persist(next: Snippet[]) { setSnippets(next); try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ } }

  function loadInto(s: string, n = 'Untitled query') { setSql(s); setName(n); setView('editor'); setResult(null); setErr(''); setSaved(false); }
  function newQuery() { loadInto('', 'Untitled query'); }
  function save() {
    const clean = name.trim() || 'Untitled query';
    const next = [...snippets.filter((x) => x.name !== clean), { id: String(Date.now()), name: clean, sql }];
    persist(next); setSaved(true); setTimeout(() => setSaved(false), 1200);
  }
  function removeSnippet(id: string) { persist(snippets.filter((s) => s.id !== id)); }

  async function run() {
    setRunning(true); setErr(''); setResult(null);
    try { setResult(await api.baasQuery(token, projectId, sql)); }
    catch (e) { setErr((e as Error).message); }
    finally { setRunning(false); }
  }

  const privateList = snippets.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="grid grid-cols-[220px_1fr] gap-4">
      {/* Sidebar */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1"><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search queries..." className="w-full rounded-lg border border-neutral-border py-1.5 pl-8 pr-2 text-sm" /></div>
          <button onClick={newQuery} className="rounded-lg border border-neutral-border p-2 text-text-muted hover:text-text-primary" aria-label="New query"><Plus size={15} /></button>
        </div>

        <SidebarGroup icon={<Share2 size={12} />} label="Shared"><p className="px-2 py-3 text-center text-xs text-text-muted">No shared queries.</p></SidebarGroup>
        <SidebarGroup icon={<Star size={12} />} label="Favorites" collapsed><p className="px-2 py-3 text-center text-xs text-text-muted">No favorites.</p></SidebarGroup>

        <div>
          <button onClick={() => setOpenPrivate((o) => !o)} className="flex w-full items-center gap-1 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{openPrivate ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Private</button>
          {openPrivate && (privateList.length === 0
            ? <p className="rounded-lg border border-neutral-border p-3 text-center text-xs text-text-muted">No private queries yet. Save one from the editor.</p>
            : <ul className="rounded-lg border border-neutral-border p-1">{privateList.map((s) => (
                <li key={s.id} className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-bg-secondary">
                  <FileCode size={13} className="text-text-muted" /><button onClick={() => loadInto(s.sql, s.name)} className="flex-1 truncate text-left text-xs text-text-secondary">{s.name}</button>
                  <button onClick={() => removeSnippet(s.id)} className="opacity-0 group-hover:opacity-100"><Trash2 size={12} className="text-text-muted hover:text-red-600" /></button>
                </li>))}</ul>)}
        </div>

        <div>
          <p className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Reference</p>
          <button onClick={() => setView('templates')} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm', view === 'templates' ? 'bg-blue-50 text-primary-blue' : 'text-text-secondary hover:bg-bg-secondary')}><BookOpen size={14} /> Templates</button>
          <button onClick={() => setView('examples')} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm', view === 'examples' ? 'bg-blue-50 text-primary-blue' : 'text-text-secondary hover:bg-bg-secondary')}><BookOpen size={14} /> Examples</button>
        </div>

        {onViewRunningQueries && (
          <button onClick={onViewRunningQueries} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-border px-3 py-2 text-sm text-text-secondary hover:bg-bg-secondary">
            <Activity size={14} /> View running queries
          </button>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0">
        {view === 'templates' ? <Gallery title="Templates" desc="Reusable SQL snippets for common tasks." items={TEMPLATES} onPick={(it) => loadInto(it.sql, it.title)} />
          : view === 'examples' ? <Gallery title="Examples" desc="End-to-end examples and starter projects." items={EXAMPLES} onPick={(it) => loadInto(it.sql, it.title)} />
          : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-transparent px-2 py-1 text-sm font-medium text-text-primary hover:border-neutral-border focus:border-neutral-border" />
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs text-text-muted">Database</span>
                <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary">{saved ? <><Save size={14} className="text-emerald-600" /> Saved</> : <><Save size={14} /> Save</>}</button>
                <button onClick={run} disabled={running || !sql.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run</button>
              </div>
              <textarea value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false} placeholder="Start typing your SQL…" className="h-64 w-full resize-none rounded-xl border border-neutral-border bg-neutral-950 p-4 font-mono text-xs text-neutral-100 focus:outline-none" />
              <div className="rounded-xl border border-neutral-border">
                <div className="flex gap-4 border-b border-neutral-border px-4 text-sm">
                  {(['results', 'chart'] as const).map((t) => <button key={t} onClick={() => setResTab(t)} className={cn('-mb-px border-b-2 px-0.5 py-2 capitalize', resTab === t ? 'border-primary-blue font-medium text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary')}>{t}</button>)}
                </div>
                <div className="p-3">
                  {err && <p className="rounded-lg bg-red-50 px-3 py-2 font-mono text-xs text-red-600">{err}</p>}
                  {!err && !result && <p className="py-6 text-center text-sm text-text-muted">Click <span className="font-medium">Run</span> to execute your query.</p>}
                  {result && resTab === 'results' && <ResultsTable result={result} />}
                  {result && resTab === 'chart' && <ChartView result={result} />}
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

function SidebarGroup({ icon, label, children, collapsed }: { icon: React.ReactNode; label: string; children: React.ReactNode; collapsed?: boolean }) {
  const [open, setOpen] = useState(!collapsed);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {icon} {label}</button>
      {open && <div className="rounded-lg border border-neutral-border">{children}</div>}
    </div>
  );
}

function Gallery({ title, desc, items, onPick }: { title: string; desc: string; items: { title: string; desc: string; sql: string }[]; onPick: (it: { title: string; desc: string; sql: string }) => void }) {
  return (
    <div>
      <h3 className="text-base font-bold font-display text-text-primary">{title}</h3>
      <p className="mb-4 text-xs text-text-muted">{desc}</p>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {items.map((it) => (
          <button key={it.title} onClick={() => onPick(it)} className="rounded-xl border border-neutral-border bg-surface-card p-4 text-left hover:border-primary-blue">
            <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-bg-secondary text-[9px] font-bold text-text-muted">SQL</div>
            <p className="text-sm font-medium text-text-primary">{it.title}</p>
            <p className="mt-0.5 text-xs text-text-muted">{it.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultsTable({ result }: { result: Result }) {
  if (result.fields.length === 0) return <p className="py-4 text-center text-sm text-emerald-600">Success — {result.rowCount} row(s) affected.</p>;
  return (
    <div className="overflow-auto">
      <p className="mb-2 text-xs text-text-muted">{result.rowCount} row{result.rowCount === 1 ? '' : 's'}</p>
      <table className="w-full text-left text-xs">
        <thead className="bg-bg-secondary text-text-muted"><tr>{result.fields.map((f) => <th key={f} className="whitespace-nowrap px-2 py-1 font-medium">{f}</th>)}</tr></thead>
        <tbody className="divide-y divide-neutral-border">{result.rows.slice(0, 200).map((row, i) => <tr key={i}>{result.fields.map((f) => <td key={f} className="max-w-[240px] truncate whitespace-nowrap px-2 py-1 font-mono text-text-primary">{fmt(row[f])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// Minimal chart: bars of the first numeric column labelled by the first column.
function ChartView({ result }: { result: Result }) {
  const numField = useMemo(() => result.fields.find((f) => result.rows.every((r) => r[f] === null || !isNaN(Number(r[f])))), [result]);
  const labelField = result.fields[0];
  if (!numField) return <p className="py-6 text-center text-sm text-text-muted">No numeric column to chart.</p>;
  const max = Math.max(...result.rows.map((r) => Number(r[numField]) || 0), 1);
  return (
    <div className="space-y-1.5 py-2">
      {result.rows.slice(0, 20).map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-32 shrink-0 truncate text-text-muted">{fmt(r[labelField])}</span>
          <div className="h-4 flex-1 rounded bg-bg-secondary"><div className="h-full rounded bg-primary-blue" style={{ width: `${(Number(r[numField]) / max) * 100}%` }} /></div>
          <span className="w-16 shrink-0 text-right font-mono text-text-primary">{fmt(r[numField])}</span>
        </div>
      ))}
    </div>
  );
}

function fmt(v: unknown): string { if (v === null || v === undefined) return 'NULL'; if (typeof v === 'object') return JSON.stringify(v); return String(v); }

// ── Templates (reusable snippets) ───────────────────────────────────────────────
const TEMPLATES: { title: string; desc: string; sql: string }[] = [
  { title: 'Create table', desc: 'Basic table template. Change "table_name" to the name you prefer.', sql: `CREATE TABLE public.table_name (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  created_at timestamptz DEFAULT now()\n);` },
  { title: 'Add column', desc: 'Add a column to an existing table.', sql: `ALTER TABLE public.table_name\nADD COLUMN new_column text;` },
  { title: 'Add view', desc: 'Create a view over existing tables.', sql: `CREATE VIEW public.my_view AS\nSELECT * FROM public.table_name;` },
  { title: 'Add comments', desc: 'Add a comment to a table or column.', sql: `COMMENT ON TABLE public.table_name IS 'my description';\nCOMMENT ON COLUMN public.table_name.id IS 'primary key';` },
  { title: 'Show extensions', desc: 'List extensions and their status.', sql: `SELECT name, default_version, installed_version, comment\nFROM pg_available_extensions\nORDER BY name;` },
  { title: 'Show version', desc: 'Get your Postgres version.', sql: `SELECT version();` },
  { title: 'Show active connections', desc: 'Active and max connections.', sql: `SELECT count(*) AS active,\n  (SELECT setting::int FROM pg_settings WHERE name='max_connections') AS max\nFROM pg_stat_activity;` },
  { title: 'Automatically update timestamps', desc: 'Update a column timestamp on every update.', sql: `CREATE OR REPLACE FUNCTION public.set_updated_at()\nRETURNS trigger LANGUAGE plpgsql AS $$\nBEGIN NEW.updated_at = now(); RETURN NEW; END; $$;\n\nCREATE TRIGGER set_updated_at BEFORE UPDATE ON public.table_name\nFOR EACH ROW EXECUTE FUNCTION public.set_updated_at();` },
  { title: 'Most time consuming', desc: 'Aggregate time spent per query.', sql: `SELECT query, calls, total_exec_time, mean_exec_time\nFROM pg_stat_statements\nORDER BY total_exec_time DESC\nLIMIT 20;` },
  { title: 'Slowest execution time', desc: 'Slowest queries by max execution time.', sql: `SELECT query, max_exec_time, calls\nFROM pg_stat_statements\nORDER BY max_exec_time DESC\nLIMIT 20;` },
  { title: 'Hit rate', desc: 'Cache and index hit rate.', sql: `SELECT\n  sum(heap_blks_hit) / nullif(sum(heap_blks_hit)+sum(heap_blks_read),0) AS heap_hit_rate,\n  sum(idx_blks_hit) / nullif(sum(idx_blks_hit)+sum(idx_blks_read),0) AS idx_hit_rate\nFROM pg_statio_user_tables;` },
  { title: 'Large objects', desc: 'Largest tables/indexes in your database.', sql: `SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS size\nFROM pg_catalog.pg_statio_user_tables\nORDER BY pg_total_relation_size(relid) DESC\nLIMIT 20;` },
  { title: 'Table row counts', desc: 'Estimated row count per table.', sql: `SELECT relname AS table, n_live_tup AS rows\nFROM pg_stat_user_tables\nORDER BY n_live_tup DESC;` },
];

// ── Examples (starter projects) ─────────────────────────────────────────────────
const EXAMPLES: { title: string; desc: string; sql: string }[] = [
  { title: 'Colors', desc: 'A table of colors and their hex values.', sql: `CREATE TABLE public.colors (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  name text NOT NULL,\n  hex text NOT NULL\n);\nINSERT INTO public.colors (name, hex) VALUES\n  ('red','#ef4444'), ('green','#22c55e'), ('blue','#3b82f6');` },
  { title: 'Todo List', desc: 'A basic todo list with Row Level Security.', sql: `CREATE TABLE public.todos (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  user_id uuid DEFAULT auth.uid(),\n  task text CHECK (char_length(task) > 0),\n  is_complete boolean DEFAULT false,\n  inserted_at timestamptz DEFAULT now()\n);\nALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "own todos" ON public.todos\n  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);` },
  { title: 'User Management Starter', desc: 'A public Profiles table you can access via the API.', sql: `CREATE TABLE public.profiles (\n  id uuid PRIMARY KEY,\n  username text UNIQUE,\n  full_name text,\n  avatar_url text,\n  updated_at timestamptz DEFAULT now()\n);\nALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "public read" ON public.profiles FOR SELECT USING (true);\nCREATE POLICY "own update" ON public.profiles FOR UPDATE USING (auth.uid() = id);` },
  { title: 'Instruments', desc: 'An instruments table with sample data + RLS.', sql: `CREATE TABLE public.instruments (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  name text NOT NULL\n);\nINSERT INTO public.instruments (name) VALUES ('violin'), ('viola'), ('cello');\nALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "public read" ON public.instruments FOR SELECT USING (true);` },
  { title: 'Slack Clone', desc: 'Channels + messages with Row Level Security.', sql: `CREATE TABLE public.channels (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  slug text UNIQUE NOT NULL\n);\nCREATE TABLE public.messages (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  channel_id bigint REFERENCES public.channels(id),\n  user_id uuid DEFAULT auth.uid(),\n  message text,\n  inserted_at timestamptz DEFAULT now()\n);\nALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;` },
  { title: 'Stripe Subscriptions', desc: 'Customers + subscriptions starter schema.', sql: `CREATE TABLE public.customers (\n  id uuid PRIMARY KEY,\n  stripe_customer_id text\n);\nCREATE TABLE public.subscriptions (\n  id text PRIMARY KEY,\n  user_id uuid REFERENCES public.customers(id),\n  status text,\n  price_id text,\n  current_period_end timestamptz\n);` },
];
