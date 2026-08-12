'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, Radio, Stethoscope, ClipboardList, Package, ArrowRight, ShieldCheck, Activity, AlertCircle, ScrollText } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { controlTower, audit, type ControlTowerOverview, type ControlTowerAgent, type AuditEntry, type AuditSummary } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';

const AGENT_ICON: Record<string, typeof Radio> = { scribe: Stethoscope, reception: ClipboardList, inventory: Package };
const STATUS_DOT: Record<string, string> = { active: 'bg-ok', idle: 'bg-wait', disabled: 'bg-dash-muted' };

const DECISION_CLS: Record<string, string> = {
  created: 'bg-surface-hover text-dash-body',
  confirmed: 'bg-wait-bg text-wait',
  modified: 'bg-wait-bg text-wait',
  signed: 'bg-ok-bg text-ok',
  assigned: 'bg-accent-weak text-accent',
  completed: 'bg-ok-bg text-ok',
  cancelled: 'bg-surface-hover text-dash-muted',
  overridden: 'bg-red-50 text-red-600',
  flagged: 'bg-red-50 text-red-600',
  consent: 'bg-accent-weak text-accent',
};

function ago(iso: string | null): string {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ControlTowerPage() {
  const { token } = useAuth();
  const [ov, setOv] = useState<ControlTowerOverview | null>(null);
  const [sum, setSum] = useState<AuditSummary | null>(null);
  const [feed, setFeed] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const [o, s, f] = await Promise.all([
        controlTower.overview(token),
        audit.summary(token),
        audit.list(token, { limit: 12 }),
      ]);
      setOv(o); setSum(s); setFeed(f.entries);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const tiles = [
    { label: 'Active agents', value: ov?.summary?.active_agents ?? 0, icon: Activity },
    { label: 'Actions today', value: sum?.today ?? 0, icon: ScrollText },
    { label: 'Notes signed', value: ov?.summary?.notes_signed ?? 0, icon: ShieldCheck },
    { label: 'Shortage alerts', value: ov?.health?.shortage_alerts ?? 0, icon: AlertCircle },
  ];

  // Handoff pipeline (deck architecture): intake → scribe → coordination, with pharmacy alongside.
  const PIPE = [
    { name: 'Asha', role: 'Intake', icon: ClipboardList },
    { name: 'Naina', role: 'Scribe', icon: Stethoscope },
    { name: 'Kabir', role: 'Coordination', icon: Radio },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Control Tower"
        subtitle="Live view of the agent team, the handoff pipeline and every logged decision"
        actions={<button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs text-dash-body hover:bg-surface-hover"><RefreshCw size={13} /> Refresh</button>}
      />

      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle size={15} /> {error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-6">
          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-2xl border border-neutral-border bg-surface-card p-4">
                <div className="flex items-center gap-2 text-xs text-dash-muted"><t.icon size={14} /> {t.label}</div>
                <p className="mt-1 text-2xl font-bold text-dash-heading">{t.value}</p>
              </div>
            ))}
          </div>

          {/* Handoff pipeline */}
          <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-dash-heading">Handoff pipeline</h3>
            <div className="flex flex-wrap items-center gap-2">
              {PIPE.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-xl border border-neutral-border bg-surface-app px-3 py-2">
                    <p.icon size={15} className="text-accent" />
                    <div><div className="text-sm font-semibold text-dash-heading">{p.name}</div><div className="text-[11px] text-dash-muted">{p.role}</div></div>
                  </div>
                  {i < PIPE.length - 1 && <ArrowRight size={16} className="text-dash-muted" />}
                </div>
              ))}
              <div className="ml-2 flex items-center gap-2 rounded-xl border border-dashed border-neutral-border px-3 py-2">
                <Package size={15} className="text-dash-muted" />
                <div><div className="text-sm font-semibold text-dash-heading">Kiran</div><div className="text-[11px] text-dash-muted">Pharmacy · alongside</div></div>
              </div>
            </div>
          </div>

          {/* Agent roster */}
          <div className="grid gap-4 md:grid-cols-3">
            {(ov?.agents ?? []).map((a: ControlTowerAgent) => {
              const Icon = AGENT_ICON[a.key] ?? Radio;
              return (
                <div key={a.key} className="rounded-2xl border border-neutral-border bg-surface-card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={17} className="text-accent" />
                      <div>
                        <div className="text-sm font-semibold text-dash-heading">{a.name}</div>
                        <div className="text-[11px] text-dash-muted">{a.role}</div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-dash-muted">
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[a.status] ?? 'bg-dash-muted'}`} /> {a.status}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
                    <dt className="text-dash-muted">Runs today</dt><dd className="text-right font-medium text-dash-heading">{a.runs_today}</dd>
                    <dt className="text-dash-muted">Total</dt><dd className="text-right font-medium text-dash-heading">{a.runs_total}</dd>
                    {a.success_rate != null && (<><dt className="text-dash-muted">Approved</dt><dd className="text-right font-medium text-dash-heading">{a.success_rate}%</dd></>)}
                    <dt className="text-dash-muted">Last run</dt><dd className="text-right text-dash-body">{ago(a.last_run)}</dd>
                  </dl>
                  <p className="mt-3 truncate rounded-md bg-surface-hover px-2 py-1 text-[11px] text-dash-muted" title={a.model}>{a.model}</p>
                </div>
              );
            })}
          </div>

          {/* Live decision feed */}
          <div className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
            <div className="flex items-center justify-between border-b border-neutral-border px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-dash-heading"><ScrollText size={15} /> Recent decisions</h3>
              <Link href="/dashboard/clinical/audit" className="text-xs text-accent hover:underline">Full audit log →</Link>
            </div>
            {feed.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-dash-muted">No agent activity logged yet. Confirm an intake or sign a note to see it here.</p>
            ) : (
              <ul className="divide-y divide-neutral-border">
                {feed.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className={`w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold ${DECISION_CLS[f.decision ?? ''] ?? 'bg-surface-hover text-dash-body'}`}>{f.decision ?? '—'}</span>
                    <span className="min-w-0 flex-1 truncate text-dash-body"><span className="font-medium text-dash-heading">{f.agent ?? 'System'}</span> · {f.action}{f.patient_ref ? <span className="text-dash-muted"> · {f.patient_ref}</span> : null}</span>
                    <span className="shrink-0 text-xs text-dash-muted">{f.actor_name ?? '—'}</span>
                    <span className="w-16 shrink-0 text-right text-xs text-dash-muted">{ago(f.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
