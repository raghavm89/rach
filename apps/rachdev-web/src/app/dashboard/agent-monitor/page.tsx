'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Network, Coins, Activity, RefreshCw, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { agentMonitor, type AgentMonitorOverview, type AgentMonitorEntity, type AgentMonitorActivity } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatsCard } from '@/components/dashboard/StatsCard';

const STATUS_CLASS: Record<string, string> = {
  deployed:  'bg-ok-bg text-ok',
  published: 'bg-accent-weak text-accent',
  draft:     'bg-surface-hover text-dash-muted',
  disabled:  'bg-red-50 text-red-600',
};

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const fmt = (n: number) => n.toLocaleString();

export default function AgentMonitorPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AgentMonitorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try { setData(await agentMonitor.overview(token)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const entities = data?.entities ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Agent Monitor"
        subtitle="Your deployed agents and teams — activity and credit spend at a glance."
        actions={
          <button onClick={() => { setLoading(true); load(); }} disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Agents" value={s?.agents ?? '—'} icon={Bot} accent />
        <StatsCard label="Teams" value={s?.teams ?? '—'} icon={Network} />
        <StatsCard label="Credits left" value={s ? fmt(s.balance) : '—'} icon={Coins} />
        <StatsCard label="Credits spent today" value={s ? fmt(s.spent_today) : '—'} icon={Activity} />
      </div>

      {/* Agents + teams */}
      <div className="mb-6 overflow-hidden rounded-xl border border-neutral-border bg-surface-card">
        <div className="flex items-center justify-between border-b border-neutral-border px-5 py-3">
          <h3 className="text-sm font-semibold text-dash-heading">Agents &amp; teams</h3>
          <span className="text-xs text-dash-muted">{fmt(s?.spent_total ?? 0)} credits spent all-time</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-border text-left text-xs uppercase tracking-wide text-dash-muted">
                {['Name', 'Type', 'Status', 'Activity (today / total)', 'Credits', 'Last active', 'Model'].map((h) => (
                  <th key={h} className="px-5 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entities.map((e: AgentMonitorEntity) => (
                <tr key={`${e.kind}-${e.id}`} className="border-b border-neutral-border last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {e.kind === 'team' ? <Network size={14} className="text-accent" /> : <Bot size={14} className="text-accent" />}
                      <div>
                        <div className="font-medium text-dash-heading">{e.name}</div>
                        <div className="text-xs text-dash-muted">{e.subtitle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-dash-muted">{e.kind}</span></td>
                  <td className="px-5 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[e.status] ?? 'bg-surface-hover text-dash-muted'}`}>{e.status}</span></td>
                  <td className="px-5 py-3 text-dash-muted">{e.runs_today} / {e.runs_total}</td>
                  <td className="px-5 py-3 text-dash-muted">{fmt(e.credits_spent)}</td>
                  <td className="px-5 py-3 text-dash-muted">{timeAgo(e.last_run)}</td>
                  <td className="px-5 py-3"><span className="font-mono text-xs text-dash-muted">{e.model}</span></td>
                </tr>
              ))}
              {!loading && entities.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-dash-muted">No agents or teams yet — build one in Agent Builder or Agent Teams.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent activity (credit ledger) */}
      <div className="overflow-hidden rounded-xl border border-neutral-border bg-surface-card">
        <div className="border-b border-neutral-border px-5 py-3"><h3 className="text-sm font-semibold text-dash-heading">Recent activity</h3></div>
        <ul className="divide-y divide-neutral-border">
          {(data?.recent ?? []).map((r: AgentMonitorActivity, i: number) => (
            <li key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                {r.type === 'purchase'
                  ? <ArrowUpRight size={15} className="shrink-0 text-ok" />
                  : <ArrowDownRight size={15} className="shrink-0 text-dash-muted" />}
                <span className="truncate text-dash-body">{r.description}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`font-medium ${r.type === 'purchase' ? 'text-ok' : 'text-dash-body'}`}>{r.type === 'purchase' ? '+' : '−'}{fmt(Math.abs(r.credits))}</span>
                <span className="text-xs text-dash-muted">{timeAgo(r.at)}</span>
              </div>
            </li>
          ))}
          {!loading && (data?.recent?.length ?? 0) === 0 && <li className="px-5 py-8 text-center text-dash-muted">No activity yet.</li>}
        </ul>
      </div>
    </div>
  );
}
