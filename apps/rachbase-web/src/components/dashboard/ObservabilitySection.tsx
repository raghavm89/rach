'use client';

import { useEffect, useState } from 'react';
import { Loader2, ServerCrash, ChevronRight, Activity, Gauge, Database, Cpu, HardDrive, Zap, RefreshCw } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { projects as api } from '@rach/ui/lib/api';

/**
 * Observability (Supabase-style). The SQL-derivable pages — Query Performance (pg_stat_statements),
 * Database Connections (pg_stat_activity), and the Overview cards — run through `baasQuery`. Host
 * metrics (CPU / memory / disk IO / network), API-gateway logs, and per-service request charts need
 * a metrics + log pipeline that isn't wired for managed project databases, so those are marked
 * platform-managed rather than faked.
 */
type Row = Record<string, unknown>;

const NAV = [
  { group: 'General', items: [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'queryperf', label: 'Query Performance', icon: Gauge },
    { key: 'apigateway', label: 'API Gateway', icon: Zap },
    { key: 'connections', label: 'Database Connections', icon: Database },
  ] },
  { group: 'Product', items: [
    { key: 'p_database', label: 'Database', icon: Database },
    { key: 'p_dataapi', label: 'Data API', icon: Zap },
    { key: 'p_auth', label: 'Auth', icon: Activity },
    { key: 'p_functions', label: 'Edge Functions', icon: Cpu },
    { key: 'p_storage', label: 'Storage', icon: HardDrive },
    { key: 'p_realtime', label: 'Realtime', icon: Activity },
  ] },
] as const;
type PageKey = (typeof NAV)[number]['items'][number]['key'];

export default function ObservabilitySection({ token, projectId, initialPage }: { token: string; projectId: number; initialPage?: PageKey }) {
  const [page, setPage] = useState<PageKey>(initialPage ?? 'overview');
  useEffect(() => { if (initialPage) setPage(initialPage); }, [initialPage]);

  // Observability is a Pro-plan feature — the summary endpoint returns 402 for non-Pro tenants.
  const [access, setAccess] = useState<'loading' | 'ok' | 'pro'>('loading');
  useEffect(() => { let alive = true; (async () => {
    try { await api.baasObsSummary(token, projectId); if (alive) setAccess('ok'); }
    catch (e) { if (alive) setAccess((e as Error).message.includes('pro_only') ? 'pro' : 'ok'); }
  })(); return () => { alive = false; }; }, [token, projectId]);

  if (access === 'loading') return <Center />;
  if (access === 'pro') return (
    <div className="mx-auto max-w-lg rounded-2xl border border-neutral-border bg-surface-card p-10 text-center">
      <Gauge size={26} className="mx-auto text-primary-blue" />
      <h3 className="mt-3 text-base font-bold font-display text-text-primary">Observability is a Pro feature</h3>
      <p className="mt-1 text-sm text-text-muted">Upgrade to the Pro plan to see project metrics — query performance, connections, request rates, and host resources.</p>
      <a href="/dashboard/billing" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Upgrade to Pro</a>
    </div>
  );

  return (
    <div className="grid grid-cols-[200px_1fr] gap-6">
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
        <div className="rounded-xl border border-neutral-border bg-surface-card p-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Custom reports</p>
          <p className="mt-1 text-xs text-text-muted">Saved metric reports appear here.</p>
        </div>
      </nav>
      <div className="min-w-0">
        {page === 'overview' && <OverviewPage token={token} projectId={projectId} />}
        {page === 'queryperf' && <QueryPerfPage token={token} projectId={projectId} />}
        {page === 'connections' && <ConnectionsPage token={token} projectId={projectId} />}
        {page === 'apigateway' && <ApiGatewayPage token={token} projectId={projectId} />}
        {page === 'p_database' && <Platform title="Database" desc="Host metrics for your database." note="CPU, memory, disk IO, and network are host metrics collected by the platform — not derivable from SQL. Available once metrics collection is enabled." />}
        {page === 'p_dataapi' && <Platform title="Data API" desc="PostgREST request metrics." note="Per-service request metrics come from the log pipeline (platform-managed)." />}
        {page === 'p_auth' && <Platform title="Auth" desc="Auth request metrics." note="Per-service request metrics come from the log pipeline (platform-managed)." />}
        {page === 'p_functions' && <Platform title="Edge Functions" desc="Function invocation metrics." note="Invocation metrics come from the functions runtime + log pipeline (platform-managed)." />}
        {page === 'p_storage' && <Platform title="Storage" desc="Storage request metrics." note="Per-service request metrics come from the log pipeline (platform-managed)." />}
        {page === 'p_realtime' && <Platform title="Realtime" desc="Realtime connection metrics." note="Realtime isn't part of the current BaaS surface." />}
      </div>
    </div>
  );
}

