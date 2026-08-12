'use client';

import { ReactFlow, Background, BackgroundVariant, Controls, Handle, Position, MarkerType, type Node, type Edge, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, Radio, Plug, UserRound, GitBranch } from 'lucide-react';
import type { TeamGraph } from '@rach/ui/lib/api';

/**
 * Read-only React-Flow render of an agent team's graph (canvas M1b).
 * Node data → styled card; edges are the routing/handoff/tool wires.
 */

type Data = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

const HANDLE = '!h-2 !w-2 !rounded-full !border-2 !border-[#0d1117] !bg-slate-400';

function Card({ icon, tint, title, subtitle, badge }: { icon: React.ReactNode; tint: string; title: string; subtitle?: string; badge: string }) {
  return (
    <div className="w-[204px] rounded-xl border border-white/10 bg-[#161b22] px-3 py-2.5 shadow-md">
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

function ChannelNode({ data }: NodeProps) { const d = data as Data; return <Card badge="Channel" tint="bg-slate-500/20" icon={<Radio size={15} className="text-slate-300" />} title={str(d.label) || 'Channel'} subtitle={str(d.channel) || 'channel'} />; }
function ConductorNode({ data }: NodeProps) { const d = data as Data; return <Card badge="Router" tint="bg-blue-500/20" icon={<Bot size={15} className="text-blue-300" />} title={str(d.label) || 'Conductor'} subtitle={str(d.role) || 'routes messages'} />; }
function SpecialistNode({ data }: NodeProps) { const d = data as Data; return <Card badge="Agent" tint="bg-violet-500/20" icon={<Bot size={15} className="text-violet-300" />} title={str(d.label) || 'Specialist'} subtitle={str(d.role) || str(d.prompt).slice(0, 60)} />; }
function IntegrationNode({ data }: NodeProps) { const d = data as Data; return <Card badge="Tool" tint="bg-emerald-500/20" icon={<Plug size={15} className="text-emerald-300" />} title={str(d.integration) || str(d.label) || 'Integration'} subtitle={str(d.toolType) || 'integration'} />; }
function HandoffNode({ data }: NodeProps) { const d = data as Data; return <Card badge="Human" tint="bg-amber-500/20" icon={<UserRound size={15} className="text-amber-300" />} title={str(d.label) || 'Human handoff'} subtitle="escalate to a person" />; }

const nodeTypes = { channel: ChannelNode, conductor: ConductorNode, specialist: SpecialistNode, integration: IntegrationNode, handoff: HandoffNode };

export function TeamCanvas({ graph, height = 540 }: { graph: TeamGraph; height?: number }) {
  const nodes = (graph.nodes ?? []) as unknown as Node[];
  const edges = (graph.edges ?? []) as unknown as Edge[];

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-[#0d1117] text-sm text-slate-400" style={{ height }}>
        <span className="flex items-center gap-2"><GitBranch size={16} /> Empty canvas — add nodes to build your team.</span>
      </div>
    );
  }

  return (
    <div className="rf-dark overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117]" style={{ height }}>
      <style>{`
        .rf-dark .react-flow__controls{box-shadow:none;border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:hidden}
        .rf-dark .react-flow__controls-button{background:#161b22;border-bottom:1px solid rgba(255,255,255,.06);color:#cbd5e1;width:26px;height:26px}
        .rf-dark .react-flow__controls-button:hover{background:#1f2630}
        .rf-dark .react-flow__controls-button svg{fill:currentColor}
        .rf-dark .react-flow__edge-path{stroke:#8892a6;stroke-width:1.5}
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'default', markerEnd: { type: MarkerType.ArrowClosed, color: '#8892a6', width: 18, height: 18 }, style: { stroke: '#8892a6', strokeWidth: 1.5 } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#2b3140" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
