'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, AlertCircle, Search, Download, ShieldCheck } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { audit, type AuditEntry } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';

const AGENTS = ['Naina', 'Asha', 'Kabir', 'Kiran'];
const DECISIONS = ['created', 'confirmed', 'modified', 'signed', 'assigned', 'completed', 'cancelled', 'overridden', 'flagged', 'consent'];
const PAGE = 50;

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

export default function AuditPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [agent, setAgent] = useState('');
  const [decision, setDecision] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (reset = false) => {
    if (!token) return;
    setLoading(true); setError('');
    const off = reset ? 0 : offset;
    try {
      const r = await audit.list(token, { agent: agent || undefined, decision: decision || undefined, q: q || undefined, limit: PAGE, offset: off });
      setRows((prev) => (off === 0 ? r.entries : [...prev, ...r.entries]));
      setTotal(r.total); setOffset(off + r.entries.length);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [token, agent, decision, q, offset]);

  // Reload from the top whenever a filter changes.
  useEffect(() => { setOffset(0); load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, agent, decision]);

  const exportCsv = () => {
    const head = ['time', 'agent', 'action', 'decision', 'patient', 'source', 'model', 'actor'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((r) => [new Date(r.created_at).toISOString(), r.agent, r.action, r.decision, r.patient_ref, r.source, r.model, r.actor_name].map(esc).join(','));
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const selCls = 'rounded-lg border border-neutral-border bg-surface-app px-2 py-1.5 text-sm text-dash-body focus:border-accent focus:outline-none';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Audit Log"
        subtitle="Append-only record of every agent action and clinician decision — who, what, when, and the source"
        actions={<button onClick={exportCsv} disabled={!rows.length} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs text-dash-body hover:bg-surface-hover disabled:opacity-50"><Download size={13} /> Export CSV</button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-neutral-border bg-surface-app px-2">
          <Search size={14} className="text-dash-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setOffset(0), load(true))} placeholder="Search patient, action…" className="bg-transparent py-1.5 text-sm text-dash-heading focus:outline-none" />
        </div>
        <select value={agent} onChange={(e) => setAgent(e.target.value)} className={selCls}><option value="">All agents</option>{AGENTS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <select value={decision} onChange={(e) => setDecision(e.target.value)} className={selCls}><option value="">All decisions</option>{DECISIONS.map((d) => <option key={d} value={d}>{d}</option>)}</select>
        <button onClick={() => { setOffset(0); load(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs text-dash-body hover:bg-surface-hover"><RefreshCw size={13} /> Refresh</button>
        <span className="ml-auto text-xs text-dash-muted">{total} entries</span>
      </div>

      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle size={15} /> {error}</div>}

      <div className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-border text-left text-xs uppercase tracking-wide text-dash-muted">
              {['Time', 'Agent', 'Action', 'Decision', 'Patient', 'Source', 'By'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-neutral-border last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-dash-muted">{new Date(r.created_at).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-4 py-2.5 font-medium text-dash-heading">{r.agent ?? <span className="text-dash-muted">System</span>}</td>
                <td className="px-4 py-2.5 text-dash-body">{r.action}{r.summary ? <span className="block truncate text-xs text-dash-muted" title={r.summary}>{r.summary}</span> : null}</td>
                <td className="px-4 py-2.5">{r.decision ? <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${DECISION_CLS[r.decision] ?? 'bg-surface-hover text-dash-body'}`}>{r.decision}</span> : '—'}</td>
                <td className="px-4 py-2.5 text-dash-body">{r.patient_ref ?? '—'}</td>
                <td className="px-4 py-2.5"><span className="text-xs text-dash-muted">{r.source ?? '—'}{r.model ? ` · ${r.model}` : ''}</span></td>
                <td className="px-4 py-2.5 text-dash-body">{r.actor_name ?? '—'}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-dash-muted"><ShieldCheck size={22} className="mx-auto mb-2 opacity-60" />No audit entries{agent || decision || q ? ' for this filter' : ' yet'}.</td></tr>
            )}
          </tbody>
        </table>
        {loading && <div className="flex items-center gap-2 px-4 py-4 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>}
      </div>

      {rows.length < total && !loading && (
        <div className="mt-4 text-center">
          <button onClick={() => load(false)} className="inline-flex items-center gap-2 rounded-lg border border-neutral-border px-4 py-2 text-sm text-dash-body hover:bg-surface-hover">Load more ({total - rows.length} more)</button>
        </div>
      )}
    </div>
  );
}
