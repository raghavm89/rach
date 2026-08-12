'use client';

import { useState } from 'react';
import { Copy, Download, UploadCloud, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { TeamGraph } from '@rach/ui/lib/api';

/**
 * L3 Technical — the developer view. A flat table of every node's real config
 * (model, prompt, connector, endpoint, rules) plus the exportable/importable
 * graph JSON. This is the escape hatch for technical users; L1/L2 stay clean.
 */

type NodeLike = { id: string; type: string; data?: Record<string, unknown> };
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function detailsOf(n: NodeLike): string {
  const d = n.data ?? {};
  switch (n.type) {
    case 'channel': return `channel: ${str(d.channel) || '—'}`;
    case 'conductor': return `rules: ${Array.isArray(d.rules) ? d.rules.length : 0}`;
    case 'specialist': return [d.agentDefId ? `agent #${d.agentDefId}` : null, `model: ${str(d.model) || 'auto'}`, str(d.prompt) ? `prompt: ${str(d.prompt).slice(0, 40)}…` : null].filter(Boolean).join(' · ');
    case 'integration': return [`${str(d.integration) || '—'}`, `type: ${str(d.toolType) || 'connector'}`, d.connectorId ? `id: ${str(d.connectorId)}` : null, d.url ? `${str(d.method) || 'GET'} ${str(d.url)}` : null].filter(Boolean).join(' · ');
    default: return '—';
  }
}

export function TeamTechnical({ graph, onImport, saving }: {
  graph: TeamGraph; onImport: (g: TeamGraph) => void; saving?: boolean;
}) {
  const nodes = ((graph?.nodes ?? []) as unknown as NodeLike[]);
  const pretty = JSON.stringify(graph ?? { nodes: [], edges: [] }, null, 2);
  const [draft, setDraft] = useState(pretty);
  const [copied, setCopied] = useState(false);
  const dirty = draft.trim() !== pretty.trim();

  function copy() { navigator.clipboard.writeText(pretty); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  function download() {
    const blob = new Blob([pretty], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'team-graph.json'; a.click();
    URL.revokeObjectURL(url);
  }
  function apply() {
    let parsed: unknown;
    try { parsed = JSON.parse(draft); } catch { toast.error('Invalid JSON'); return; }
    const g = parsed as { nodes?: unknown; edges?: unknown };
    if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) { toast.error('Graph must have "nodes" and "edges" arrays'); return; }
    onImport(parsed as TeamGraph);
  }

  return (
    <div className="space-y-4">
      {/* Config table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <div className="border-b border-neutral-border px-5 py-3 text-sm font-semibold text-dash-heading">Nodes &amp; configuration</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-border text-left text-xs uppercase tracking-wide text-dash-muted">
              {['Node', 'Type', 'ID', 'Configuration'].map((h) => <th key={h} className="px-5 py-2.5 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {nodes.map((n) => (
                <tr key={n.id} className="border-b border-neutral-border last:border-0">
                  <td className="px-5 py-2.5 font-medium text-dash-heading">{str(n.data?.label) || str(n.data?.integration) || n.type}</td>
                  <td className="px-5 py-2.5"><span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] text-dash-muted">{n.type}</span></td>
                  <td className="px-5 py-2.5"><span className="font-mono text-[11px] text-dash-muted">{n.id}</span></td>
                  <td className="px-5 py-2.5 font-mono text-[11px] text-dash-muted">{detailsOf(n)}</td>
                </tr>
              ))}
              {nodes.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-dash-muted">No nodes yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Graph JSON */}
      <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-dash-heading">Graph JSON</h3>
          <div className="flex items-center gap-2">
            <button onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-2.5 py-1.5 text-[12px] font-medium text-dash-body hover:bg-surface-hover">{copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />} Copy</button>
            <button onClick={download} className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-2.5 py-1.5 text-[12px] font-medium text-dash-body hover:bg-surface-hover"><Download size={13} /> Export</button>
            <button onClick={apply} disabled={!dirty || !!saving} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} Apply JSON</button>
          </div>
        </div>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} rows={16}
          className="w-full rounded-lg border border-white/10 bg-[#0d1117] px-3 py-2 font-mono text-[12px] leading-relaxed text-slate-200 outline-none focus:border-accent" />
        <p className="mt-1 text-[11px] text-dash-muted">Editing here replaces the whole graph on Apply — useful for versioning or bulk edits. Switch to Blocks to see the result.</p>
      </div>
    </div>
  );
}
