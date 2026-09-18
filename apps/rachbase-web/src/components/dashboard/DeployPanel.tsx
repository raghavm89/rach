'use client';

import { useEffect, useRef, useState } from 'react';
import { Rocket, Loader2, CheckCircle2, XCircle, Clock, GitCommit, RotateCcw, GitBranch, Trash2 } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { site, projects as projApi, type SiteOperation, type Deployment } from '@rach/ui/lib/api';

/**
 * Deploy a container by IN-HOUSE build from the service's GitHub repo. We pin the branch to
 * an exact commit, hand SpaceArk the source→image build, poll the operation, and keep a
 * redeployable history. (Bring-your-own-image is intentionally hidden for now — the backend
 * still supports it; the UI offers only the GitHub-repo build path.)
 */

const STATE_UI: Record<string, { label: string; cls: string; spin?: boolean; icon: typeof Rocket }> = {
  ACCEPTED:    { label: 'Queued',     cls: 'text-amber-600',   icon: Clock },
  RECONCILING: { label: 'Deploying…', cls: 'text-blue-600',    icon: Loader2, spin: true },
  SUCCEEDED:   { label: 'Online',     cls: 'text-emerald-600', icon: CheckCircle2 },
  FAILED:      { label: 'Failed',     cls: 'text-red-600',     icon: XCircle },
  BLOCKED:     { label: 'Blocked',    cls: 'text-red-600',     icon: XCircle },
  CANCELLED:   { label: 'Cancelled',  cls: 'text-neutral-500', icon: XCircle },
};
const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED']);