function useSql(token: string, projectId: number, sql: string) {
  const [rows, setRows] = useState<Row[]>([]); const [loading, setLoading] = useState(true); const [down, setDown] = useState(false); const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => { let alive = true; setLoading(true); setDown(false); setError('');
    (async () => { try { const r = await api.baasQuery(token, projectId, sql); if (alive) setRows(r.rows); }
      catch (e) { if (alive) { const m = (e as Error).message; if (/not_provisioned|unreachable|not_deployed|database_/.test(m)) setDown(true); else setError(m); } }
      finally { if (alive) setLoading(false); } })();
    return () => { alive = false; }; }, [token, projectId, sql, tick]);
  return { rows, loading, down, error, reload: () => setTick((t) => t + 1) };
}

const Center = () => <div className="flex items-center justify-center py-16 text-text-muted"><Loader2 className="animate-spin" /></div>;
const Down = ({ what }: { what: string }) => (
  <div className="rounded-2xl border border-neutral-border bg-surface-card p-8 text-center"><ServerCrash size={22} className="mx-auto text-text-muted" /><p className="mt-3 text-sm font-medium text-text-primary">Database not reachable yet</p><p className="mt-1 text-sm text-text-muted">{what} appear once the backend is deployed and the project database is provisioned.</p></div>
);
function Card({ label, value, hint, muted }: { label: string; value: string; hint?: string; muted?: boolean }) {
  return (
    <div className="rounded-2xl border border-neutral-border bg-surface-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold font-display', muted ? 'text-text-muted' : 'text-text-primary')}>{value}</p>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

function OverviewPage({ token, projectId }: { token: string; projectId: number }) {
  const { rows, loading, down, error, reload } = useSql(token, projectId, `SELECT
      (SELECT count(*) FROM pg_stat_activity)::int AS conns,
      (SELECT setting::int FROM pg_settings WHERE name='max_connections') AS max_conns,
      (SELECT pg_size_pretty(pg_database_size(current_database()))) AS db_size,
      (SELECT count(*) FROM pg_stat_statements WHERE mean_exec_time > 1000)::int AS slow_queries`);
  const r = rows[0] || {};
  // Host metrics come from the pushed pipeline (site controller); '—' until a collector reports.
  const [host, setHost] = useState<Record<string, number>>({});
  useEffect(() => { (async () => { try { const s = await api.baasObsSummary(token, projectId); setHost(Object.fromEntries(Object.entries(s.metrics).map(([k, v]) => [k, v.value]))); } catch { /* ignore */ } })(); }, [token, projectId]);
  const hostVal = (k: string, unit = '') => (host[k] != null ? `${Math.round(host[k])}${unit}` : '—');
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><div><h3 className="flex items-center gap-2 text-base font-bold font-display text-text-primary">Overview <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] text-amber-700">BETA</span></h3><p className="text-xs text-text-muted">A snapshot of your project's database health.</p></div><button onClick={reload} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-secondary"><RefreshCw size={13} /> Refresh</button></div>
      {loading ? <Center /> : down ? <Down what="Metrics" /> : (
        <>
          {error && <p className="mb-3 text-xs text-amber-700">Some metrics need the pg_stat_statements extension (enable it under Database → Extensions).</p>}
          <p className="mb-2 text-sm font-semibold text-text-primary">Database</p>
          <div className="grid grid-cols-3 gap-3">
            <Card label="Slow queries" value={String(r.slow_queries ?? '—')} hint="mean > 1s (pg_stat_statements)" />
            <Card label="Connections" value={`${r.conns ?? '—'}${r.max_conns ? ` / ${r.max_conns}` : ''}`} hint="current / max" />
            <Card label="Disk usage" value={String(r.db_size ?? '—')} hint="database size" />
            <Card label="Disk IO" value={hostVal('disk_io', '%')} hint="host metric" muted={host.disk_io == null} />
            <Card label="Memory" value={hostVal('memory', '%')} hint="host metric" muted={host.memory == null} />
            <Card label="CPU" value={hostVal('cpu', '%')} hint="host metric" muted={host.cpu == null} />
          </div>
          <p className="mb-2 mt-6 text-sm font-semibold text-text-primary">Service Health</p>
          <div className="rounded-2xl border border-neutral-border bg-surface-card p-6 text-center text-sm text-text-muted">Per-service request charts (API Gateway, PostgREST, Auth, Storage, Functions, Realtime) come from the log pipeline, which is platform-managed and populates once the backend is deployed.</div>
        </>
      )}
    </div>
  );
}

