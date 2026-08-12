'use client';

import { useState } from 'react';
import { Plus, Trash2, ArrowRight, ArrowUp, ArrowDown, Save, Loader2, GitBranch, Sparkles } from 'lucide-react';
import type { TeamGraph, TeamTraceStep } from '@rach/ui/lib/api';

/**
 * L2 Logic — the routing layer. Explicit, ordered rules the conductor evaluates
 * before falling back to the LLM: the first rule whose keywords appear in a
 * message routes it to that specialist (or human handoff), deterministically and
 * without spending a routing credit. Also shows the latest run's decision trace.
 */

type Rule = { when: string; to: string };
type NodeLike = { id: string; type: string; data?: Record<string, unknown> };
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const INPUT = 'w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading outline-none focus:border-accent';

export function TeamLogic({ graph, onSave, saving, lastTrace = [] }: {
  graph: TeamGraph; onSave: (g: TeamGraph) => void; saving?: boolean; lastTrace?: TeamTraceStep[];
}) {
  const nodes = ((graph?.nodes ?? []) as unknown as NodeLike[]);
  const conductor = nodes.find((n) => n.type === 'conductor');
  const specialists = nodes.filter((n) => n.type === 'specialist');
  const hasHandoff = nodes.some((n) => n.type === 'handoff');
  const label = (n: NodeLike) => str(n.data?.label) || n.id;

  const initial = (conductor?.data?.rules as Rule[] | undefined) ?? [];
  const [rules, setRules] = useState<Rule[]>(initial.map((r) => ({ when: str(r.when), to: str(r.to) })));
  const [dirty, setDirty] = useState(false);

  if (!conductor) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-border py-16 text-center">
        <GitBranch size={26} className="text-dash-muted" />
        <p className="mt-3 text-sm font-medium text-dash-heading">No conductor yet</p>
        <p className="mt-1 text-[13px] text-dash-muted">Add a Conductor node on the Blocks canvas to define routing rules.</p>
      </div>
    );
  }

  const set = (next: Rule[]) => { setRules(next); setDirty(true); };
  const addRule = () => set([...rules, { when: '', to: specialists[0]?.id ?? '' }]);
  const update = (i: number, patch: Partial<Rule>) => set(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => set(rules.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= rules.length) return;
    const next = [...rules]; [next[i], next[j]] = [next[j], next[i]]; set(next);
  };

  function save() {
    const clean = rules.map((r) => ({ when: r.when.trim(), to: r.to })).filter((r) => r.when && r.to);
    const nextNodes = nodes.map((n) => (n.id === conductor!.id ? { ...n, data: { ...(n.data ?? {}), rules: clean } } : n));
    onSave({ nodes: nextNodes, edges: graph.edges } as unknown as TeamGraph);
    setDirty(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      {/* Rules */}
      <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-dash-heading">Routing rules</h3>
          <button onClick={save} disabled={!!saving || !dirty} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save rules</button>
        </div>
        <p className="mb-3 text-[12px] text-dash-muted">Checked top to bottom. The first rule whose keywords appear in the message wins — no LLM, no credit. If none match, the conductor routes with the model.</p>

        {rules.length === 0 && <p className="rounded-lg border border-dashed border-neutral-border px-3 py-4 text-center text-[13px] text-dash-muted">No rules yet — the conductor routes every message with the model. Add a rule to make common cases deterministic.</p>}

        <div className="space-y-2">
          {rules.map((r, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-neutral-border p-2">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-dash-muted hover:text-accent disabled:opacity-30"><ArrowUp size={13} /></button>
                <button onClick={() => move(i, 1)} disabled={i === rules.length - 1} className="text-dash-muted hover:text-accent disabled:opacity-30"><ArrowDown size={13} /></button>
              </div>
              <div className="flex-1">
                <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-dash-muted">When message contains</label>
                <input value={r.when} onChange={(e) => update(i, { when: e.target.value })} placeholder="refund, return, money back" className={INPUT} />
              </div>
              <ArrowRight size={15} className="mt-4 shrink-0 text-dash-muted" />
              <div className="w-40">
                <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-dash-muted">Route to</label>
                <select value={r.to} onChange={(e) => update(i, { to: e.target.value })} className={INPUT}>
                  {specialists.map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}
                  {hasHandoff && <option value="handoff">Human handoff</option>}
                </select>
              </div>
              <button onClick={() => remove(i)} title="Remove rule" className="mt-4 rounded-md p-1.5 text-dash-muted hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        <button onClick={addRule} className="mt-3 flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-[12px] font-medium text-dash-body hover:bg-surface-hover"><Plus size={13} /> Add rule</button>
      </div>

      {/* Decision trace */}
      <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-dash-heading"><Sparkles size={14} className="text-accent" /> Last decision</h3>
        <p className="mt-0.5 text-[12px] text-dash-muted">How the most recent test message flowed through the team.</p>
        {lastTrace.length > 0 ? (
          <ol className="mt-3 space-y-2">
            {lastTrace.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px]">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-weak text-[10px] font-semibold text-accent">{i + 1}</span>
                <span><span className="font-medium text-dash-heading">{s.label}</span> <span className="text-dash-muted">· {s.detail}</span></span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-[13px] text-dash-muted">Run a message in the test panel below to see the routing decision here.</p>
        )}
      </div>
    </div>
  );
}
