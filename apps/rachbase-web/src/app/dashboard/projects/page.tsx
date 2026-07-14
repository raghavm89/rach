'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box, Plus, LayoutGrid, List, FolderGit2, Loader2, X } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { projects as projectsApi, type Project } from '@rach/ui/lib/api';

const DOT_GRID: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle, var(--line, #E5E7EB) 1px, transparent 1px)',
  backgroundSize: '18px 18px',
};

export default function ProjectsPage() {
  const { token } = useAuth();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const { projects } = await projectsApi.list(token);
      setProjects(projects);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  async function handleCreate() {
    if (!token || !name.trim()) return;
    setCreating(true);
    try {
      await projectsApi.create(token, name.trim());
      setName('');
      setShowCreate(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-3xl font-bold font-display text-text-primary">Projects</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={16} /> New
        </button>
      </div>

      {/* Toolbar */}
      <div className="mb-5 flex items-center justify-between border-b border-neutral-border pb-3">
        <div className="flex items-center gap-3 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <FolderGit2 size={15} /> {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
          </span>
          <span className="text-neutral-border">|</span>
          <span>Sort By: Recent Activity</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-neutral-border p-0.5">
          <button onClick={() => setView('grid')} className={cn('rounded-md p-1.5', view === 'grid' ? 'bg-bg-secondary text-text-primary' : 'text-text-muted')}>
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setView('list')} className={cn('rounded-md p-1.5', view === 'list' ? 'bg-bg-secondary text-text-primary' : 'text-text-muted')}>
            <List size={16} />
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-text-muted"><Loader2 className="animate-spin" /></div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-border bg-white/50 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary text-text-muted"><FolderGit2 size={24} /></div>
          <p className="mt-4 font-semibold text-text-primary">No projects yet</p>
          <p className="mt-1 max-w-sm text-sm text-text-muted">Create a project to group your services — each runs your app from a GitHub repo or a managed Postgres.</p>
          <button onClick={() => setShowCreate(true)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} /> New Project
          </button>
        </div>
      ) : (
        <div className={cn('grid gap-5', view === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1')}>
          {projects.map((p) => {
            const total = p.service_count ?? 0;
            const online = p.online_count ?? 0;
            const nodes = Math.max(1, Math.min(total, 3));
            return (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="group overflow-hidden rounded-2xl border border-neutral-border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="px-5 pt-4"><p className="font-semibold text-text-primary">{p.name}</p></div>
                <div className="relative mx-3 mt-3 h-40 overflow-hidden rounded-xl border border-neutral-border bg-bg-secondary" style={DOT_GRID}>
                  <div className="absolute inset-0 flex items-center justify-center gap-3">
                    {total === 0 ? (
                      <span className="text-xs text-text-muted">No services</span>
                    ) : (
                      Array.from({ length: nodes }).map((_, i) => (
                        <div key={i} className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-border bg-white text-text-secondary shadow-sm">
                          <Box size={18} />
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 px-5 py-3 text-xs text-text-muted">
                  <span className={cn('h-2 w-2 rounded-full', total > 0 && online === total ? 'bg-emerald-500' : total === 0 ? 'bg-neutral-300' : 'bg-amber-500')} />
                  production
                  <span className="text-neutral-border">·</span>
                  {online}/{total} services online
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create project modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-text-primary">New Project</h3>
              <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
            </div>
            <label className="mt-5 block text-sm font-medium text-text-primary">Project name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="my-app"
              className="mt-2 w-full rounded-lg border border-neutral-border px-3 py-2 text-sm outline-none focus:border-primary-blue"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary-blue py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating && <Loader2 size={16} className="animate-spin" />} Create Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
