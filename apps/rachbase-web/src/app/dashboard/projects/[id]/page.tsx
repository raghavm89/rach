'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Box, Plus, X, Loader2, GitBranch, ArrowLeft, Database } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { projects as api, type Project, type Service, type Environment } from '@rach/ui/lib/api';

const DOT_GRID: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle, var(--dot-color) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
};

const STATUS_COLOR: Record<string, string> = {
  online: 'bg-emerald-500', deploying: 'bg-amber-500', building: 'bg-amber-500',
  crashed: 'bg-red-500', stopped: 'bg-neutral-400', created: 'bg-neutral-400',
};

export default function ProjectDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const projectId = Number(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{ name: string; repo_full_name: string; source: 'github_repo' | 'postgres' }>({ name: '', repo_full_name: '', source: 'github_repo' });
  const [creating, setCreating] = useState(false);

  async function load() {
    if (!token || !projectId) return;
    setLoading(true);
    try {
      const data = await api.get(token, projectId);
      setProject(data.project);
      setServices(data.services);
      setEnvironments(data.environments);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, projectId]);

  async function handleCreate() {
    if (!token || !form.name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await api.createService(token, projectId, {
        name: form.name.trim(),
        source_type: form.source,
        repo_full_name: form.source === 'github_repo' ? (form.repo_full_name.trim() || undefined) : undefined,
      });
      setForm({ name: '', repo_full_name: '', source: 'github_repo' });
      setShowCreate(false);
      await load();
    } catch (e) {
      setError((e as Error).message); // includes the 402 quota message
    } finally {
      setCreating(false);
    }
  }

  const defaultEnv = environments.find((e) => e.is_default) || environments[0];

  return (
    <div className="max-w-5xl">
      <Link href="/dashboard/projects" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft size={15} /> Projects
      </Link>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-text-muted"><Loader2 className="animate-spin" /></div>
      ) : !project ? (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error || 'Project not found'}</p>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold font-display text-text-primary">{project.name}</h2>
              {defaultEnv && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-border px-2.5 py-1 text-xs text-text-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {defaultEnv.name}
                </span>
              )}
            </div>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus size={16} /> New Service
            </button>
          </div>

          {error && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">{error}</p>}

          {/* Canvas */}
          <div className="relative min-h-[360px] overflow-hidden rounded-2xl border border-neutral-border bg-bg-secondary p-6" style={DOT_GRID}>
            {services.length === 0 ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-card text-text-muted shadow-sm"><Box size={24} /></div>
                <p className="mt-4 font-semibold text-text-primary">No services yet</p>
                <p className="mt-1 max-w-sm text-sm text-text-muted">Add a service — an app deployed from a GitHub repo or a managed Postgres.</p>
                <button onClick={() => setShowCreate(true)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-surface-card border border-neutral-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary">
                  <Plus size={16} /> Add a service
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {services.map((s) => (
                  <Link
                    key={s.id}
                    href={`/dashboard/projects/${project.id}/services/${s.id}`}
                    className="w-56 rounded-xl border border-neutral-border bg-surface-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-primary-blue"><Box size={18} /></div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text-primary">{s.name}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-text-muted">
                          {s.repo_full_name ? <><GitBranch size={11} /> {s.repo_full_name}</> : s.source_type}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
                      <span className={cn('h-2 w-2 rounded-full', STATUS_COLOR[s.status] || 'bg-neutral-400')} />
                      {s.status}
                      <span className="ml-auto font-mono">{Number(s.cpu) * (s.units ?? 1)} vCPU · {((s.memory_mb * (s.units ?? 1)) / 1024).toFixed(1)} GB</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* New service modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl bg-surface-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-text-primary">New Service</h3>
              <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
            </div>
            {/* Source */}
            <label className="mt-5 block text-sm font-medium text-text-primary">Source</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm({ ...form, source: 'github_repo' })}
                className={cn('flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                  form.source === 'github_repo' ? 'border-primary-blue bg-blue-50 text-text-primary' : 'border-neutral-border text-text-secondary hover:bg-bg-secondary')}>
                <GitBranch size={16} /> GitHub Repo
              </button>
              <button type="button" onClick={() => setForm({ ...form, source: 'postgres' })}
                className={cn('flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                  form.source === 'postgres' ? 'border-primary-blue bg-blue-50 text-text-primary' : 'border-neutral-border text-text-secondary hover:bg-bg-secondary')}>
                <Database size={16} /> Postgres
              </button>
            </div>

            <label className="mt-4 block text-sm font-medium text-text-primary">Service name</label>
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={form.source === 'postgres' ? 'db' : 'api'} className="mt-2 w-full rounded-lg border border-neutral-border px-3 py-2 text-sm outline-none focus:border-primary-blue" />

            {form.source === 'github_repo' && (
              <>
                <label className="mt-4 block text-sm font-medium text-text-primary">GitHub repository <span className="font-normal text-text-muted">(optional)</span></label>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-neutral-border px-3">
                  <GitBranch size={16} className="text-text-muted" />
                  <input value={form.repo_full_name} onChange={(e) => setForm({ ...form, repo_full_name: e.target.value })}
                    placeholder="acme/api" className="w-full py-2 text-sm outline-none" />
                </div>
              </>
            )}
            <p className="mt-3 text-xs text-text-muted">Runs as a Service — 0.5 vCPU · 0.5 GB · 0.5 GB at $15/mo per unit. Scale live by adding units.</p>
            <button onClick={handleCreate} disabled={creating || !form.name.trim()}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary-blue py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {creating && <Loader2 size={16} className="animate-spin" />} Create Service
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
