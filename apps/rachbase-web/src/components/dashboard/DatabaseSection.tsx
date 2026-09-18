'use client';

import { useEffect, useState } from 'react';
import { Loader2, Table2, FunctionSquare, Zap, Shapes, Blocks, ListTree, Radio, Shield, Users, Settings, ServerCrash, Plus, Trash2, Play, X, Database, GitBranch, Archive, History, Search, Copy } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { projects as api } from '@rach/ui/lib/api';

/**
 * Backend → Database (Supabase-style). Everything here runs SQL against the project database via
 * the existing `baasQuery` endpoint, so it's deploy-gated like the Data tab. Lists are SELECTs
 * over the catalog; creates run DDL. Platform pages (Replication/Backups/Migrations) are
 * infra-managed and shown as informational.
 */
type Row = Record<string, unknown>;

// Safely quote a Postgres identifier (table/column/type name) — doubles embedded quotes and caps
// at Postgres's 63-byte limit. Used for all client-built DDL so a typed name can't break out.
export function quoteIdent(name: string): string {
  return `"${String(name).slice(0, 63).replace(/"/g, '""')}"`;
}

const NAV = [
  { group: 'Database Management', items: [
    { key: 'schema', label: 'Schema Visualizer', icon: GitBranch },
    { key: 'tables', label: 'Tables', icon: Table2 },
    { key: 'functions', label: 'Functions', icon: FunctionSquare },
    { key: 'triggers', label: 'Triggers', icon: Zap },
    { key: 'enums', label: 'Enumerated Types', icon: Shapes },
    { key: 'extensions', label: 'Extensions', icon: Blocks },
    { key: 'indexes', label: 'Indexes', icon: ListTree },
    { key: 'publications', label: 'Publications', icon: Radio },
  ] },
  { group: 'Access Control', items: [
    { key: 'policies', label: 'Policies', icon: Shield },
    { key: 'roles', label: 'Roles', icon: Users },
  ] },
  { group: 'Configuration', items: [{ key: 'settings', label: 'Settings', icon: Settings }] },
  { group: 'Platform', items: [
    { key: 'backups', label: 'Backups', icon: Archive },
    { key: 'migrations', label: 'Migrations', icon: History },
  ] },
] as const;

type PageKey = (typeof NAV)[number]['items'][number]['key'];

