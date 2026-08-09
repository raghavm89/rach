'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Bot, CheckCircle2, FileText, RefreshCw, Cpu } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { agentMonitor, type AgentMonitorOverview, type AgentMonitorAgent, type AgentMonitorActivity } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatsCard } from '@/components/dashboard/StatsCard';

const STATUS_CLASS: Record<string, string> = {
  active:   'bg-ok-bg text-ok',
  idle:     'bg-surface-hover text-dash-muted',
  disabled: 'bg-red-50 text-red-600',
};

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AgentMonitorPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AgentMonitorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await agentMonitor.overview(token);
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Agent Monitor"
        subtitle="Your organization's agents at a glance"
        actions={
          <button
            onClick={() => { setLoading(true); load(); }}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Active agents" value={s?.active_agents ?? '—'} icon={Bot} accent />
        <StatsCard label="Runs today"    value={s?.runs_today ?? '—'}    icon={Activity} />
        <StatsCard label="Notes signed"  value={s?.notes_signed ?? '—'}  icon={CheckCircle2} />
        <StatsCard label="Drafts pending" value={s?.notes_draft ?? '—'}  icon={FileText} />
      </div>

      {/* Per-agent table */}
      <div className="mb-6 overflow-hidden rounded-xl border border-neutral-border bg-surface-card">
        <div className="border-b border-neutral-border px-5 py-3">
          <h3 className="text-sm font-semibold text-dash-heading">Agents</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-border text-left text-xs uppercase tracking-wide text-dash-muted">
              {['Agent', 'Status', 'Runs (today / total)', 'Signed', 'Success', 'Last run', 'Model'].map((h) => (
                <th key={h} className="px-5 py-2.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.agents ?? []).map((a: AgentMonitorAgent) => (
              <tr key={a.key} className="border-b border-neutral-border last:border-0">
                <td className="px-5 py-3">
                  <div className="font-medium text-dash-heading">{a.name}</div>
                  <div className="text-xs text-dash-muted">{a.role}</div>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[a.status] ?? 'bg-surface-hover text-dash-muted'}`}>{a.status}</span>
                </td>
                <td className="px-5 py-3 text-dash-muted">{a.runs_today} / {a.runs_total}</td>
                <td className="px-5 py-3 text-dash-muted">{a.signed}</td>
                <td className="px-5 py-3 text-dash-muted">{a.success_rate == null ? '—' : `${a.success_rate}%`}</td>
                <td className="px-5 py-3 text-dash-muted">{timeAgo(a.last_run)}</td>
                <td className="px-5 py-3"><span className="font-mono text-xs text-dash-muted">{a.model}</span></td>
              </tr>
            ))}
            {!loading && (data?.agents?.length ?? 0) === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-dash-muted">No agents yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-neutral-border bg-surface-card">
          <div className="border-b border-neutral-border px-5 py-3"><h3 className="text-sm font-semibold text-dash-heading">Recent activity</h3></div>
          <ul className="divide-y divide-neutral-border">
            {(data?.recent ?? []).map((r: AgentMonitorActivity, i: number) => (
              <li key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <span className="font-medium text-dash-heading">{r.agent}</span>
                  <span className="text-dash-muted"> · {r.kind}{r.ref ? ` · ${r.ref}` : ''}</span>
                  {r.author && <span className="text-dash-muted"> · {r.author}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === 'signed' ? 'bg-ok-bg text-ok' : 'bg-wait-bg text-wait'}`}>{r.status}</span>
                  <span className="text-xs text-dash-muted">{timeAgo(r.at)}</span>
                </div>
              </li>
            ))}
            {!loading && (data?.recent?.length ?? 0) === 0 && <li className="px-5 py-8 text-center text-dash-muted">No activity yet.</li>}
          </ul>
        </div>

        {/* Health */}
        <div className="rounded-xl border border-neutral-border bg-surface-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-dash-heading"><Cpu size={15} /> Health</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-dash-muted">Models in use</p>
              {(data?.health.models ?? []).length
                ? <div className="mt-1 flex flex-wrap gap-1.5">{data!.health.models.map((m: string) => <span key={m} className="rounded-md bg-surface-hover px-2 py-0.5 font-mono text-xs text-dash-muted">{m}</span>)}</div>
                : <p className="mt-1 text-dash-muted">—</p>}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-dash-muted">Drafts awaiting sign-off</p>
              <p className="mt-1 font-medium text-dash-heading">{data?.health.drafts_pending ?? 0}</p>
            </div>
            {(data?.health.shortage_alerts ?? 0) > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-dash-muted">Open shortage alerts</p>
                <p className="mt-1 font-medium text-wait">{data!.health.shortage_alerts}</p>
              </div>
            )}
            {(data?.health.disabled ?? []).length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-dash-muted">Disabled agents</p>
                <p className="mt-1 text-red-600">{data!.health.disabled.join(', ')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
