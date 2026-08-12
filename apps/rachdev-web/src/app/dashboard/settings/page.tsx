'use client';

import { useEffect, useState } from 'react';
import { Loader2, Check, AlertCircle, Rocket, Server } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { agentBuilder, type DeployTarget } from '@rach/ui/lib/api';

/**
 * Workspace settings. The industry-workspace chooser was removed — industry is an
 * enterprise/org concept set by the RachDev platform admin at org creation, not
 * self-serve. Personal workspaces just use the core agent product.
 */
export default function WorkspaceSettingsPage() {
  const { user, token } = useAuth();

  const [deployTarget, setDeployTarget] = useState<DeployTarget | null>(null);
  const [rachbaseReady, setRachbaseReady] = useState(true);
  const [savingDeploy, setSavingDeploy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const ds = await agentBuilder.deploySettings(token).catch(() => ({ target: null, rachbase_ready: true }));
        if (!cancelled) { setDeployTarget(ds.target); setRachbaseReady(ds.rachbase_ready); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const saveDeploy = async (target: DeployTarget) => {
    if (!token) return;
    setSavingDeploy(true);
    try { const r = await agentBuilder.setDeployTarget(target, token); setDeployTarget(r.target); toast.success('Default deployment target saved'); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSavingDeploy(false); }
  };

  const DEPLOY_OPTS: { value: DeployTarget; label: string; hint: string; icon: typeof Rocket }[] = [
    { value: 'rachbase', label: 'RachBase (managed)', hint: 'We host the backend — database, auth, storage, SSL, monitoring — already wired to your agents.', icon: Rocket },
    { value: 'self_hosted', label: 'Self-hosted', hint: 'Export the config and run it on infrastructure you already trust. Same agent, same guardrails.', icon: Server },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-neutral-border bg-surface-card p-8">
        <h2 className="text-xl font-semibold text-dash-heading">Deployment</h2>
        <p className="mt-1 text-sm text-dash-body">
          Where your agents run by default when you ship them
          {user?.tenant_name ? <> in <span className="font-medium">{user.tenant_name}</span></> : null}. You can still choose per-agent in the Ship it dialog.
        </p>
        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
        ) : (
          <div className="mt-6 space-y-3">
            {DEPLOY_OPTS.map((opt) => {
              const selected = deployTarget === opt.value;
              const Icon = opt.icon;
              return (
                <button key={opt.value} type="button" onClick={() => saveDeploy(opt.value)} disabled={savingDeploy}
                  className={'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60 ' + (selected ? 'border-accent bg-accent-weak' : 'border-neutral-border hover:bg-surface-hover')}>
                  <span className={'mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ' + (selected ? 'border-accent bg-accent text-white' : 'border-dash-muted')}>{selected && <Check size={11} />}</span>
                  <span className="flex-1">
                    <span className={'flex items-center gap-1.5 text-sm font-medium ' + (selected ? 'text-accent' : 'text-dash-heading')}><Icon size={14} className={selected ? 'text-accent' : 'text-dash-muted'} /> {opt.label}</span>
                    <span className={'block text-xs ' + (selected ? 'text-accent/80' : 'text-dash-muted')}>{opt.hint}</span>
                    {opt.value === 'rachbase' && !rachbaseReady && <span className="mt-1 flex items-center gap-1 text-xs text-amber-600"><AlertCircle size={12} /> Not wired on this server yet — deploys will be blocked until it&apos;s set up.</span>}
                  </span>
                </button>
              );
            })}
            {deployTarget === null && <p className="text-xs text-dash-muted">No default set — the Ship it dialog will ask each time.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
