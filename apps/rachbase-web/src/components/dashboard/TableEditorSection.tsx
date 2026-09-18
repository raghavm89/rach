'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Table2, Plus, Search, ServerCrash, X, Trash2, Pencil, RefreshCw } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { projects as api } from '@rach/ui/lib/api';
import { NewTableModal, quoteIdent } from './DatabaseSection';

/**
 * Standalone Table Editor (Supabase-style): a table list on the left, a data grid on the right
 * with insert / edit / delete. Everything runs SQL against the project DB via `baasQuery`, so it's
 * deploy-gated like the rest of the console.
 */
type Row = Record<string, unknown>;
type Col = { name: string; type: string };

function sqlLit(val: string, type: string): string {
  if (val === '') return 'NULL';
  if (/int|numeric|double|real|decimal|float|serial/.test(type)) return val.replace(/[^0-9.eE+-]/g, '') || 'NULL';
  if (/bool/.test(type)) return /^(t|true|1|yes)$/i.test(val) ? 'true' : 'false';
  return `'${val.replace(/'/g, "''")}'`;
}

export default function TableEditorSection({ token, projectId, openNew, onOpenedNew }: { token: string; projectId: number; openNew?: boolean; onOpenedNew?: () => void }) {
  const [tables, setTables] = useState<string[] | null>(null);
  const [down, setDown] = useState(false); const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  // Auto-open the create drawer when arriving from "Create a table" elsewhere (e.g. Policies).
  useEffect(() => { if (openNew) { setShowNew(true); onOpenedNew?.(); } }, [openNew, onOpenedNew]);

  const loadTables = useCallback(async () => {
    setLoadingList(true); setDown(false);
    try { const r = await api.baasQuery(token, projectId, `SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY name`); setTables(r.rows.map((x) => String(x.name))); }
    catch { setDown(true); } finally { setLoadingList(false); }
  }, [token, projectId]);
  useEffect(() => { loadTables(); }, [loadTables]);

  const list = (tables ?? []).filter((t) => !q || t.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="grid grid-cols-[220px_1fr] gap-4">
      {/* Sidebar */}
      <div className="space-y-2">
        <div className="rounded-lg border border-neutral-border bg-bg-secondary px-3 py-2 text-xs text-text-muted">schema <span className="font-medium text-text-primary">public</span></div>
        <button onClick={() => setShowNew(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-border px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"><Plus size={15} /> New table</button>
        <div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tables..." className="w-full rounded-lg border border-neutral-border py-1.5 pl-8 pr-2 text-sm" /></div>
        <div className="rounded-lg border border-neutral-border">
          {loadingList ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-text-muted" size={18} /></div>
            : down ? <p className="px-3 py-6 text-center text-xs text-text-muted">Backend not deployed.</p>
            : list.length === 0 ? <div className="px-3 py-6 text-center"><p className="text-sm font-medium text-text-primary">No tables or views</p><p className="text-xs text-text-muted">Any tables you create appear here.</p></div>
            : <ul className="max-h-[60vh] overflow-auto p-1">{list.map((t) => (
                <li key={t}><button onClick={() => setSelected(t)} className={cn('flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm', selected === t ? 'bg-blue-50 text-primary-blue' : 'text-text-secondary hover:bg-bg-secondary')}><Table2 size={13} /> <span className="truncate font-mono text-xs">{t}</span></button></li>
              ))}</ul>}
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0">
        {selected ? <TableGrid key={selected} token={token} projectId={projectId} table={selected} />
          : (
            <div className="space-y-6">
              <button onClick={() => setShowNew(true)} className="flex w-full max-w-md items-center gap-3 rounded-xl border border-neutral-border bg-surface-card p-4 text-left hover:bg-bg-secondary">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-primary-blue"><Table2 size={18} /></div>
                <div><p className="text-sm font-medium text-text-primary">Create a table</p><p className="text-xs text-text-muted">Design and create a new database table.</p></div>
              </button>
              <div><p className="mb-2 text-sm font-semibold text-text-primary">Select a table</p><p className="rounded-2xl border border-neutral-border bg-surface-card p-8 text-center text-sm text-text-muted">Choose a table on the left to browse and edit its rows.</p></div>
            </div>
          )}
      </div>
      {showNew && <NewTableModal token={token} projectId={projectId} onClose={() => { setShowNew(false); loadTables(); }} />}
    </div>
  );
}

function TableGrid({ token, projectId, table }: { token: string; projectId: number; table: string }) {
  const [cols, setCols] = useState<Col[]>([]); const [pk, setPk] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]); const [fields, setFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState('');
  const [edit, setEdit] = useState<{ mode: 'insert' | 'edit'; row: Row } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const c = await api.baasQuery(token, projectId, `SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema='public' AND table_name='${table.replace(/'/g, "''")}' ORDER BY ordinal_position`);
      setCols(c.rows.map((r) => ({ name: String(r.name), type: String(r.type) })));
      const p = await api.baasQuery(token, projectId, `SELECT a.attname AS name FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) WHERE i.indrelid='public.${quoteIdent(table).replace(/'/g, "''")}'::regclass AND i.indisprimary`);
      setPk(p.rows.map((r) => String(r.name)));
      const d = await api.baasQuery(token, projectId, `SELECT * FROM public.${quoteIdent(table)} ORDER BY 1 LIMIT 200`);
      setRows(d.rows); setFields(d.fields);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [token, projectId, table]);
  useEffect(() => { load(); }, [load]);

  async function del(row: Row) {
    if (!pk.length) { setErr('Cannot delete: table has no primary key.'); return; }
    const where = pk.map((k) => `${quoteIdent(k)} = ${sqlLit(String(row[k] ?? ''), typeOf(k))}`).join(' AND ');
    try { await api.baasQuery(token, projectId, `DELETE FROM public.${quoteIdent(table)} WHERE ${where}`); load(); } catch (e) { setErr((e as Error).message); }
  }
  const typeOf = (name: string) => cols.find((c) => c.name === name)?.type || 'text';

  if (loading) return <div className="flex items-center justify-center py-16 text-text-muted"><Loader2 className="animate-spin" /></div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-base font-bold font-display text-text-primary"><Table2 size={16} className="text-text-muted" /> {table}</h3>
        <button onClick={load} className="ml-auto rounded-lg border border-neutral-border p-2 text-text-muted hover:text-text-primary" aria-label="Refresh"><RefreshCw size={14} /></button>
        <button onClick={() => setEdit({ mode: 'insert', row: {} })} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><Plus size={15} /> Insert row</button>
      </div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 font-mono text-xs text-red-600">{err}</p>}
      <div className="overflow-auto rounded-2xl border border-neutral-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-secondary text-xs uppercase text-text-muted"><tr>{fields.map((f) => <th key={f} className="whitespace-nowrap px-3 py-2 font-medium">{f}{pk.includes(f) && <span className="ml-1 text-[9px] text-amber-600">PK</span>}</th>)}<th className="px-3 py-2" /></tr></thead>
          <tbody className="divide-y divide-neutral-border">
            {rows.length === 0 ? <tr><td colSpan={fields.length + 1} className="px-4 py-10 text-center text-text-muted">No rows. Insert one to get started.</td></tr>
              : rows.map((r, i) => (
                <tr key={i} className="hover:bg-bg-secondary">
                  {fields.map((f) => <td key={f} className="max-w-[240px] truncate whitespace-nowrap px-3 py-2 font-mono text-xs text-text-primary">{fmt(r[f])}</td>)}
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button onClick={() => setEdit({ mode: 'edit', row: r })} className="mr-2 text-text-muted hover:text-primary-blue" aria-label="Edit"><Pencil size={13} /></button>
                    <button onClick={() => del(r)} className="text-text-muted hover:text-red-600" aria-label="Delete"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted">{rows.length} row{rows.length === 1 ? '' : 's'} (max 200 shown)</p>
      {edit && <RowModal token={token} projectId={projectId} table={table} cols={cols} pk={pk} mode={edit.mode} original={edit.row} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function RowModal({ token, projectId, table, cols, pk, mode, original, onClose, onSaved }: { token: string; projectId: number; table: string; cols: Col[]; pk: string[]; mode: 'insert' | 'edit'; original: Row; onClose: () => void; onSaved: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(cols.map((c) => [c.name, mode === 'edit' && original[c.name] != null ? String(original[c.name]) : ''])));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const typeOf = (name: string) => cols.find((c) => c.name === name)?.type || 'text';
  async function save() {
    setBusy(true); setErr('');
    try {
      let sql: string;
      if (mode === 'insert') {
        const filled = cols.filter((c) => vals[c.name] !== '');
        if (!filled.length) { setErr('Enter at least one value.'); setBusy(false); return; }
        sql = `INSERT INTO public.${quoteIdent(table)} (${filled.map((c) => quoteIdent(c.name)).join(', ')}) VALUES (${filled.map((c) => sqlLit(vals[c.name], c.type)).join(', ')})`;
      } else {
        if (!pk.length) { setErr('Cannot edit: table has no primary key.'); setBusy(false); return; }
        const sets = cols.filter((c) => !pk.includes(c.name)).map((c) => `${quoteIdent(c.name)} = ${sqlLit(vals[c.name], c.type)}`).join(', ');
        const where = pk.map((k) => `${quoteIdent(k)} = ${sqlLit(String(original[k] ?? ''), typeOf(k))}`).join(' AND ');
        sql = `UPDATE public.${quoteIdent(table)} SET ${sets} WHERE ${where}`;
      }
      await api.baasQuery(token, projectId, sql); onSaved();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col border-l border-neutral-border bg-surface-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-border px-5 py-3.5"><h3 className="text-base font-semibold text-text-primary">{mode === 'insert' ? 'Insert row' : 'Edit row'} <span className="font-mono text-xs text-text-muted">{table}</span></h3><button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button></div>
        <div className="flex-1 space-y-3 overflow-auto px-5 py-4">
          {cols.map((c) => (
            <div key={c.name}>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-text-secondary">{c.name}<span className="text-text-muted">{c.type}</span>{pk.includes(c.name) && <span className="text-[9px] text-amber-600">PK</span>}</label>
              <input value={vals[c.name]} onChange={(e) => setVals((v) => ({ ...v, [c.name]: e.target.value }))} placeholder={mode === 'insert' ? 'DEFAULT / NULL' : ''} className="w-full rounded-lg border border-neutral-border px-3 py-2 font-mono text-sm text-text-primary" />
            </div>
          ))}
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 font-mono text-xs text-red-600">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-border px-5 py-3"><button onClick={onClose} className="rounded-lg border border-neutral-border px-4 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary">Cancel</button><button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} Save</button></div>
      </div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
