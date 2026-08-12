'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap, addEdge, useNodesState, useEdgesState,
  Handle, Position, MarkerType, type Node, type Edge, type Connection, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, Radio, Plug, UserRound, Loader2, Save, Plus, Trash2, Undo2, Redo2 } from 'lucide-react';
import type { TeamGraph, TeamNode, ModelOption } from '@rach/ui/lib/api';

/** Interactive team canvas (M2): drag, add, connect, configure, save. */

type Data = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

const HANDLE = '!h-2.5 !w-2.5 !rounded-full !border-2 !border-[#0d1117] !bg-slate-400';

function Card({ icon, tint, title, subtitle, badge, selected }: {
  icon: React.ReactNode; tint: string; title: string; subtitle?: string; badge: string; selected?: boolean;
}) {
  return (
    <div className={`w-[204px] rounded-xl border bg-[#161b22] px-3 py-2.5 shadow-md transition ${selected ? 'border-accent ring-2 ring-accent/40' : 'border-white/10'}`}>
      <Handle type="target" position={Position.Left} className={HANDLE} />
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tint}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-100">{title}</p>
          {subtitle && <p className="truncate text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400">{badge}</span>
      </div>
      <Handle type="source" position={Position.Right} className={HANDLE} />
    </div>
  );
}
const ChannelNode = ({ data, selected }: NodeProps) => { const d = data as Data; return <Card selected={selected} badge="Channel" tint="bg-slate-500/20" icon={<Radio size={15} className="text-slate-300" />} title={str(d.label) || 'Channel'} subtitle={str(d.channel) || 'channel'} />; };
const ConductorNode = ({ data, selected }: NodeProps) => { const d = data as Data; return <Card selected={selected} badge="Router" tint="bg-blue-500/20" icon={<Bot size={15} className="text-blue-300" />} title={str(d.label) || 'Conductor'} subtitle={str(d.role) || 'routes messages'} />; };
const SpecialistNode = ({ data, selected }: NodeProps) => { const d = data as Data; return <Card selected={selected} badge="Agent" tint="bg-violet-500/20" icon={<Bot size={15} className="text-violet-300" />} title={str(d.label) || 'Specialist'} subtitle={str(d.role) || str(d.prompt).slice(0, 60)} />; };
const IntegrationNode = ({ data, selected }: NodeProps) => { const d = data as Data; return <Card selected={selected} badge="Tool" tint="bg-emerald-500/20" icon={<Plug size={15} className="text-emerald-300" />} title={str(d.integration) || str(d.label) || 'Integration'} subtitle={str(d.toolType) || 'integration'} />; };
const HandoffNode = ({ data, selected }: NodeProps) => { const d = data as Data; return <Card selected={selected} badge="Human" tint="bg-amber-500/20" icon={<UserRound size={15} className="text-amber-300" />} title={str(d.label) || 'Human handoff'} subtitle="escalate to a person" />; };

const nodeTypes = { channel: ChannelNode, conductor: ConductorNode, specialist: SpecialistNode, integration: IntegrationNode, handoff: HandoffNode };

// The channels a team can receive messages on (mirrors the connector registry).
const CHANNEL_OPTIONS: { id: string; label: string; hint: string }[] = [
  { id: 'website', label: 'Website widget', hint: 'Embed a chat bubble on your site (available on deploy).' },
  { id: 'whatsapp', label: 'WhatsApp', hint: 'Connect a WhatsApp number under Connections, then set the webhook shown on deploy.' },
  { id: 'slack', label: 'Slack', hint: 'Authorize Slack under Connections to post and receive messages.' },
];

// The tools an integration node can be (mirrors the connector registry). Picking
// one sets the connector id + tool type; connectors run live once connected
// under Connections, otherwise return demo data.
const INTEGRATION_OPTIONS: { id: string; name: string; toolType: string; hint: string }[] = [
  { id: 'razorpay', name: 'Razorpay', toolType: 'connector', hint: 'Payment lookups & refunds. Connect it under Connections to run live.' },
  { id: 'stripe', name: 'Stripe', toolType: 'connector', hint: 'Charge lookups & refunds. Connect it under Connections to run live.' },
  { id: 'shopify', name: 'Shopify', toolType: 'connector', hint: 'Order & fulfilment lookups. Authorize it under Connections to run live.' },
  { id: 'slack', name: 'Slack', toolType: 'connector', hint: 'Post messages to a channel. Authorize it under Connections.' },
  { id: 'email', name: 'Email', toolType: 'connector', hint: 'Send transactional email via the platform provider.' },
  { id: 'perplexity', name: 'Perplexity', toolType: 'connector', hint: 'Live web search & cited answers. Connect your Perplexity key under Connections.' },
  { id: 'knowledge_base', name: 'Knowledge Base', toolType: 'knowledge', hint: 'Answers from your uploaded Knowledge docs.' },
  { id: 'http', name: 'HTTP Action', toolType: 'http', hint: 'Call any allowlisted HTTPS endpoint (set the URL below).' },
];