function QueryPerfPage({ token, projectId }: { token: string; projectId: number }) {
  const stats = useSql(token, projectId, `SELECT
      (SELECT count(*) FROM pg_stat_statements WHERE mean_exec_time > 1000)::int AS slow,
      (SELECT round(sum(blks_hit)*100.0/nullif(sum(blks_hit)+sum(blks_read),0),2) FROM pg_stat_database) AS cache_hit,
      (SELECT round(avg(rows::numeric/nullif(calls,0)),1) FROM pg_stat_statements) AS avg_rows`);
  const { rows, loading, down, error, reload } = useSql(token, projectId, `SELECT query, calls, round(total_exec_time::numeric,0) AS total_ms, round(mean_exec_time::numeric,0) AS mean_ms, round(max_exec_time::numeric,0) AS max_ms, rows FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 50`);
  const s = stats.rows[0] || {};
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><div><h3 className="text-base font-bold font-display text-text-primary">Query Performance</h3><p className="text-xs text-text-muted">Slowest and most frequent queries, from pg_stat_statements.</p></div><button onClick={reload} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-secondary"><RefreshCw size={13} /> Refresh</button></div>
      {loading ? <Center /> : down ? <Down what="Query stats" /> : error ? (
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-8 text-center"><p className="text-sm font-medium text-text-primary">pg_stat_statements not enabled</p><p className="mt-1 text-sm text-text-muted">Enable the <span className="font-mono">pg_stat_statements</span> extension under Database → Extensions to see query performance.</p></div>
      ) : (
        <>
          <div className="mb-3 flex gap-6 text-sm"><span><span className="font-bold text-text-primary">{String(s.slow ?? 0)}</span> <span className="text-text-muted">Slow queries</span></span><span><span className="font-bold text-text-primary">{String(s.cache_hit ?? '—')}%</span> <span className="text-text-muted">Cache hit rate</span></span><span><span className="font-bold text-text-primary">{String(s.avg_rows ?? '—')}</span> <span className="text-text-muted">Avg rows/call</span></span></div>
          <div className="overflow-auto rounded-2xl border border-neutral-border"><table className="w-full text-left text-xs"><thead className="bg-bg-secondary uppercase text-text-muted"><tr><th className="px-3 py-2 font-medium">Query</th><th className="px-3 py-2 font-medium">Total</th><th className="px-3 py-2 font-medium">Calls</th><th className="px-3 py-2 font-medium">Mean</th><th className="px-3 py-2 font-medium">Max</th><th className="px-3 py-2 font-medium">Rows</th></tr></thead>
            <tbody className="divide-y divide-neutral-border">{rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-text-muted">No query stats yet.</td></tr> : rows.map((q, i) => (
              <tr key={i}><td className="max-w-[420px] truncate px-3 py-2 font-mono text-primary-blue">{String(q.query)}</td><td className="px-3 py-2 text-text-primary">{String(q.total_ms)}ms</td><td className="px-3 py-2 text-text-muted">{String(q.calls)}</td><td className="px-3 py-2 text-text-muted">{String(q.mean_ms)}ms</td><td className="px-3 py-2 text-text-muted">{String(q.max_ms)}ms</td><td className="px-3 py-2 text-text-muted">{String(q.rows)}</td></tr>
            ))}</tbody></table></div>
        </>
      )}
    </div>
  );
}

function ConnectionsPage({ token, projectId }: { token: string; projectId: number }) {
  const ov = useSql(token, projectId, `SELECT count(*)::int AS total, count(*) FILTER (WHERE state='active')::int AS active, count(*) FILTER (WHERE state='idle in transaction')::int AS idle_tx, (SELECT setting::int FROM pg_settings WHERE name='max_connections') AS max FROM pg_stat_activity`);
  const { rows, loading, down, error, reload } = useSql(token, projectId, `SELECT state, usename AS role, application_name AS app, EXTRACT(EPOCH FROM (now()-query_start))::int AS duration_s, left(query, 120) AS query FROM pg_stat_activity WHERE state IS NOT NULL ORDER BY query_start DESC NULLS LAST LIMIT 100`);
  const o = ov.rows[0] || {};
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><div><h3 className="text-base font-bold font-display text-text-primary">Database Connections</h3><p className="text-xs text-text-muted">Live sessions on your project database.</p></div><button onClick={reload} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-secondary"><RefreshCw size={13} /> Refresh</button></div>
      {loading ? <Center /> : down ? <Down what="Connections" /> : error ? <p className="rounded-lg bg-red-50 px-3 py-2 font-mono text-xs text-red-600">{error}</p> : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Card label="Connections" value={`${o.total ?? '—'}${o.max ? ` / ${o.max}` : ''}`} />
            <Card label="Active queries" value={String(o.active ?? '—')} />
            <Card label="Idle in transaction" value={String(o.idle_tx ?? '—')} />
          </div>
          <p className="mb-2 text-sm font-semibold text-text-primary">Sessions</p>
          {rows.length === 0 ? <p className="rounded-2xl border border-neutral-border bg-surface-card p-8 text-center text-sm text-text-muted">No active sessions.</p> : (
            <div className="overflow-auto rounded-2xl border border-neutral-border"><table className="w-full text-left text-xs"><thead className="bg-bg-secondary uppercase text-text-muted"><tr><th className="px-3 py-2 font-medium">State</th><th className="px-3 py-2 font-medium">Role</th><th className="px-3 py-2 font-medium">App</th><th className="px-3 py-2 font-medium">Duration</th><th className="px-3 py-2 font-medium">Query</th></tr></thead>
              <tbody className="divide-y divide-neutral-border">{rows.map((r, i) => (
                <tr key={i}><td className="px-3 py-2"><span className={cn('rounded-full px-2 py-0.5', r.state === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-bg-secondary text-text-muted')}>{String(r.state)}</span></td><td className="px-3 py-2 font-mono text-text-primary">{String(r.role ?? '')}</td><td className="px-3 py-2 text-text-muted">{String(r.app ?? '')}</td><td className="px-3 py-2 text-text-muted">{r.duration_s != null ? `${r.duration_s}s` : '—'}</td><td className="max-w-[360px] truncate px-3 py-2 font-mono text-text-muted">{String(r.query ?? '')}</td></tr>
              ))}</tbody></table></div>
          )}
        </>
      )}
    </div>
  );
}

