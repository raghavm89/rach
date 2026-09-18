'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Box, Plus, X, Loader2, GitBranch, ArrowLeft, Database, CheckCircle2, Boxes } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { projects as api, deployment, type Project, type Service, type Environment, type GithubRepo } from '@rach/ui/lib/api';
import { PRO } from '@rach/ui/lib/catalog';

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
  const [form, setForm] = useState<{ name: string; repo_full_name: string; branch: string; source: 'github_repo' | 'postgres' }>({ name: '', repo_full_name: '', branch: 'main', source: 'github_repo' });
  const [branches, setBranches] = useState<{ list: string[]; loading: boolean }>({ list: [], loading: false });

  // GitHub App connection (tenant-level, shared with VM deployment). Lets the user link
  // their account and pick a repo instead of typing owner/repo by hand.
  const [gh, setGh] = useState<{ connected: boolean; account: string | null; repos: GithubRepo[]; loading: boolean; connecting: boolean }>({
    connected: false, account: null, repos: [], loading: false, connecting: false,
  });

  async function loadGithub() {
    if (!token) return;
    setGh((g) => ({ ...g, loading: true }));
    try {
      const status = await deployment.getGithubStatus(token);
      const repos = status.connected ? (await deployment.listRepos(token)).repos : [];
      setGh((g) => ({ ...g, connected: status.connected, account: status.github_account || null, repos, loading: false }));
    } catch {
      setGh((g) => ({ ...g, loading: false }));
    }
  }
  // Fetch connection state when the modal opens on the GitHub source.
  useEffect(() => {
    if (showCreate && form.source === 'github_repo' && !gh.connected && !gh.loading) loadGithub();
    /* eslint-disable-next-line */
  }, [showCreate, form.source]);

  // Pick a repo → default to its default branch and load the branch list.
  async function selectRepo(fullName: string) {
    const repo = gh.repos.find((r) => r.full_name === fullName);
    setForm((f) => ({ ...f, repo_full_name: fullName, branch: repo?.default_branch || 'main' }));
    setBranches({ list: [], loading: Boolean(fullName) });
    if (fullName && token) {
      try {
        const { branches: list } = await deployment.listBranches(token, fullName);
        setBranches({ list, loading: false });
      } catch {
        setBranches({ list: [], loading: false });
      }
    }
  }

  async function connectGithub() {
    if (!token) return;
    setGh((g) => ({ ...g, connecting: true }));
    try {
      const { install_url } = await deployment.getInstallUrl(token);
      window.open(install_url, '_blank', 'noopener');
      // GitHub's post-install redirect may not return here, so poll reconcile.
      const poll = setInterval(async () => {
        try {
          const status = await deployment.reconcileGithub(token);
          if (status.connected) {
            clearInterval(poll);
            const repos = (await deployment.listRepos(token)).repos;
            setGh({ connected: true, account: status.github_account || null, repos, loading: false, connecting: false });
          }
        } catch { /* keep polling */ }
      }, 3000);
      setTimeout(() => { clearInterval(poll); setGh((g) => ({ ...g, connecting: false })); }, 300000);
    } catch (e) {
      setError((e as Error).message);
      setGh((g) => ({ ...g, connecting: false }));
    }
  }
  // Required inputs per source: a GitHub repo, or a container image (Postgres needs neither).
  // A GitHub-repo service requires a repo; Postgres needs no source. (A plain container
  // image is provided later at "Deploy a container", not here.)
  const canCreate = Boolean(form.name.trim()) && (form.source === 'github_repo' ? Boolean(form.repo_full_name.trim()) : true);
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
    if (!token || !canCreate) return;
    setCreating(true);
    setError(null);
    try {
      await api.createService(token, projectId, {
        name: form.name.trim(),
        source_type: form.source,
        repo_full_name: form.source === 'github_repo' ? form.repo_full_name.trim() : undefined,
        branch: form.source === 'github_repo' ? (form.branch.trim() || 'main') : undefined,
      });
      setForm({ name: '', repo_full_name: '', branch: 'main', source: 'github_repo' });
      setBranches({ list: [], loading: false });
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
                      <span className="ml-auto font-mono">{PRO.compute_sizes[(s.compute_size ?? 'nano')].specs}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link href={`/dashboard/backend/${project.id}`} className="mt-6 flex items-center gap-3 rounded-2xl border border-neutral-border bg-surface-card p-4 hover:border-primary-blue">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-primary-blue"><Boxes size={18} /></div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">Backend (BaaS)</p>
              <p className="text-xs text-text-muted">Auth, Data, Storage &amp; Functions for this project&apos;s end-users.</p>
            </div>
            <span className="ml-auto text-sm text-primary-blue">Manage →</span>
          </Link>
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
                className={cn('flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                  form.source === 'github_repo' ? 'border-primary-blue bg-blue-50 text-text-primary' : 'border-neutral-border text-text-secondary hover:bg-bg-secondary')}>
                <GitBranch size={16} /> GitHub Repo
              </button>
              <button type="button" onClick={() => setForm({ ...form, source: 'postgres' })}
                className={cn('flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                  form.source === 'postgres' ? 'border-primary-blue bg-blue-50 text-text-primary' : 'border-neutral-border text-text-secondary hover:bg-bg-secondary')}>
                <Database size={16} /> Postgres
              </button>
            </div>

            <label className="mt-4 block text-sm font-medium text-text-primary">Service name</label>
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={form.source === 'postgres' ? 'db' : 'api'} className="mt-2 w-full rounded-lg border border-neutral-border px-3 py-2 text-sm outline-none focus:border-primary-blue" />

            {form.source === 'github_repo' && (
              <>
                <label className="mt-4 block text-sm font-medium text-text-primary">GitHub repository</label>

                {gh.loading ? (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-neutral-border px-3 py-2.5 text-sm text-text-muted">
                    <Loader2 size={15} className="animate-spin" /> Checking GitHub connection…
                  </div>
                ) : !gh.connected ? (
                  <div className="mt-2 rounded-lg border border-neutral-border p-3">
                    <p className="text-xs text-text-muted">Link your GitHub account to pick a repository to deploy.</p>
                    <button type="button" onClick={connectGithub} disabled={gh.connecting}
                      className="mt-2 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                      {gh.connecting ? <Loader2 size={15} className="animate-spin" /> : <GitBranch size={15} />}
                      {gh.connecting ? 'Waiting for GitHub…' : 'Connect GitHub account'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                      <CheckCircle2 size={13} /> Connected{gh.account ? ` as @${gh.account}` : ''}
                    </div>
                    {gh.repos.length > 0 ? (
                      <select value={form.repo_full_name} onChange={(e) => selectRepo(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-neutral-border px-3 py-2 text-sm outline-none focus:border-primary-blue">
                        <option value="">Select a repository…</option>
                        {gh.repos.map((r) => (
                          <option key={r.id} value={r.full_name}>{r.full_name}{r.private ? ' (private)' : ''}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-neutral-border px-3">
                        <GitBranch size={16} className="text-text-muted" />
                        <input value={form.repo_full_name} onChange={(e) => setForm({ ...form, repo_full_name: e.target.value })}
                          placeholder="acme/api" className="w-full py-2 text-sm outline-none" />
                      </div>
                    )}

                    {form.repo_full_name && (
                      <>
                        <label className="mt-4 block text-sm font-medium text-text-primary">Branch</label>
                        {branches.loading ? (
                          <div className="mt-2 flex items-center gap-2 rounded-lg border border-neutral-border px-3 py-2.5 text-sm text-text-muted">
                            <Loader2 size={15} className="animate-spin" /> Loading branches…
                          </div>
                        ) : branches.list.length > 0 ? (
                          <select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}
                            className="mt-2 w-full rounded-lg border border-neutral-border px-3 py-2 text-sm outline-none focus:border-primary-blue">
                            {branches.list.map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                        ) : (
                          <input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}
                            placeholder="main" className="mt-2 w-full rounded-lg border border-neutral-border px-3 py-2 text-sm outline-none focus:border-primary-blue" />
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            <p className="mt-3 text-xs text-text-muted">Created as a draft — free until you bring it online. Containers within your plan&apos;s allowance are free; each additional is $10/mo.</p>
            <button onClick={handleCreate} disabled={creating || !canCreate}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary-blue py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {creating && <Loader2 size={16} className="animate-spin" />} Create Service
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
