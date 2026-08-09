'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, RefreshCw, Rocket, UploadCloud, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import {
  agentBuilder,
  type AgentSpec,
  type AgentDeployment,
  type ModelClass,
} from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-surface-hover text-dash-muted',
  published: 'bg-accent-weak text-accent',
  deployed: 'bg-ok-bg text-ok',
  disabled: 'bg-red-50 text-red-600',
  pending: 'bg-amber-50 text-amber-600',
  running: 'bg-ok-bg text-ok',
  stopped: 'bg-surface-hover text-dash-muted',
  failed: 'bg-red-50 text-red-600',
};

function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[value] ?? 'bg-surface-hover text-dash-muted'}`}>
      {value}
    </span>
  );
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);

export default function AgentBuilderPage() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<AgentSpec[]>([]);
  const [deployments, setDeployments] = useState<AgentDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  // New-agent form
  const [name, setName] = useState('');
  const [modelClass, setModelClass] = useState<ModelClass>('balanced');
  const [target, setTarget] = useState<'rachbase' | 'onprem'>('rachbase');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [d, dep] = await Promise.all([agentBuilder.list(token), agentBuilder.deployments(token)]);
      setAgents(d.definitions);
      setDeployments(dep.deployments);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!token || !name.trim()) return;
    setCreating(true);
    try {
      await agentBuilder.create(
        {
          key: slugify(name), name: name.trim(), industry: 'healthcare',
          model_policy: { class: modelClass }, runtime_target: { type: target },
        },
        token,
      );
      toast.success('Draft agent created');
      setName('');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function publish(a: AgentSpec) {
    if (!token) return;
    setBusy(a.id);
    try {
      const r = await agentBuilder.publish(a.id, token);
      toast.success(`Published ${a.name} v${r.version}`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function deploy(a: AgentSpec) {
    if (!token) return;
    setBusy(a.id);
    try {
      const r = await agentBuilder.deploy(a.id, token);
      toast.success(`Deploy ${a.name}: ${r.deployment.status}`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Agent Builder"
        subtitle="Build a draft → publish an immutable version → deploy it"
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

      {/* Create */}
      <div className="mt-6 rounded-2xl border border-neutral-border bg-surface-card p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-dash-muted">New agent name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Reception Assistant"
              className="w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-dash-muted">Model class</label>
            <select
              value={modelClass}
              onChange={(e) => setModelClass(e.target.value as ModelClass)}
              className="rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading outline-none focus:border-accent"
            >
              <option value="fast">fast</option>
              <option value="balanced">balanced</option>
              <option value="reasoning">reasoning</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-dash-muted">Runtime</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as 'rachbase' | 'onprem')}
              className="rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading outline-none focus:border-accent"
            >
              <option value="rachbase">rachbase</option>
              <option value="onprem">onprem</option>
            </select>
          </div>
          <button
            onClick={create}
            disabled={creating || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={15} /> Create draft
          </button>
        </div>
        {name && <p className="mt-2 text-xs text-dash-muted">key: <code>{slugify(name)}</code></p>}
      </div>

      {/* Agents */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <div className="border-b border-neutral-border px-5 py-3 text-sm font-semibold text-dash-heading">
          <Bot size={15} className="mr-2 inline" /> Your agents
        </div>
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-dash-muted">Loading…</p>
        ) : agents.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-dash-muted">No agents yet — create your first draft above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-border text-left text-xs text-dash-muted">
                <th className="px-5 py-2 font-medium">Agent</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Model</th>
                <th className="px-3 py-2 font-medium">Runtime</th>
                <th className="px-5 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-b border-neutral-border last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-dash-heading">{a.name}</div>
                    <div className="text-xs text-dash-muted">{a.key}{a.industry ? ` · ${a.industry}` : ''}</div>
                  </td>
                  <td className="px-3 py-3"><Badge value={a.status} /></td>
                  <td className="px-3 py-3 text-dash-body">v{a.version}</td>
                  <td className="px-3 py-3 text-dash-body">{a.model_policy?.class}</td>
                  <td className="px-3 py-3 text-dash-body">{a.runtime_target?.type}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => publish(a)}
                        disabled={busy === a.id}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-medium text-dash-body hover:bg-surface-hover disabled:opacity-50"
                      >
                        <UploadCloud size={13} /> Publish
                      </button>
                      <button
                        onClick={() => deploy(a)}
                        disabled={busy === a.id || a.status === 'draft'}
                        title={a.status === 'draft' ? 'Publish before deploying' : 'Deploy the published version'}
                        className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                      >
                        <Rocket size={13} /> Deploy
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Deployments */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <div className="border-b border-neutral-border px-5 py-3 text-sm font-semibold text-dash-heading">
          <Rocket size={15} className="mr-2 inline" /> Deployments
        </div>
        {deployments.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-dash-muted">Nothing deployed yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-border">
            {deployments.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <span className="font-medium text-dash-heading">{d.agent_key}</span>
                  <span className="ml-2 text-xs text-dash-muted">v{d.version} · {d.runtime_target?.type}</span>
                  {d.last_error && <span className="ml-2 text-xs text-red-600">{d.last_error}</span>}
                </div>
                <Badge value={d.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