export default function DeployPanel({
  tenantId, projectId, appId, serviceId, repoFullName, branch, deployments = [], placed = true, onDeployed,
}: {
  tenantId: number;
  projectId: number;
  appId: string;
  serviceId: number;
  repoFullName?: string | null;
  branch?: string | null;
  deployments?: Deployment[];
  placed?: boolean;
  onDeployed?: () => void;
}) {
  const { token, user } = useAuth();
  const canDeploy = user?.plan === 'pro' || user?.plan === 'starter';
  const hasRepo = Boolean(repoFullName);
  const [busy, setBusy] = useState<null | 'latest' | string>(null); // 'latest' | commit sha being redeployed
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [op, setOp] = useState<SiteOperation | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [deployedImage, setDeployedImage] = useState<string | null>(null); // set in direct-image (test) mode
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function poll(operationId: string) {
    if (timer.current) clearInterval(timer.current);
    let ticks = 0;
    timer.current = setInterval(async () => {
      if (!token) return;
      ticks += 1;
      try {
        const o = await site.getOperation(token, operationId);
        setOp(o);
        if (TERMINAL.has(o.state) && timer.current) {
          clearInterval(timer.current); timer.current = null;
          onDeployed?.(); // op settled → refresh the parent so the service status/URL updates
        }
      } catch { /* keep polling */ }
      // Stop polling after ~40s: while the platform build service isn't live, the op stays
      // queued and there's nothing more to observe — leave it as Queued.
      if (ticks >= 20 && timer.current) { clearInterval(timer.current); timer.current = null; }
    }, 2000);
  }

  async function deploy(commitSha?: string) {
    if (!token) return;
    setBusy(commitSha || 'latest'); setErr(''); setNotice(''); setOp(null); setPinned(null);
    try {
      if (!placed) await site.reconcileTenant(token, tenantId); // place the tenant only if not yet placed
      const out = await site.deployRepo(token, tenantId, appId, { service_id: serviceId, ...(commitSha ? { commit_sha: commitSha } : {}) });
      setPinned(out.commit_sha ?? null);
      setDeployedImage(out.image ?? null);
      setOp({ operationId: out.operationId, state: 'ACCEPTED', resource: { type: 'app', id: appId }, observedGeneration: 1, reason: null, message: null, updatedAt: null });
      const ref = out.commit_sha ? `commit ${out.commit_sha.slice(0, 7)}` : out.image ? `image ${out.image}` : 'deploy';
      const tail = out.image ? '' : ' — it will build once the platform build service is connected.';
      setNotice(`${commitSha ? 'Re-queued' : 'Queued'} ${ref} at ${new Date().toLocaleTimeString()}${tail}`);
      poll(out.operationId);
      onDeployed?.();
    } catch (e) {
      setErr((e as Error).message || 'Deploy failed');
    } finally { setBusy(null); }
  }

  const [deleting, setDeleting] = useState<number | null>(null);
  async function del(id: number) {
    if (!token) return;
    setDeleting(id); setErr('');
    try { await projApi.deleteDeployment(token, projectId, serviceId, id); onDeployed?.(); }
    catch (e) { setErr((e as Error).message || 'Could not delete'); }
    finally { setDeleting(null); }
  }

  const ui = op ? (STATE_UI[op.state] || STATE_UI.RECONCILING) : null;
  const Icon = ui?.icon;
  const short = (s?: string | null) => (s ? s.slice(0, 7) : '');
  // Block only while a request is in flight OR the op is actively deploying. A merely
  // Queued op does NOT lock the buttons (otherwise, with the build service not live, they'd
  // stay disabled forever) — you can re-trigger a deploy from a queued state.
  const inFlight = busy !== null || op?.state === 'RECONCILING';

  // One entry per commit in the history (dedupe; the list is newest-first).
  const seen = new Set<string>();
  const recent = deployments.filter((d) => {
    const key = d.commit_sha || `id-${d.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);

  return (
    <div className="rounded-xl border border-neutral-border bg-surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-bg-secondary text-text-muted"><GitBranch size={16} /></div>
        <div>
          <p className="text-sm font-semibold text-text-primary">Deploy from GitHub</p>
          <p className="text-xs text-text-muted">
            {hasRepo ? <>Built in-house from <span className="font-mono">{repoFullName}</span>@<span className="font-mono">{branch || 'main'}</span></> : 'No GitHub repository connected to this service.'}
          </p>
        </div>
      </div>

      {!canDeploy ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
          <span>Deploying containers requires a plan. Choose Starter ($15/mo, 1 container) or Pro ($30/mo, 3 containers) to deploy here.</span>
          <a href="/dashboard/billing" className="inline-flex items-center gap-1 rounded-full bg-primary-blue px-3 py-1 font-semibold text-white hover:bg-blue-700">
            Choose a plan →
          </a>
        </div>
      ) : !hasRepo ? (
        <p className="rounded-lg border border-neutral-border bg-bg-secondary px-3 py-2.5 text-xs text-text-muted">
          This service has no GitHub repository to build from.
        </p>
      ) : (
        <>
          <button
            onClick={() => deploy()}
            disabled={inFlight}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ink-solid px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === 'latest' ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
            {op && !TERMINAL.has(op.state) ? 'Deploying…' : 'Deploy latest'}
          </button>

          {pinned && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
              <GitCommit size={12} /> Pinned commit <span className="font-mono text-text-secondary">{short(pinned)}</span>
            </p>
          )}

          {/* Redeployable history — roll back to any prior commit */}
          {deployments.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-text-muted">Recent deploys</p>
              <ul className="divide-y divide-neutral-border rounded-lg border border-neutral-border">
                {recent.map((d) => (
                  <li key={d.id} className="px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                    <GitCommit size={12} className="shrink-0 text-text-muted" />
                    <span className="max-w-[45%] truncate font-mono text-text-primary" title={d.image_tag || d.commit_sha || ''}>
                      {d.commit_sha ? short(d.commit_sha) : (d.image_tag || '—')}
                    </span>
                    <span className="text-text-muted">{new Date(d.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="ml-auto text-text-muted">{d.status}</span>
                    {d.commit_sha && (
                      <button
                        onClick={() => deploy(d.commit_sha!)}
                        disabled={inFlight}
                        className="inline-flex items-center gap-1 rounded-full border border-neutral-border px-2 py-0.5 font-medium text-text-secondary hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {busy === d.commit_sha ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} Redeploy
                      </button>
                    )}
                    <button
                      onClick={() => del(d.id)}
                      disabled={deleting === d.id}
                      aria-label="Delete this deploy"
                      className={cn('rounded-full p-1 text-text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50', !d.commit_sha && 'ml-auto')}
                    >
                      {deleting === d.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    </button>
                    </div>
                    {d.status === 'failed' && d.error_reason && (
                      <p className="mt-1 rounded bg-red-50 px-2 py-1 font-mono text-[11px] leading-snug text-red-600 break-all" title={d.error_reason}>{d.error_reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {err && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      {notice && !err && <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">{notice}</p>}

      {op && ui && Icon && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-neutral-border bg-bg-secondary px-3 py-2 text-sm">
          <Icon size={15} className={cn(ui.cls, ui.spin && 'animate-spin')} />
          <span className={cn('font-medium', ui.cls)}>{ui.label}</span>
          <span className="text-xs text-text-muted">op {op.operationId.slice(0, 10)}…</span>
          {op.state === 'ACCEPTED'
            ? <span className="ml-auto text-xs text-text-muted">{deployedImage ? 'starting the container' : 'waiting for the build service to start'}</span>
            : op.reason && <span className="ml-auto text-xs text-text-muted">{op.reason}</span>}
        </div>
      )}

      {op?.url && (
        <a href={op.url} target="_blank" rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary-blue hover:underline">
          {op.url.replace(/^https?:\/\//, '')}
        </a>
      )}
    </div>
  );
}