const PALETTE: { type: TeamNode['type']; label: string }[] = [
  { type: 'channel', label: 'Channel' },
  { type: 'conductor', label: 'Conductor' },
  { type: 'specialist', label: 'Specialist' },
  { type: 'integration', label: 'Integration' },
  { type: 'handoff', label: 'Handoff' },
];
function defaultData(type: TeamNode['type']): Data {
  switch (type) {
    case 'conductor': return { label: 'Conductor', role: 'Understands and routes every message' };
    case 'specialist': return { label: 'Specialist', role: '', prompt: 'You are a helpful specialist. Answer clearly and concisely.', model_class: 'balanced' };
    case 'integration': return { integration: 'Shopify' };
    case 'handoff': return { label: 'Human handoff' };
    default: return { channel: 'website', label: 'Website widget' };
  }
}

const INPUT = 'w-full rounded-lg border border-white/10 bg-[#161b22] px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent placeholder:text-slate-500';

export function TeamEditor({ initialGraph, onSave, saving, height = 560, agents = [], models = [] }: {
  initialGraph: TeamGraph; onSave: (g: TeamGraph) => void; saving?: boolean; height?: number;
  agents?: { id: number; name: string; role?: string }[];
  models?: ModelOption[];
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState((initialGraph.nodes ?? []) as unknown as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState((initialGraph.edges ?? []) as unknown as Edge[]);
  const [selId, setSelId] = useState<string | null>(null);
  const [selEdgeId, setSelEdgeId] = useState<string | null>(null);

  // ── Undo / redo history (snapshots of the graph before each edit) ────────────
  type Snap = { nodes: Node[]; edges: Edge[] };
  const [past, setPast] = useState<Snap[]>([]);
  const [future, setFuture] = useState<Snap[]>([]);
  const cloneNodes = (ns: Node[]) => ns.map((n) => ({ ...n, position: { ...n.position }, data: { ...(n.data as object) } }));
  const cloneEdges = (es: Edge[]) => es.map((e) => ({ ...e }));
  const lastPatchAt = useRef(0);
  // Push the current graph onto the undo stack (clears redo). Coalesce rapid
  // config-typing snapshots so a burst of keystrokes is one undo step.
  const takeSnapshot = (coalesce = false) => {
    if (coalesce) { const now = Date.now(); if (now - lastPatchAt.current < 600) { lastPatchAt.current = now; return; } lastPatchAt.current = now; }
    setPast((p) => [...p, { nodes: cloneNodes(nodes), edges: cloneEdges(edges) }].slice(-50));
    setFuture([]);
  };
  const undo = () => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setFuture((f) => [{ nodes: cloneNodes(nodes), edges: cloneEdges(edges) }, ...f]);
    setPast((p) => p.slice(0, -1));
    setNodes(prev.nodes); setEdges(prev.edges);
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setPast((p) => [...p, { nodes: cloneNodes(nodes), edges: cloneEdges(edges) }]);
    setFuture((f) => f.slice(1));
    setNodes(next.nodes); setEdges(next.edges);
  };

  const onConnect = useCallback((c: Connection) => { takeSnapshot(); setEdges((eds) => addEdge({ ...c }, eds)); }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = useMemo(() => nodes.find((n) => n.id === selId) ?? null, [nodes, selId]);

  const addNode = (type: TeamNode['type']) => {
    takeSnapshot();
    const id = `${type}-${Date.now().toString(36)}`;
    setNodes((ns) => [...ns, { id, type, position: { x: 160 + Math.random() * 220, y: 120 + Math.random() * 180 }, data: defaultData(type) } as Node]);
    setSelId(id);
  };
  const patch = (p: Data) => { takeSnapshot(true); setNodes((ns) => ns.map((n) => (n.id === selId ? { ...n, data: { ...n.data, ...p } } : n))); };
  const deleteSel = () => {
    if (!selId) return;
    takeSnapshot();
    setNodes((ns) => ns.filter((n) => n.id !== selId));
    setEdges((es) => es.filter((e) => e.source !== selId && e.target !== selId));
    setSelId(null);
  };
  const deleteEdge = (id: string) => {
    takeSnapshot();
    setEdges((es) => es.filter((e) => e.id !== id));
    setSelEdgeId(null);
  };

  function save() {
    const graph: TeamGraph = {
      nodes: nodes.map((n) => ({ id: n.id, type: n.type as TeamNode['type'], position: n.position, data: n.data as TeamNode['data'] })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: typeof e.label === 'string' ? e.label : undefined })),
    };
    onSave(graph);
  }

  const d = (sel?.data ?? {}) as Data;
  const selType = sel?.type as TeamNode['type'] | undefined;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    const meta = e.metaKey || e.ctrlKey;
    if (meta && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) {
      if (typing) return;
      e.preventDefault();
      if (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z'))) redo(); else undo();
      return;
    }
    // Delete/Backspace removes the selected connection (or node).
    if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
      if (selEdgeId) { e.preventDefault(); deleteEdge(selEdgeId); }
      else if (selId) { e.preventDefault(); deleteSel(); }
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117]" onKeyDown={onKeyDown} tabIndex={0}>
      <style>{`
        .rf-dark .react-flow__controls{box-shadow:none;border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:hidden}
        .rf-dark .react-flow__controls-button{background:#161b22;border-bottom:1px solid rgba(255,255,255,.06);color:#cbd5e1;width:26px;height:26px}
        .rf-dark .react-flow__controls-button:hover{background:#1f2630}
        .rf-dark .react-flow__controls-button svg{fill:currentColor}
        .rf-dark .react-flow__edge-path{stroke:#8892a6;stroke-width:1.5}
        .rf-dark .react-flow__edge.selected .react-flow__edge-path{stroke:var(--tw-accent,#6366f1)}
        .rf-dark .react-flow__handle{transition:transform .1s}
        .rf-dark .react-flow__handle:hover{transform:scale(1.25)}
      `}</style>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Team canvas — drag to arrange</span>
        <span className="text-[12px] font-medium text-slate-500">Add:</span>
        {PALETTE.map((p) => (
          <button key={p.type} onClick={() => addNode(p.type)} className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[12px] font-medium text-slate-300 hover:bg-white/5">
            <Plus size={12} /> {p.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-white/10">
            <button onClick={undo} disabled={!past.length} title="Undo (⌘Z)" className="rounded-l-lg px-2 py-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-30"><Undo2 size={14} /></button>
            <span className="h-4 w-px bg-white/10" />
            <button onClick={redo} disabled={!future.length} title="Redo (⌘⇧Z)" className="rounded-r-lg px-2 py-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-30"><Redo2 size={14} /></button>
          </div>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </button>
        </div>
      </div>

      <div className="flex" style={{ height }}>
        {/* Canvas */}
        <div className="rf-dark min-w-0 flex-1 bg-[#0d1117]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStart={() => takeSnapshot()}
            onNodeClick={(_, n) => { setSelId(n.id); setSelEdgeId(null); }}
            onEdgeClick={(_, e) => { setSelEdgeId(e.id); setSelId(null); }}
            onPaneClick={() => { setSelId(null); setSelEdgeId(null); }}
            nodeTypes={nodeTypes}
            fitView
            edgesFocusable
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: 'default', markerEnd: { type: MarkerType.ArrowClosed, color: '#8892a6', width: 18, height: 18 }, style: { stroke: '#8892a6', strokeWidth: 1.5 } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#2b3140" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable maskColor="rgba(0,0,0,0.5)" nodeColor="#334155" style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }} />
          </ReactFlow>
        </div>

        {/* Connection (edge) panel */}
        {!sel && selEdgeId && (() => {
          const e = edges.find((x) => x.id === selEdgeId);
          const nodeLabel = (id?: string) => { const n = nodes.find((x) => x.id === id); return (n && str((n.data as Data).label)) || (n && str((n.data as Data).integration)) || id || '?'; };
          return (
            <div className="w-72 shrink-0 space-y-3 border-l border-white/10 bg-[#0d1117] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Connection</span>
                <button onClick={() => deleteEdge(selEdgeId)} className="rounded-md p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-400" title="Delete connection"><Trash2 size={14} /></button>
              </div>
              <p className="text-[13px] text-slate-200">{nodeLabel(e?.source)} <span className="text-slate-500">→</span> {nodeLabel(e?.target)}</p>
              <button onClick={() => deleteEdge(selEdgeId)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[12px] font-medium text-slate-300 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={13} /> Delete connection</button>
              <p className="text-[11px] text-slate-500">Or select the arrow and press Delete.</p>
            </div>
          );
        })()}

        {/* Config panel */}
        {sel && (
          <div className="w-72 shrink-0 space-y-3 overflow-y-auto border-l border-white/10 bg-[#0d1117] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{selType}</span>
              <button onClick={deleteSel} className="rounded-md p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-400" title="Delete node"><Trash2 size={14} /></button>
            </div>

            {selType === 'channel' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Channel</label>
                <select
                  value={str(d.channel) || ''}
                  onChange={(e) => {
                    const c = CHANNEL_OPTIONS.find((o) => o.id === e.target.value);
                    patch({ channel: e.target.value, label: c?.label ?? 'Channel' });
                  }}
                  className={INPUT}
                >
                  <option value="" disabled>Select a channel…</option>
                  {CHANNEL_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                {(() => { const c = CHANNEL_OPTIONS.find((o) => o.id === str(d.channel)); return c ? <p className="mt-1 text-[11px] text-slate-400">{c.hint}</p> : null; })()}
              </div>
            )}
            {selType !== 'integration' && selType !== 'channel' && (
              <div><label className="mb-1 block text-xs font-medium text-slate-400">Name</label>
                <input value={str(d.label)} onChange={(e) => patch({ label: e.target.value })} className={INPUT} /></div>
            )}
            {(selType === 'conductor' || selType === 'specialist') && (
              <div><label className="mb-1 block text-xs font-medium text-slate-400">Role</label>
                <input value={str(d.role)} onChange={(e) => patch({ role: e.target.value })} className={INPUT} placeholder="What this agent does" /></div>
            )}
            {selType === 'specialist' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Agent source</label>
                  <select
                    value={d.agentDefId ? String(d.agentDefId) : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) { patch({ agentDefId: undefined }); return; }
                      const a = agents.find((x) => String(x.id) === v);
                      patch({ agentDefId: Number(v), label: a?.name ?? str(d.label), role: a?.role ?? '' });
                    }}
                    className={INPUT}
                  >
                    <option value="">Custom prompt (inline)</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                {d.agentDefId ? (
                  <p className="rounded-lg bg-accent-weak/50 px-3 py-2 text-[11px] text-slate-300">
                    Runs your built agent. Edit its prompt &amp; model in <span className="font-semibold">Agent Builder</span> — changes apply here automatically.
                  </p>
                ) : (
                  <>
                    <div><label className="mb-1 block text-xs font-medium text-slate-400">Model</label>
                      <select value={str(d.model) || 'auto'} onChange={(e) => patch({ model: e.target.value === 'auto' ? undefined : e.target.value })} className={INPUT}>
                        {models.map((m) => <option key={m.id} value={m.id}>{m.label}{m.billed ? ' · credits' : ''}</option>)}
                      </select></div>
                    <div><label className="mb-1 block text-xs font-medium text-slate-400">System prompt</label>
                      <textarea value={str(d.prompt)} onChange={(e) => patch({ prompt: e.target.value })} rows={6} className={`${INPUT} font-mono text-[12px]`} placeholder="You are a helpful specialist that…" /></div>
                  </>
                )}
              </>
            )}
            {selType === 'integration' && (() => {
              const curId = str(d.connectorId)
                || INTEGRATION_OPTIONS.find((o) => o.name.toLowerCase() === str(d.integration).toLowerCase())?.id
                || (str(d.toolType) === 'knowledge' ? 'knowledge_base' : str(d.toolType) === 'http' ? 'http' : '');
              const cur = INTEGRATION_OPTIONS.find((o) => o.id === curId);
              return (
              <>
                <div><label className="mb-1 block text-xs font-medium text-slate-400">Integration</label>
                  <select
                    value={curId}
                    onChange={(e) => {
                      const o = INTEGRATION_OPTIONS.find((x) => x.id === e.target.value);
                      if (o) patch({ integration: o.name, connectorId: o.id, toolType: o.toolType });
                    }}
                    className={INPUT}
                  >
                    <option value="" disabled>Select an integration…</option>
                    {INTEGRATION_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  {cur && <p className="mt-1 text-[11px] text-slate-400">{cur.hint}</p>}
                </div>
                {str(d.toolType) === 'http' && (
                  <>
                    <div><label className="mb-1 block text-xs font-medium text-slate-400">Endpoint URL (https)</label>
                      <input value={str(d.url)} onChange={(e) => patch({ url: e.target.value })} className={INPUT} placeholder="https://api.example.com/orders" /></div>
                    <div><label className="mb-1 block text-xs font-medium text-slate-400">Method</label>
                      <select value={str(d.method) || 'GET'} onChange={(e) => patch({ method: e.target.value })} className={INPUT}><option>GET</option><option>POST</option></select></div>
                  </>
                )}
                <p className="text-[11px] text-slate-400">Wire this to a specialist (drag an edge) so that specialist can call it.</p>
              </>
              );
            })()}
            <p className="pt-1 text-[11px] text-slate-400">Drag nodes to arrange. Drag from a node&apos;s right dot to another&apos;s left dot to connect. Select + Delete to remove.</p>
          </div>
        )}
      </div>
    </div>
  );
}