function ApiGatewayPage({ token, projectId }: { token: string; projectId: number }) {
  const [series, setSeries] = useState<{ ts: string; total: number }[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true); const [tick, setTick] = useState(0);
  useEffect(() => { let alive = true; setLoading(true); (async () => {
    try {
      const [s, sum] = await Promise.all([api.baasObsSeries(token, projectId, 'requests.total', 60), api.baasObsSummary(token, projectId)]);
      if (!alive) return;
      setSeries(s.series.map((p) => ({ ts: p.ts, total: p.total })));
      setSummary(Object.fromEntries(Object.entries(sum.metrics).map(([k, v]) => [k, v.value])));
    } catch { /* ignore */ } finally { if (alive) setLoading(false); }
  })(); return () => { alive = false; }; }, [token, projectId, tick]);
  if (loading) return <Center />;
  const totalReq = series.reduce((a, b) => a + b.total, 0);
  const max = Math.max(...series.map((s) => s.total), 1);
  const primitives = ['gateway', 'rest', 'auth', 'storage', 'functions'] as const;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><div><h3 className="text-base font-bold font-display text-text-primary">API Gateway</h3><p className="text-xs text-text-muted">Request volume across your project's API (last 60 minutes).</p></div><button onClick={() => setTick((t) => t + 1)} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-secondary"><RefreshCw size={13} /> Refresh</button></div>
      <div className="grid grid-cols-3 gap-3">
        <Card label="Total requests" value={String(totalReq)} hint="last 60 min" />
        <Card label="Errors" value={String(Math.round(summary['response.errors'] ?? 0))} hint="4xx / 5xx (latest window)" />
        <Card label="Avg response" value={summary['response.ms'] != null ? `${Math.round(summary['response.ms'])} ms` : '—'} hint="mean latency" />
      </div>
      <div className="mt-4 rounded-2xl border border-neutral-border bg-surface-card p-4">
        <p className="mb-3 text-sm font-semibold text-text-primary">Requests over time</p>
        {series.length === 0 ? <p className="py-8 text-center text-sm text-text-muted">No requests recorded yet. Traffic appears here once the backend is deployed and receiving requests.</p> : (
          <div className="flex h-32 items-end gap-0.5">{series.map((s, i) => <div key={i} title={`${s.total} req`} className="flex-1 rounded-t bg-primary-blue" style={{ height: `${Math.max(3, (s.total / max) * 100)}%` }} />)}</div>
        )}
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-text-primary">By service (latest window)</p>
        <div className="divide-y divide-neutral-border rounded-2xl border border-neutral-border">
          {primitives.map((p) => (<div key={p} className="flex items-center justify-between px-4 py-2.5 text-sm"><span className="capitalize text-text-primary">{p}</span><span className="font-mono text-text-muted">{Math.round(summary[`requests.${p}`] ?? 0)} req</span></div>))}
        </div>
      </div>
    </div>
  );
}

function Platform({ title, desc, note }: { title: string; desc: string; note: string }) {
  return (
    <div>
      <h3 className="text-base font-bold font-display text-text-primary">{title}</h3>
      <p className="mb-4 text-xs text-text-muted">{desc}</p>
      <div className="flex items-center gap-3 rounded-2xl border border-neutral-border bg-surface-card p-6 text-sm">
        <ChevronRight size={18} className="shrink-0 text-text-muted" />
        <p className="text-text-secondary">{note}</p>
      </div>
    </div>
  );
}