export default function DatabaseSection({ token, projectId, onCreateTable }: { token: string; projectId: number; onCreateTable?: () => void }) {
  const [page, setPage] = useState<PageKey>('tables');
  return (
    <div className="grid grid-cols-[190px_1fr] gap-6">
      <nav className="space-y-4">
        {NAV.map((g) => (
          <div key={g.group}>
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{g.group}</p>
            <div className="space-y-0.5">
              {g.items.map((i) => (
                <button key={i.key} onClick={() => setPage(i.key)} className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm', page === i.key ? 'bg-blue-50 font-medium text-primary-blue' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary')}>
                  <i.icon size={15} /> {i.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="min-w-0"><Page page={page} token={token} projectId={projectId} onCreateTable={onCreateTable} /></div>
    </div>
  );
}

// Run a SQL query against the project DB. Returns rows/fields + down/error state (deploy-gated).
function useSql(token: string, projectId: number, sql: string | null) {
  const [rows, setRows] = useState<Row[]>([]); const [fields, setFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); const [down, setDown] = useState(false); const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!sql) { setLoading(false); return; }
    let alive = true; setLoading(true); setDown(false); setError('');
    (async () => {
      try { const r = await api.baasQuery(token, projectId, sql); if (alive) { setRows(r.rows); setFields(r.fields); } }
      catch (e) { if (alive) { const m = (e as Error).message; if (/not_provisioned|unreachable|not_deployed|database_/.test(m)) setDown(true); else setError(m); } }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [token, projectId, sql, tick]);
  return { rows, fields, loading, down, error, reload: () => setTick((t) => t + 1) };
}

const Center = () => <div className="flex items-center justify-center py-16 text-text-muted"><Loader2 className="animate-spin" /></div>;
const Err = ({ e }: { e: string }) => <p className="rounded-lg bg-red-50 px-3 py-2 font-mono text-xs text-red-600">{e}</p>;
const DownState = ({ what }: { what: string }) => (
  <div className="rounded-2xl border border-neutral-border bg-surface-card p-8 text-center">
    <ServerCrash size={22} className="mx-auto text-text-muted" />
    <p className="mt-3 text-sm font-medium text-text-primary">Database not reachable yet</p>
    <p className="mt-1 text-sm text-text-muted">{what} appear once the backend is deployed and the project database is provisioned.</p>
  </div>
);

function Header({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between">
      <div><h3 className="text-base font-bold font-display text-text-primary">{title}</h3><p className="text-xs text-text-muted">{desc}</p></div>
      {action}
    </div>
  );
}

// Generic catalog table: renders a SELECT's rows with chosen columns.
function CatalogTable({ token, projectId, sql, columns, empty, whatDown }: { token: string; projectId: number; sql: string; columns: { key: string; label: string; render?: (r: Row) => React.ReactNode }[]; empty: string; whatDown: string }) {
  const { rows, loading, down } = useSql(token, projectId, sql);
  if (loading) return <Center />;
  if (down) return <DownState what={whatDown} />;
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-bg-secondary text-xs uppercase text-text-muted"><tr>{columns.map((c) => <th key={c.key} className="px-4 py-2 font-medium">{c.label}</th>)}</tr></thead>
        <tbody className="divide-y divide-neutral-border">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-text-muted">{empty}</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i}>{columns.map((c) => <td key={c.key} className="px-4 py-2.5 text-text-primary">{c.render ? c.render(r) : String(r[c.key] ?? '')}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Page({ page, token, projectId, onCreateTable }: { page: PageKey; token: string; projectId: number; onCreateTable?: () => void }) {
  switch (page) {
    case 'tables': return <TablesPage token={token} projectId={projectId} />;
    case 'schema': return <SchemaPage token={token} projectId={projectId} />;
    case 'functions': return <SqlListPage token={token} projectId={projectId} title="Database Functions" desc="PostgreSQL functions: SQL and procedural commands." whatDown="Functions" empty="No functions created yet." newLabel="New function" template={FN_TEMPLATE}
      sql={`SELECT p.proname AS name, pg_get_function_result(p.oid) AS return_type, l.lanname AS language FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' ORDER BY name`}
      columns={[{ key: 'name', label: 'Name' }, { key: 'return_type', label: 'Return type' }, { key: 'language', label: 'Language' }]} />;
    case 'triggers': return <SqlListPage token={token} projectId={projectId} title="Database Triggers" desc="Execute actions automatically when database events occur." whatDown="Triggers" empty="No triggers created yet." newLabel="New trigger" template={TRIGGER_TEMPLATE}
      sql={`SELECT trigger_name AS name, event_object_table AS table, string_agg(event_manipulation, ', ') AS events, action_timing AS timing FROM information_schema.triggers WHERE trigger_schema='public' GROUP BY trigger_name, event_object_table, action_timing ORDER BY name`}
      columns={[{ key: 'name', label: 'Name' }, { key: 'table', label: 'Table' }, { key: 'events', label: 'Events' }, { key: 'timing', label: 'Timing' }]} />;
    case 'enums': return <EnumsPage token={token} projectId={projectId} />;
    case 'extensions': return <ExtensionsPage token={token} projectId={projectId} />;
    case 'indexes': return <IndexesPage token={token} projectId={projectId} />;
    case 'publications': return <PublicationsPage token={token} projectId={projectId} />;
    case 'policies': return <PoliciesPage token={token} projectId={projectId} onCreateTable={onCreateTable} />;
    case 'roles': return <RolesPage token={token} projectId={projectId} />;
    case 'settings': return <SettingsPage token={token} projectId={projectId} />;
    case 'backups': return <BackupsPage />;
    case 'migrations': return <MigrationsPage token={token} projectId={projectId} />;
    default: return <PlatformPage page={page} />;
  }
}

// ── generic list-with-SQL-editor page (Functions / Triggers / Policies) ─────────
function SqlListPage({ token, projectId, title, desc, sql, columns, empty, whatDown, newLabel, template }: { token: string; projectId: number; title: string; desc: string; sql: string; columns: { key: string; label: string }[]; empty: string; whatDown: string; newLabel: string; template: string }) {
  const [editor, setEditor] = useState(false);
  return (
    <div>
      <Header title={title} desc={desc} action={<button onClick={() => setEditor(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><Plus size={15} /> {newLabel}</button>} />
      <CatalogTable token={token} projectId={projectId} sql={sql} columns={columns} empty={empty} whatDown={whatDown} />
      {editor && <SqlEditorDrawer token={token} projectId={projectId} initial={template} onClose={() => setEditor(false)} />}
    </div>
  );
}
// Right-side SQL editor drawer (runs arbitrary SQL, shows result/error). Supabase-style.
function SqlEditorDrawer({ token, projectId, initial, onClose }: { token: string; projectId: number; initial: string; onClose: () => void }) {
  const [sql, setSql] = useState(initial); const [res, setRes] = useState<{ rowCount: number } | null>(null); const [err, setErr] = useState(''); const [running, setRunning] = useState(false);
  async function run() { setRunning(true); setErr(''); setRes(null); try { const r = await api.baasQuery(token, projectId, sql); setRes({ rowCount: r.rowCount }); } catch (e) { setErr((e as Error).message); } finally { setRunning(false); } }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-neutral-border bg-surface-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-neutral-border px-4 py-3">
          <span className="text-sm font-semibold text-text-primary">SQL Editor</span>
          <button onClick={run} disabled={running} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run</button>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>
        <textarea value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false} className="flex-1 resize-none bg-neutral-950 p-4 font-mono text-xs text-neutral-100 focus:outline-none" />
        {(res || err) && <div className="border-t border-neutral-border p-3 text-xs">{err ? <p className="rounded bg-red-50 px-2 py-1 font-mono text-red-600">{err}</p> : <p className="text-emerald-600">Success — {res!.rowCount} row(s) affected.</p>}</div>}
      </div>
    </div>
  );
}

// ── Tables ──────────────────────────────────────────────────────────────────
const COL_TYPES = ['int8', 'int4', 'text', 'varchar', 'uuid', 'bool', 'timestamptz', 'date', 'jsonb', 'float8', 'numeric'];
type NewCol = { name: string; type: string; default: string; pk: boolean };
function TablesPage({ token, projectId }: { token: string; projectId: number }) {
  const [showNew, setShowNew] = useState(false);
  return (
    <div>
      <Header title="Database Tables" desc="Manage the tables in your project's public schema." action={<button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><Plus size={15} /> New table</button>} />
      <CatalogTable token={token} projectId={projectId} whatDown="Tables"
        sql={`SELECT t.table_name AS name, (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.table_name) AS columns FROM information_schema.tables t WHERE t.table_schema='public' AND t.table_type='BASE TABLE' ORDER BY name`}
        columns={[{ key: 'name', label: 'Name' }, { key: 'columns', label: 'Columns' }]} empty={'No tables created yet in the "public" schema.'} />
      {showNew && <NewTableModal token={token} projectId={projectId} onClose={() => setShowNew(false)} />}
    </div>
  );
}
export function NewTableModal({ token, projectId, onClose }: { token: string; projectId: number; onClose: () => void }) {
  const [name, setName] = useState(''); const [rls, setRls] = useState(true);
  const [cols, setCols] = useState<NewCol[]>([{ name: 'id', type: 'int8', default: '', pk: true }, { name: 'created_at', type: 'timestamptz', default: 'now()', pk: false }]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  function buildDdl() {
    const t = quoteIdent(name.trim());
    const defs = cols.filter((c) => c.name.trim()).map((c) => `  ${quoteIdent(c.name.trim())} ${c.type}${c.default.trim() ? ` DEFAULT ${c.default.trim()}` : ''}`);
    const pks = cols.filter((c) => c.pk && c.name.trim()).map((c) => quoteIdent(c.name.trim()));
    if (pks.length) defs.push(`  PRIMARY KEY (${pks.join(', ')})`);
    let ddl = `CREATE TABLE public.${t} (\n${defs.join(',\n')}\n);`;
    if (rls) ddl += `\nALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`;
    return ddl;
  }
  async function save() { setBusy(true); setErr(''); try { await api.baasQuery(token, projectId, buildDdl()); onClose(); } catch (e) { setErr((e as Error).message); setBusy(false); } }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-neutral-border bg-surface-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-border px-5 py-3.5"><h3 className="text-base font-semibold text-text-primary">Create a new table under <code className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-xs">public</code></h3><button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button></div>
        <div className="flex-1 space-y-5 overflow-auto px-5 py-4">
          <div><label className="mb-1 block text-sm font-medium text-text-secondary">Name</label><input value={name} onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))} className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rls} onChange={(e) => setRls(e.target.checked)} className="h-4 w-4" /><span className="text-text-primary">Enable Row Level Security (RLS)</span></label>
          <div>
            <p className="mb-2 text-sm font-semibold text-text-primary">Columns</p>
            <div className="space-y-2">
              {cols.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-2">
                  <input value={c.name} onChange={(e) => setCols((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="name" className="rounded-lg border border-neutral-border px-2.5 py-1.5 font-mono text-xs" />
                  <select value={c.type} onChange={(e) => setCols((cs) => cs.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} className="rounded-lg border border-neutral-border px-2 py-1.5 text-xs">{COL_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                  <input value={c.default} onChange={(e) => setCols((cs) => cs.map((x, j) => (j === i ? { ...x, default: e.target.value } : x)))} placeholder="default" className="rounded-lg border border-neutral-border px-2.5 py-1.5 font-mono text-xs" />
                  <label className="flex items-center gap-1 text-xs text-text-muted"><input type="checkbox" checked={c.pk} onChange={(e) => setCols((cs) => cs.map((x, j) => (j === i ? { ...x, pk: e.target.checked } : x)))} /> PK</label>
                  <button onClick={() => setCols((cs) => cs.filter((_, j) => j !== i))} className="text-text-muted hover:text-red-600"><X size={14} /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setCols((cs) => [...cs, { name: '', type: 'text', default: '', pk: false }])} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-neutral-border px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-secondary"><Plus size={13} /> Add column</button>
          </div>
          <details className="text-xs text-text-muted"><summary className="cursor-pointer">Preview SQL</summary><pre className="mt-1 whitespace-pre-wrap rounded-lg bg-neutral-950 p-2 font-mono text-[11px] text-neutral-100">{buildDdl()}</pre></details>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-border px-5 py-3"><button onClick={onClose} className="rounded-lg border border-neutral-border px-4 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary">Cancel</button><button onClick={save} disabled={busy || !name} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} Save</button></div>
      </div>
    </div>
  );
}

// ── Enumerated Types ──────────────────────────────────────────────────────────
function EnumsPage({ token, projectId }: { token: string; projectId: number }) {
  const [showNew, setShowNew] = useState(false); const [name, setName] = useState(''); const [values, setValues] = useState(['']); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const { rows, loading, down, reload } = useSql(token, projectId, `SELECT t.typname AS name, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS values FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' GROUP BY t.typname ORDER BY name`);
  async function create() { setBusy(true); setErr(''); const vs = values.map((v) => v.trim()).filter(Boolean); const ddl = `CREATE TYPE public.${quoteIdent(name.trim())} AS ENUM (${vs.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ')});`; try { await api.baasQuery(token, projectId, ddl); setShowNew(false); setName(''); setValues(['']); reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }
  return (
    <div>
      <Header title="Database Enumerated Types" desc="Custom data types you can use in your tables or functions." action={<button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><Plus size={15} /> Create type</button>} />
      {loading ? <Center /> : down ? <DownState what="Enumerated types" /> : (
        <div className="overflow-hidden rounded-2xl border border-neutral-border"><table className="w-full text-left text-sm"><thead className="bg-bg-secondary text-xs uppercase text-text-muted"><tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Values</th></tr></thead>
          <tbody className="divide-y divide-neutral-border">{rows.length === 0 ? <tr><td colSpan={2} className="px-4 py-10 text-center text-text-muted">No enumerated types created yet.</td></tr> : rows.map((r, i) => <tr key={i}><td className="px-4 py-2.5 font-mono text-text-primary">{String(r.name)}</td><td className="px-4 py-2.5 text-text-muted">{String(r.values)}</td></tr>)}</tbody></table></div>
      )}
      {showNew && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setShowNew(false)}>
          <div className="flex h-full w-full max-w-md flex-col border-l border-neutral-border bg-surface-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-neutral-border px-5 py-3.5"><h3 className="text-base font-semibold text-text-primary">Create a new enumerated type</h3><button onClick={() => setShowNew(false)} className="text-text-muted hover:text-text-primary"><X size={18} /></button></div>
            <div className="flex-1 space-y-4 overflow-auto px-5 py-4">
              <div><label className="mb-1 block text-sm font-medium text-text-secondary">Name</label><input value={name} onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))} className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm" /></div>
              <div><p className="mb-1 text-sm font-medium text-text-secondary">Values</p><p className="mb-2 text-xs text-amber-700">After creation, values cannot be deleted or sorted.</p>
                <div className="space-y-2">{values.map((v, i) => (<div key={i} className="flex gap-2"><input value={v} onChange={(e) => setValues((vs) => vs.map((x, j) => (j === i ? e.target.value : x)))} className="flex-1 rounded-lg border border-neutral-border px-3 py-1.5 text-sm" /><button onClick={() => setValues((vs) => vs.filter((_, j) => j !== i))} className="text-text-muted hover:text-red-600"><Trash2 size={14} /></button></div>))}</div>
                <button onClick={() => setValues((vs) => [...vs, ''])} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-neutral-border px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-secondary"><Plus size={13} /> Add value</button>
              </div>
              {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-border px-5 py-3"><button onClick={() => setShowNew(false)} className="rounded-lg border border-neutral-border px-4 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary">Cancel</button><button onClick={create} disabled={busy || !name || !values.some((v) => v.trim())} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} Create type</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Extensions ──────────────────────────────────────────────────────────────
function ExtensionsPage({ token, projectId }: { token: string; projectId: number }) {
  const { rows, loading, down, reload } = useSql(token, projectId, `SELECT a.name, a.default_version AS version, a.comment AS description, (SELECT extversion FROM pg_extension e WHERE e.extname=a.name) AS installed FROM pg_available_extensions a ORDER BY (a.name IN (SELECT extname FROM pg_extension)) DESC, a.name`);
  const [q, setQ] = useState(''); const [busy, setBusy] = useState('');
  async function toggle(name: string, on: boolean) { setBusy(name); try { await api.baasQuery(token, projectId, on ? `CREATE EXTENSION IF NOT EXISTS "${name}"` : `DROP EXTENSION IF EXISTS "${name}"`); reload(); } catch { /* surfaced via reload */ } finally { setBusy(''); } }
  if (loading) return <Center />;
  if (down) return <DownState what="Extensions" />;
  const list = rows.filter((r) => !q || String(r.name).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <Header title="Database Extensions" desc="Manage what extensions are installed in your database." />
      <div className="relative mb-3 max-w-sm"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for an extension" className="w-full rounded-lg border border-neutral-border py-2 pl-9 pr-3 text-sm" /></div>
      <div className="overflow-hidden rounded-2xl border border-neutral-border"><table className="w-full text-left text-sm"><thead className="bg-bg-secondary text-xs uppercase text-text-muted"><tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Version</th><th className="px-4 py-2 font-medium">Description</th><th className="px-4 py-2 font-medium">Enabled</th></tr></thead>
        <tbody className="divide-y divide-neutral-border">{list.map((r, i) => { const on = Boolean(r.installed); return (
          <tr key={i}><td className="px-4 py-2.5 font-mono text-text-primary">{String(r.name)}</td><td className="px-4 py-2.5 text-xs text-text-muted">{String(r.version)}</td><td className="px-4 py-2.5 text-xs text-text-muted">{String(r.description ?? '')}</td>
            <td className="px-4 py-2.5">{busy === r.name ? <Loader2 size={15} className="animate-spin text-text-muted" /> : <Toggle on={on} onChange={(v) => toggle(String(r.name), v)} />}</td></tr>); })}</tbody></table></div>
    </div>
  );
}

// ── Indexes ─────────────────────────────────────────────────────────────────
function IndexesPage({ token, projectId }: { token: string; projectId: number }) {
  const [showNew, setShowNew] = useState(false); const [table, setTable] = useState(''); const [colsText, setColsText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const { rows, loading, down, reload } = useSql(token, projectId, `SELECT tablename AS table, indexname AS name, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname`);
  const tables = useSql(token, projectId, `SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY name`);
  async function create() { setBusy(true); setErr(''); const cols = colsText.split(',').map((c) => c.trim()).filter(Boolean).map(quoteIdent); const ddl = `CREATE INDEX ON public.${quoteIdent(table)} (${cols.join(', ')});`; try { await api.baasQuery(token, projectId, ddl); setShowNew(false); setTable(''); setColsText(''); reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }
  return (
    <div>
      <Header title="Database Indexes" desc="Improve query performance against your database." action={<button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><Plus size={15} /> Create index</button>} />
      {loading ? <Center /> : down ? <DownState what="Indexes" /> : (
        <div className="overflow-hidden rounded-2xl border border-neutral-border"><table className="w-full text-left text-sm"><thead className="bg-bg-secondary text-xs uppercase text-text-muted"><tr><th className="px-4 py-2 font-medium">Table</th><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Definition</th></tr></thead>
          <tbody className="divide-y divide-neutral-border">{rows.length === 0 ? <tr><td colSpan={3} className="px-4 py-10 text-center text-text-muted">No indexes created yet.</td></tr> : rows.map((r, i) => <tr key={i}><td className="px-4 py-2.5 font-mono text-text-primary">{String(r.table)}</td><td className="px-4 py-2.5 font-mono text-xs text-text-muted">{String(r.name)}</td><td className="px-4 py-2.5 font-mono text-[11px] text-text-muted">{String(r.indexdef)}</td></tr>)}</tbody></table></div>
      )}
      {showNew && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setShowNew(false)}>
          <div className="flex h-full w-full max-w-md flex-col border-l border-neutral-border bg-surface-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-neutral-border px-5 py-3.5"><h3 className="text-base font-semibold text-text-primary">Create new index</h3><button onClick={() => setShowNew(false)} className="text-text-muted hover:text-text-primary"><X size={18} /></button></div>
            <div className="flex-1 space-y-4 px-5 py-4">
              <div><label className="mb-1 block text-sm font-medium text-text-secondary">Table</label>
                <select value={table} onChange={(e) => setTable(e.target.value)} className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm"><option value="">Select a table</option>{tables.rows.map((t, i) => <option key={i} value={String(t.name)}>{String(t.name)}</option>)}</select></div>
              <div><label className="mb-1 block text-sm font-medium text-text-secondary">Columns</label><input value={colsText} onChange={(e) => setColsText(e.target.value)} placeholder="col1, col2" className="w-full rounded-lg border border-neutral-border px-3 py-2 font-mono text-sm" /></div>
              {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-border px-5 py-3"><button onClick={() => setShowNew(false)} className="rounded-lg border border-neutral-border px-4 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary">Cancel</button><button onClick={create} disabled={busy || !table || !colsText.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} Create index</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Publications ──────────────────────────────────────────────────────────────
function PublicationsPage({ token, projectId }: { token: string; projectId: number }) {
  return (<div><Header title="Database Publications" desc="Publications control which changes are streamed for replication." />
    <CatalogTable token={token} projectId={projectId} whatDown="Publications"
      sql={`SELECT pubname AS name, oid AS system_id, pubinsert AS insert, pubupdate AS update, pubdelete AS delete, pubtruncate AS truncate FROM pg_publication ORDER BY pubname`}
      columns={[{ key: 'name', label: 'Name' }, { key: 'system_id', label: 'System ID' }, { key: 'insert', label: 'Insert', render: (r) => (r.insert ? 'On' : 'Off') }, { key: 'update', label: 'Update', render: (r) => (r.update ? 'On' : 'Off') }, { key: 'delete', label: 'Delete', render: (r) => (r.delete ? 'On' : 'Off') }, { key: 'truncate', label: 'Truncate', render: (r) => (r.truncate ? 'On' : 'Off') }]}
      empty="No publications found." /></div>);
}

// ── Schema Visualizer (tables + columns + FKs, rendered as cards) ───────────────
function SchemaPage({ token, projectId }: { token: string; projectId: number }) {
  const { rows, loading, down } = useSql(token, projectId, `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`);
  if (loading) return <Center />;
  if (down) return <DownState what="Your schema" />;
  const byTable = new Map<string, { column_name: string; data_type: string }[]>();
  for (const r of rows) { const t = String(r.table_name); if (!byTable.has(t)) byTable.set(t, []); byTable.get(t)!.push({ column_name: String(r.column_name), data_type: String(r.data_type) }); }
  return (
    <div>
      <Header title="Schema Visualizer" desc="Tables in the public schema and their columns." />
      {byTable.size === 0 ? <p className="rounded-2xl border border-neutral-border bg-surface-card p-8 text-center text-sm text-text-muted">No tables in the public schema.</p> : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {[...byTable.entries()].map(([t, cols]) => (
            <div key={t} className="overflow-hidden rounded-xl border border-neutral-border bg-surface-card">
              <div className="flex items-center gap-1.5 border-b border-neutral-border bg-bg-secondary px-3 py-2 text-sm font-medium text-text-primary"><Table2 size={13} /> {t}</div>
              <ul className="divide-y divide-neutral-border">{cols.map((c) => <li key={c.column_name} className="flex items-center justify-between px-3 py-1.5 text-xs"><span className="font-mono text-text-primary">{c.column_name}</span><span className="text-text-muted">{c.data_type}</span></li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Roles ───────────────────────────────────────────────────────────────────
const MANAGED_ROLES = new Set(['postgres', 'anon', 'authenticated', 'authenticator', 'service_role', 'pgbouncer']);
const isManaged = (name: string) => MANAGED_ROLES.has(name) || name.startsWith('auth_') || name.startsWith('rachbase') || name.startsWith('pg_');
function RolesPage({ token, projectId }: { token: string; projectId: number }) {
  const [q, setQ] = useState(''); const [activeOnly, setActiveOnly] = useState(false); const [editor, setEditor] = useState(false);
  const { rows, loading, down, error, reload } = useSql(token, projectId, `SELECT r.rolname AS name, r.oid AS id, r.rolsuper AS superuser, r.rolcanlogin AS can_login, (SELECT count(*) FROM pg_stat_activity a WHERE a.usename=r.rolname)::int AS connections FROM pg_roles r ORDER BY r.rolname`);
  const max = useSql(token, projectId, `SELECT setting::int AS max FROM pg_settings WHERE name='max_connections'`);
  const total = rows.reduce((s, r) => s + Number(r.connections || 0), 0);
  const maxConn = Number(max.rows[0]?.max ?? 0);
  const filtered = rows.filter((r) => (!q || String(r.name).toLowerCase().includes(q.toLowerCase())) && (!activeOnly || Number(r.connections) > 0));
  const managed = filtered.filter((r) => isManaged(String(r.name)));
  const other = filtered.filter((r) => !isManaged(String(r.name)));
  const Group = ({ label, tag, list }: { label: string; tag?: string; list: Row[] }) => (
    <div className="overflow-hidden rounded-2xl border border-neutral-border">
      <div className="flex items-center gap-2 border-b border-neutral-border bg-bg-secondary px-4 py-2 text-xs font-medium text-text-secondary">{label}{tag && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">{tag}</span>}</div>
      <ul className="divide-y divide-neutral-border">
        {list.map((r) => (<li key={String(r.id)} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="font-mono text-text-primary">{String(r.name)}</span><span className="text-xs text-text-muted">(ID: {String(r.id)})</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-text-muted">{Number(r.connections) > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}{String(r.connections)} connections</span>
        </li>))}
      </ul>
    </div>
  );
  return (
    <div>
      <Header title="Database Roles" desc="Manage access control to your database through users, groups, and permissions." action={<button onClick={() => setEditor(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><Plus size={15} /> Add role</button>} />
      {loading ? <Center /> : down ? <DownState what="Roles" /> : error ? <Err e={error} /> : (
        <>
          <div className="mb-4 flex items-center gap-3">
            <div className="relative max-w-xs flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for a role" className="w-full rounded-lg border border-neutral-border py-2 pl-9 pr-3 text-sm" /></div>
            <div className="inline-flex rounded-lg border border-neutral-border p-0.5 text-xs">
              <button onClick={() => setActiveOnly(false)} className={cn('rounded-md px-3 py-1', !activeOnly ? 'bg-bg-secondary font-medium text-text-primary' : 'text-text-muted')}>All roles</button>
              <button onClick={() => setActiveOnly(true)} className={cn('rounded-md px-3 py-1', activeOnly ? 'bg-bg-secondary font-medium text-text-primary' : 'text-text-muted')}>Active roles</button>
            </div>
            <div className="ml-auto text-right"><p className="text-xs text-text-muted">Active connections {total}{maxConn ? `/${maxConn}` : ''}</p>{maxConn > 0 && <div className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-neutral-200"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (total / maxConn) * 100)}%` }} /></div>}</div>
          </div>
          <div className="space-y-4">
            {managed.length > 0 && <Group label="Roles managed by RachBase" tag="PROTECTED" list={managed} />}
            {other.length > 0 && <Group label="Other database roles" list={other} />}
            {filtered.length === 0 && <p className="rounded-2xl border border-neutral-border bg-surface-card p-8 text-center text-sm text-text-muted">No roles match.</p>}
          </div>
        </>
      )}
      {editor && <AddRoleDrawer token={token} projectId={projectId} onClose={() => setEditor(false)} onCreated={() => { setEditor(false); reload(); }} />}
    </div>
  );
}

function AddRoleDrawer({ token, projectId, onClose, onCreated }: { token: string; projectId: number; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [priv, setPriv] = useState({ login: false, createrole: false, createdb: false, bypassrls: false, replication: false });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k: keyof typeof priv, v: boolean) => setPriv((p) => ({ ...p, [k]: v }));
  async function save() {
    setBusy(true); setErr('');
    const opts = [priv.login ? 'LOGIN' : 'NOLOGIN', priv.createrole && 'CREATEROLE', priv.createdb && 'CREATEDB', priv.bypassrls && 'BYPASSRLS', priv.replication && 'REPLICATION'].filter(Boolean).join(' ');
    const sql = `CREATE ROLE ${quoteIdent(name.trim())} WITH ${opts};`;
    try { await api.baasQuery(token, projectId, sql); onCreated(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  const Row = ({ k, label }: { k: keyof typeof priv; label: string }) => (
    <div className="flex items-start gap-3 py-2"><Toggle on={priv[k]} onChange={(v) => set(k, v)} /><span className="text-sm text-text-primary">{label}</span></div>
  );
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col border-l border-neutral-border bg-surface-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-border px-5 py-3.5"><h3 className="text-base font-semibold text-text-primary">Create a new role</h3><button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button></div>
        <div className="flex-1 space-y-5 overflow-auto px-5 py-4">
          <div><label className="mb-1 block text-sm font-medium text-text-secondary">Name</label><input value={name} onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))} className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm" /></div>
          <div>
            <p className="mb-1 text-sm font-medium text-text-secondary">Role privileges</p>
            <Row k="login" label="User can login" />
            <Row k="createrole" label="User can create roles" />
            <Row k="createdb" label="User can create databases" />
            <Row k="bypassrls" label="User bypasses every row level security policy" />
            <Row k="replication" label="User can initiate streaming replication and put the system in and out of backup mode" />
          </div>
          <div className="border-t border-neutral-border pt-4">
            <p className="mb-1 text-sm font-medium text-text-secondary">These privileges cannot be granted via the Dashboard:</p>
            <div className="flex items-center gap-3 py-2 opacity-50"><Toggle on={false} onChange={() => {}} /><span className="text-sm text-text-primary">User is a Superuser</span></div>
          </div>
          {err && <Err e={err} />}
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-border px-5 py-3"><button onClick={onClose} className="rounded-lg border border-neutral-border px-4 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary">Cancel</button><button onClick={save} disabled={busy || !name.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} Save</button></div>
      </div>
    </div>
  );
}

// ── Policies (RLS) ────────────────────────────────────────────────────────────
function PoliciesPage({ token, projectId, onCreateTable }: { token: string; projectId: number; onCreateTable?: () => void }) {
  const [q, setQ] = useState(''); const [editor, setEditor] = useState(false); const [newTable, setNewTable] = useState(false);
  const createTable = () => (onCreateTable ? onCreateTable() : setNewTable(true));
  const tables = useSql(token, projectId, `SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY name`);
  const policies = useSql(token, projectId, `SELECT policyname AS name, tablename AS table, cmd AS command, array_to_string(roles, ', ') AS roles FROM pg_policies WHERE schemaname='public' ORDER BY tablename, name`);
  const hasTables = tables.rows.length > 0;
  const rows = policies.rows.filter((r) => !q || String(r.name).toLowerCase().includes(q.toLowerCase()) || String(r.table).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <Header title="Policies" desc="Manage Row Level Security policies for your tables." action={hasTables ? <button onClick={() => setEditor(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><Plus size={15} /> New policy</button> : undefined} />
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-neutral-border bg-surface-card p-3 text-sm">
        <Shield size={16} className="text-text-muted" />
        <div><p className="font-medium text-text-primary">Automatically enable Row Level Security (RLS) on new tables</p><p className="text-xs text-text-muted">Protect future tables by enabling RLS whenever a table is created.</p></div>
      </div>
      <div className="mb-4"><div className="relative max-w-sm"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tables and policies" className="w-full rounded-lg border border-neutral-border py-2 pl-9 pr-3 text-sm" /></div></div>
      {tables.loading ? <Center /> : tables.down ? (
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-12 text-center">
          <ServerCrash size={22} className="mx-auto text-text-muted" />
          <p className="mt-3 text-sm font-medium text-text-primary">Database not reachable yet</p>
          <p className="mt-1 text-sm text-text-muted">Policies appear once the backend is deployed. You can still design a table to get started.</p>
          <button onClick={createTable} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"><Plus size={15} /> Create a table</button>
        </div>
      ) : tables.error ? <Err e={tables.error} /> : !hasTables ? (
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-12 text-center">
          <p className="text-sm font-medium text-text-primary">No tables to create policies for</p>
          <p className="text-sm text-text-muted">RLS policies control per-user access to table rows. Create a table in this schema first.</p>
          <button onClick={createTable} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"><Plus size={15} /> Create a table</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-neutral-border bg-surface-card p-8 text-center text-sm text-text-muted">No policies created yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-border"><table className="w-full text-left text-sm"><thead className="bg-bg-secondary text-xs uppercase text-text-muted"><tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Table</th><th className="px-4 py-2 font-medium">Command</th><th className="px-4 py-2 font-medium">Roles</th></tr></thead>
          <tbody className="divide-y divide-neutral-border">{rows.map((r, i) => <tr key={i}><td className="px-4 py-2.5 text-text-primary">{String(r.name)}</td><td className="px-4 py-2.5 font-mono text-xs text-text-muted">{String(r.table)}</td><td className="px-4 py-2.5 text-xs text-text-muted">{String(r.command)}</td><td className="px-4 py-2.5 text-xs text-text-muted">{String(r.roles)}</td></tr>)}</tbody></table></div>
      )}
      {editor && <SqlEditorDrawer token={token} projectId={projectId} initial={POLICY_TEMPLATE} onClose={() => setEditor(false)} />}
      {newTable && <NewTableModal token={token} projectId={projectId} onClose={() => setNewTable(false)} />}
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsPage({ token, projectId }: { token: string; projectId: number }) {
  const { rows, loading, down, error } = useSql(token, projectId, `SELECT version() AS version, current_database() AS database, pg_size_pretty(pg_database_size(current_database())) AS size, (SELECT setting FROM pg_settings WHERE name='max_connections') AS max_connections`);
  const r = rows[0] || {};
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (<div className="mb-6"><p className="mb-2 text-sm font-semibold text-text-primary">{title}</p><div className="divide-y divide-neutral-border rounded-2xl border border-neutral-border bg-surface-card">{children}</div></div>);
  const Line = ({ k, v }: { k: string; v: string }) => (<div className="flex gap-4 px-4 py-3 text-sm"><span className="w-40 shrink-0 text-text-muted">{k}</span><span className="font-mono text-xs text-text-primary">{v}</span></div>);
  if (loading) return (<div><Header title="Database Settings" desc="Connections, security, and status for your project database." /><Center /></div>);
  if (down) return (<div><Header title="Database Settings" desc="Connections, security, and status for your project database." /><DownState what="Database settings" /></div>);
  return (
    <div>
      <Header title="Database Settings" desc="Connections, security, and status for your project database." />
      {error && <div className="mb-4"><Err e={error} /></div>}
      <Section title="Overview"><Line k="Database" v={String(r.database ?? '—')} /><Line k="Size" v={String(r.size ?? '—')} /><Line k="Max connections" v={String(r.max_connections ?? '—')} /><Line k="Version" v={String(r.version ?? '—')} /></Section>
      <Section title="Database password">
        <div className="flex items-center gap-4 px-4 py-3 text-sm"><div><p className="text-text-primary">Reset database password</p><p className="text-xs text-text-muted">The password isn&apos;t viewable after creation. Managed by the RachBase platform.</p></div><span className="ml-auto rounded-lg border border-neutral-border px-3 py-1.5 text-xs text-text-muted">Platform-managed</span></div>
      </Section>
      <Section title="Connection pooling">
        <div className="flex items-center gap-4 px-4 py-3 text-sm"><div><p className="text-text-primary">Connection pooler</p><p className="text-xs text-text-muted">Managed shared Postgres cluster. Pool size and client limits are set by your plan.</p></div><span className="ml-auto rounded-full bg-bg-secondary px-2 py-0.5 text-[10px] text-text-muted">SHARED</span></div>
      </Section>
      <Section title="SSL configuration">
        <div className="flex items-center gap-4 px-4 py-3 text-sm"><div><p className="text-text-primary">Enforce SSL on incoming connections</p><p className="text-xs text-text-muted">Connections to the managed cluster use SSL. Platform-managed.</p></div><span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">Enforced</span></div>
      </Section>
      <p className="text-xs text-text-muted">Network restrictions, connection logging, and backups for managed project databases are handled by the RachBase platform.</p>
    </div>
  );
}

// ── Backups (plan-gated, informational) ────────────────────────────────────────
function BackupsPage() {
  const [tab, setTab] = useState<'scheduled' | 'pitr' | 'restore'>('scheduled');
  return (
    <div>
      <Header title="Database Backups" desc="Backups let you restore your database to an earlier state." />
      <div className="mb-4 flex gap-5 border-b border-neutral-border text-sm">
        {([['scheduled', 'Scheduled backups'], ['pitr', 'Point in time'], ['restore', 'Restore to new project']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn('-mb-px border-b-2 px-0.5 py-2', tab === k ? 'border-primary-blue font-medium text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary')}>{l}{k !== 'scheduled' && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-700">BETA</span>}</button>
        ))}
      </div>
      <div className="rounded-xl border border-neutral-border bg-surface-card p-4 text-sm">
        {tab === 'scheduled' && <p className="text-text-secondary">Projects on paid plans are backed up daily and can be restored. Backups are managed by the RachBase platform.</p>}
        {tab === 'pitr' && <p className="text-text-secondary">Point-in-time recovery (roll back to a specific second) is a paid add-on, managed by the platform.</p>}
        {tab === 'restore' && <p className="text-text-secondary">Restore to a new project requires a paid plan with physical backups enabled.</p>}
      </div>
    </div>
  );
}

// ── Migrations (CLI instructions) ──────────────────────────────────────────────
function MigrationsPage({ token, projectId }: { token: string; projectId: number }) {
  const [ref, setRef] = useState('<project-ref>');
  useEffect(() => { (async () => { try { const r = await api.getBaas(token, projectId); if (r.baas?.ref) setRef(r.baas.ref); } catch { /* ignore */ } })(); }, [token, projectId]);
  const cmds: [string, string][] = [['Link your project', `rachbase link --project-ref ${ref}`], ['Create a new migration called "new-migration"', 'rachbase migration new new-migration'], ['Run all migrations for this project', 'rachbase db push']];
  return (
    <div>
      <Header title="Database Migrations" desc="Track changes to your database over time." />
      <div className="rounded-2xl border border-dashed border-neutral-border bg-surface-card p-8">
        <p className="text-center text-sm font-medium text-text-primary">Run your first migration</p>
        <p className="mb-4 text-center text-sm text-text-muted">Create and run migrations using the RachBase CLI.</p>
        <div className="mx-auto max-w-xl rounded-xl border border-neutral-border bg-neutral-950 p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Terminal instructions</p>
          <div className="space-y-3">{cmds.map(([label, cmd]) => (<div key={label}><p className="text-[11px] text-neutral-500">&gt; {label}</p><div className="flex items-center gap-2"><code className="flex-1 font-mono text-xs text-emerald-300">$ {cmd}</code><button onClick={() => navigator.clipboard?.writeText(cmd)} className="text-neutral-400 hover:text-neutral-200"><Copy size={12} /></button></div></div>))}</div>
        </div>
      </div>
    </div>
  );
}
function PlatformPage({ page }: { page: string }) {
  return (<div><Header title={page} desc="" /><div className="rounded-2xl border border-neutral-border bg-surface-card p-8 text-center"><Database size={22} className="mx-auto text-text-muted" /><p className="mt-3 text-sm font-medium text-text-primary">Managed by the platform</p></div></div>);
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (<button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cn('inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'bg-emerald-500' : 'bg-neutral-300')}><span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', on ? 'translate-x-4' : 'translate-x-0')} /></button>);
}

const FN_TEMPLATE = `CREATE OR REPLACE FUNCTION public.my_function()\nRETURNS void\nLANGUAGE plpgsql\nAS $$\nBEGIN\n  -- Add logic here\nEND;\n$$;`;
const TRIGGER_TEMPLATE = `CREATE OR REPLACE FUNCTION public.trigger_fn()\nRETURNS trigger\nLANGUAGE plpgsql\nAS $$\nBEGIN\n  -- Add logic here\n  RETURN NEW;\nEND;\n$$;\n\nCREATE TRIGGER my_trigger\nAFTER INSERT ON public.my_table\nFOR EACH ROW EXECUTE FUNCTION public.trigger_fn();`;
const POLICY_TEMPLATE = `CREATE POLICY "my_policy"\nON public.my_table\nFOR SELECT\nTO authenticated\nUSING ( true );`;
