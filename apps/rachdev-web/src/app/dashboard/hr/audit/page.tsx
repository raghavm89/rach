'use client';

import { useState } from 'react';
import { Bot, User, Cog, Download, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import { formatDateTime, type AuditEvent } from '@/lib/hr/demo';

function ActorIcon({ actor }: { actor: string }) {
  if (actor === 'ai') return <Bot size={13} className="text-accent" />;
  if (actor === 'system') return <Cog size={13} className="text-dash-muted" />;
  return <User size={13} className="text-dash-muted" />;
}

function toCsv(rows: AuditEvent[]): string {
  const head = ['id', 'at', 'actor', 'actorName', 'action', 'subjectType', 'subjectId', 'detail', 'modelVersion'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [head.join(','), ...rows.map((e) => head.map((k) => esc((e as unknown as Record<string, unknown>)[k])).join(','))].join('\n');
}

export default function HrAuditPage() {
  const { get, loading, error, reload, setLoading } = useHr(['audit']);
  const audit = get<AuditEvent>('audit');
  const [actor, setActor] = useState('all');
  const [subject, setSubject] = useState('all');

  const subjectTypes = Array.from(new Set(audit.map((e) => e.subjectType))).sort();
  const filtered = audit
    .filter((e) => actor === 'all' || e.actor === actor)
    .filter((e) => subject === 'all' || e.subjectType === subject)
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  const aiCount = filtered.filter((e) => e.actor === 'ai').length;

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'hr-audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const sel = 'rounded-lg border border-neutral-border bg-surface-card px-2.5 py-1.5 text-[12.5px] text-dash-heading outline-none focus:border-accent';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Audit Log"
        subtitle="Every automated decision is logged for compliance — AI entries carry the model version that produced them."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => { setLoading(true); reload(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={exportCsv} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover">
              <Download size={15} /> Export CSV
            </button>
          </div>
        }
      />

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select value={actor} onChange={(e) => setActor(e.target.value)} className={sel}>
            <option value="all">All actors</option>
            <option value="ai">AI</option>
            <option value="user">People</option>
            <option value="system">System</option>
          </select>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={sel}>
            <option value="all">All subjects</option>
            {subjectTypes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <span className="text-[11px] text-dash-muted">{loading ? 'Loading…' : `${filtered.length} events · ${aiCount} by AI`}</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-border text-left text-xs text-dash-muted">
              <th className="px-5 py-2.5 font-medium">Timestamp</th>
              <th className="px-3 py-2.5 font-medium">Actor</th>
              <th className="px-3 py-2.5 font-medium">Action</th>
              <th className="px-3 py-2.5 font-medium">Subject</th>
              <th className="px-3 py-2.5 font-medium">Detail</th>
              <th className="px-5 py-2.5 text-right font-medium">Model</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-neutral-border last:border-0 align-top">
                <td className="whitespace-nowrap px-5 py-2.5 text-[11px] text-dash-muted">{formatDateTime(e.at)}</td>
                <td className="px-3 py-2.5"><span className="flex items-center gap-1.5 text-[12.5px] text-dash-body"><ActorIcon actor={e.actor} />{e.actorName}</span></td>
                <td className="px-3 py-2.5 text-[11.5px] text-dash-body">{e.action}</td>
                <td className="px-3 py-2.5 text-[11px] text-dash-muted">{e.subjectId}</td>
                <td className="max-w-md px-3 py-2.5 text-[12.5px] text-dash-body"><span className="line-clamp-2">{e.detail}</span></td>
                <td className="px-5 py-2.5 text-right">{e.modelVersion && <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10.5px] text-dash-muted">{e.modelVersion}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <div className="p-8 text-center text-[13px] text-dash-muted">No events match the current filters.</div>}
      </div>
    </div>
  );
}
