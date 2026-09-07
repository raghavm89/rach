'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Radio, Plus, Trash2, ShieldAlert, Copy, Check } from 'lucide-react';
import { projects as api, type RealtimeTable } from '@rach/ui/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const wsBase = () => API_BASE.replace(/^http/, 'ws');

/**
 * Backend → Realtime. Enable postgres_changes per table (LISTEN/NOTIFY triggers) and show how
 * to connect over WebSocket for changes / broadcast / presence.
 */
export default function RealtimeSection({ token, projectId }: { token: string; projectId: number }) {
  const [tables, setTables] = useState<RealtimeTable[]>([]);
  const [wsPath, setWsPath] = useState('/realtime/v1');
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.baasRealtime(token, projectId);
      setTables(r.tables); setWsPath(r.wsPath); setRef(r.ref); setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load realtime');
    } finally { setLoading(false); }
  }, [token, projectId]);

  useEffect(() => { load(); }, [load]);

  const enable = async () => {
    const raw = name.trim();
    if (!raw) return;
    const [schema, table] = raw.includes('.') ? raw.split('.', 2) : ['public', raw];
    setBusy(true); setErr(null);
    try {
      const r = await api.baasEnableRealtime(token, projectId, table, schema);
      setTables(r.tables); setName('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not enable realtime');
    } finally { setBusy(false); }
  };

  const disable = async (t: RealtimeTable) => {
    setBusy(true); setErr(null);
    try {
      const r = await api.baasDisableRealtime(token, projectId, t.table, t.schema);
      setTables(r.tables);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not disable realtime');
    } finally { setBusy(false); }
  };

  const snippet = `const ws = new WebSocket(
  "${wsBase()}${wsPath}?ref=${ref || '<ref>'}&token=" + accessToken
);
ws.onopen = () => ws.send(JSON.stringify({
  type: "subscribe",
  topic: "room:1",
  config: {
    postgres_changes: [{ event: "*", schema: "public", table: "todos" }],
    presence: { key: userId }
  }
}));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
// broadcast: ws.send(JSON.stringify({ type:"broadcast", topic:"room:1", event:"msg", payload:{...} }))`;

  const copy = () => { navigator.clipboard?.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (loading) return <div className="flex items-center justify-center py-16 text-text-muted"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold font-display text-text-primary">Realtime</h3>
        <p className="text-xs text-text-muted">Stream row changes, broadcast messages, and track presence over WebSocket. Enable the tables you want change events for.</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <span>Change events are delivered to every <strong>authenticated</strong> subscriber of a table (anonymous clients never receive changes), and are not yet per-row RLS-filtered. Only enable realtime on tables whose row changes are safe to share among this backend&apos;s authenticated users.</span>
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{err}</div>}

      {/* Enable a table */}
      <div className="flex gap-2">
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="table name (e.g. todos or public.todos)"
          onKeyDown={(e) => e.key === 'Enter' && enable()}
          className="flex-1 rounded-lg border border-neutral-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-blue focus:outline-none"
        />
        <button onClick={enable} disabled={busy || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-blue px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Enable
        </button>
      </div>

      {/* Enabled tables */}
      <div className="overflow-hidden rounded-xl border border-neutral-border">
        <div className="flex items-center gap-2 border-b border-neutral-border bg-bg-secondary px-4 py-2 text-xs font-medium text-text-muted">
          <Radio size={13} /> Realtime-enabled tables
        </div>
        {tables.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-muted">No tables enabled yet.</div>
        ) : (
          <ul className="divide-y divide-neutral-border">
            {tables.map((t) => (
              <li key={`${t.schema}.${t.table}`} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-mono text-text-primary">{t.schema}.{t.table}</span>
                <button onClick={() => disable(t)} disabled={busy} className="inline-flex items-center gap-1 text-red-600 hover:opacity-80 disabled:opacity-50">
                  <Trash2 size={14} /> Disable
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Connect snippet */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Connect</h4>
          <button onClick={copy} className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary">
            {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-neutral-border bg-bg-secondary p-4 text-xs leading-relaxed text-text-primary"><code>{snippet}</code></pre>
      </div>
    </div>
  );
}
