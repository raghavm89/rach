'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Plus, Network, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { agentTeams, type AgentTeam, type TeamGraph } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-surface-hover text-dash-muted', published: 'bg-accent-weak text-accent',
  deployed: 'bg-ok-bg text-ok', disabled: 'bg-red-50 text-red-600',
};

// A starter graph so a new team's canvas isn't blank.
const SEED_GRAPH: TeamGraph = {
  nodes: [
    { id: 'channel-1',    type: 'channel',    position: { x: 0,   y: 140 }, data: { label: 'Website widget' } },
    { id: 'conductor-1',  type: 'conductor',  position: { x: 260, y: 140 }, data: { label: 'Front desk', role: 'Understands and routes every message' } },
    { id: 'specialist-1', type: 'specialist', position: { x: 560, y: 40 },  data: { label: 'Specialist', role: 'Handles a specific job', prompt: 'You are a helpful specialist. Answer clearly and concisely.', model_class: 'balanced' } },
    { id: 'handoff-1',    type: 'handoff',    position: { x: 560, y: 250 }, data: { label: 'Human handoff' } },
  ],
  edges: [
    { id: 'e1', source: 'channel-1',   target: 'conductor-1' },
    { id: 'e2', source: 'conductor-1', target: 'specialist-1' },
    { id: 'e3', source: 'conductor-1', target: 'handoff-1' },
  ],
};

export default function AgentTeamsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try { setTeams(await agentTeams.list(token)); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!token) return;
    setBusy('new');
    try {
      const team = await agentTeams.create({ name: 'Untitled team', graph: SEED_GRAPH }, token);
      router.push(`/dashboard/agent-teams/${team.id}`);
    } catch (e) { toast.error((e as Error).message); setBusy(''); }
  }

  async function remove(t: AgentTeam, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!token || !window.confirm(`Delete "${t.name}"? This can't be undone.`)) return;
    setBusy(`del-${t.id}`);
    try { await agentTeams.remove(t.id, token); toast.success('Team deleted'); await load(); }
    catch (err) { toast.error((err as Error).message); }
    finally { setBusy(''); }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Agent Teams"
        subtitle="Build a team of agents on a canvas — a conductor that routes to specialists, tools, and human handoff."
        actions={
          <div className="flex gap-2">
            <button onClick={create} disabled={!!busy} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {busy === 'new' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} New team
            </button>
            <button onClick={() => { setLoading(true); load(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        }
      />

      {loading ? (
        <p className="mt-6 text-sm text-dash-muted">Loading…</p>
      ) : teams.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-border py-16 text-center">
          <Network size={28} className="text-dash-muted" />
          <p className="mt-3 text-sm font-medium text-dash-heading">No teams yet</p>
          <p className="mt-1 text-[13px] text-dash-muted">Create a team to open the canvas.</p>
          <button onClick={create} disabled={!!busy} className="mt-4 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {busy === 'new' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} New team
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <Link key={t.id} href={`/dashboard/agent-teams/${t.id}`} className="group relative rounded-2xl border border-neutral-border bg-surface-card p-4 hover:border-accent/50">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2"><Network size={16} className="text-accent" /><span className="text-sm font-semibold text-dash-heading">{t.name}</span></div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[t.status] ?? 'bg-surface-hover text-dash-muted'}`}>{t.status}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[12px] text-dash-muted">{t.graph?.nodes?.length ?? 0} nodes · v{t.version}{t.industry ? ` · ${t.industry}` : ''}</p>
                <button onClick={(e) => remove(t, e)} disabled={!!busy} title="Delete team"
                  className="rounded-md p-1.5 text-dash-muted opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50">
                  {busy === `del-${t.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
