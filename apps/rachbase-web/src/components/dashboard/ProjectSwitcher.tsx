'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronsUpDown, Plus, Check, Loader2, FolderGit2 } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { projects as projectsApi, type Project } from '@rach/ui/lib/api';

/**
 * Railway-style project switcher for the dashboard top bar. Lists the tenant's
 * projects, shows the active one (from the route), switches on select, and creates
 * a new project inline.
 */
export default function ProjectSwitcher() {
  const { token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const activeId = useMemo(() => {
    const m = pathname?.match(/\/dashboard\/projects\/(\d+)/);
    return m ? Number(m[1]) : null;
  }, [pathname]);
  const active = items.find((p) => p.id === activeId) || null;

  useEffect(() => {
    if (!token) return;
    projectsApi.list(token)
      .then((r) => setItems(r.projects))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function create() {
    if (!token || !name.trim()) return;
    setBusy(true);
    try {
      const { project } = await projectsApi.create(token, name.trim());
      setItems((p) => [project, ...p]);
      setCreating(false); setName(''); setOpen(false);
      router.push(`/dashboard/projects/${project.id}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-neutral-border bg-bg-secondary px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-secondary/70"
      >
        <FolderGit2 size={15} className="text-text-muted" />
        <span className="max-w-[160px] truncate">{active ? active.name : 'Projects'}</span>
        <ChevronsUpDown size={14} className="text-text-muted" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setCreating(false); }} />
          <div className="absolute left-0 z-50 mt-1 w-64 rounded-xl border border-neutral-border bg-surface-card p-1 shadow-xl">
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-text-muted" /></div>
            ) : items.length === 0 ? (
              <p className="px-3 py-2 text-xs text-text-muted">No projects yet.</p>
            ) : (
              items.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setOpen(false); router.push(`/dashboard/projects/${p.id}`); }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary"
                >
                  <span className="truncate">{p.name}</span>
                  {p.id === activeId && <Check size={14} className="text-primary-blue" />}
                </button>
              ))
            )}

            <div className="my-1 border-t border-neutral-border" />

            {creating ? (
              <div className="flex items-center gap-1.5 p-1">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
                  placeholder="Project name"
                  className="flex-1 rounded-lg border border-neutral-border px-2 py-1.5 text-sm outline-none focus:border-primary-blue"
                />
                <button
                  onClick={create}
                  disabled={busy || !name.trim()}
                  className="rounded-lg bg-ink-solid px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : 'Add'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary-blue hover:bg-bg-secondary"
              >
                <Plus size={14} /> New Project
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
