'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Box, GitBranch, Rocket, Globe, Gauge, Activity, GitPullRequestArrow,
  Loader2, Lock, RotateCcw, Cpu, MemoryStick, HardDrive, Copy, Plus, Trash2,
  Terminal as TerminalIcon, Database, ChevronRight, ChevronDown, FileText,
} from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { projects as api, site, type Service, type Deployment } from '@rach/ui/lib/api';
import { PRO, COMPUTE_SIZES, formatCents, proContainerCents, computeDeltaCents, type ComputeSize, type BillingCurrency } from '@rach/ui/lib/catalog';
import { ResourceTabs, useResourceTab } from '@/components/dashboard/ResourceTabs';
import { Terminal } from '@/components/dashboard/Terminal';
import { DbConsole } from '@/components/dashboard/database/DbConsole';
import DeployPanel from '@/components/dashboard/DeployPanel';
import EnvPanel from '@/components/dashboard/EnvPanel';

const TABS = [
  { key: 'deploy', label: 'Deploy', icon: Rocket },
  { key: 'network', label: 'Network', icon: Globe },
  { key: 'scale', label: 'Scale', icon: Gauge },
  { key: 'monitor', label: 'Monitor', icon: Activity },
  { key: 'console', label: 'Console', icon: TerminalIcon },
  { key: 'evolve', label: 'Evolve', icon: GitPullRequestArrow },
] as const;

// Extra tab shown only for Postgres services (source_type='postgres').
const DATA_TAB = { key: 'data', label: 'Data', icon: Database } as const;

const STATUS_COLOR: Record<string, string> = {
  online: 'bg-emerald-500', deploying: 'bg-amber-500', building: 'bg-amber-500',
  crashed: 'bg-red-500', stopped: 'bg-neutral-400', created: 'bg-neutral-400',
  draft: 'bg-neutral-400', pending_payment: 'bg-amber-500',
  success: 'bg-emerald-500', queued: 'bg-amber-500', failed: 'bg-red-500',
};

export default function ServiceDetailPage() {
  const { token, user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);
  const sid = Number(params.sid);
  const siteAppId = `a-svc${String(sid).padStart(8, '0')}`;

  const [service, setService] = useState<Service | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [host, setHost] = useState('');
  const [placed, setPlaced] = useState(true); // assume placed until told otherwise (avoids a redundant reconcile)
  const [loading, setLoading] = useState(true);
  const isPg = service?.source_type === 'postgres';
  const tabs = isPg ? [DATA_TAB, ...TABS] : TABS;
  const [tab, setTab] = useResourceTab(tabs.map((t) => t.key), isPg ? 'data' : 'deploy');
  const [deploying, setDeploying] = useState(false);
  const [buying, setBuying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [size, setSize] = useState<ComputeSize>('nano');

  // Tenant billing currency for every price shown on this page. This page used to hardcode
  // "$10 / +$10 / +$20" — quoting USD to India-billed customers who are then charged
  // ₹500/₹400/₹800 + GST at checkout (go-live audit H3). Server-quoted via proQuote, same
  // source the billing page uses; USD until known.
  const [cur, setCur] = useState<BillingCurrency>('USD');
  useEffect(() => {
    if (!token) return;
    site.proQuote(token, 'starter')
      .then((q) => { if (q.currency === 'INR' || q.currency === 'USD') setCur(q.currency); })
      .catch(() => {}); // display-only: worst case we show USD, the server still charges correctly
  }, [token]);
  // Localized price fragments (delta strings are '' for nano, e.g. " (+₹400)" for micro).
  const containerFee = formatCents(proContainerCents(cur), cur);
  const deltaStr = (s: ComputeSize) => {
    const d = computeDeltaCents(s, cur);
    return d ? ` (+${formatCents(d, cur)})` : '';
  };

  const [loadErr, setLoadErr] = useState<string | null>(null);
  async function load(silent = false) {
    if (!token || !sid) return;
    if (!silent) setLoading(true);
    try {
      const data = await api.getService(token, projectId, sid);
      setService(data.service);
      setDeployments(data.deployments);
      setHost(data.host || '');
      setPlaced(data.placed !== false);
      if (data.service.compute_size) setSize(data.service.compute_size);
      setLoadErr(null);
    } catch (e) {
      // An API/network failure is NOT "Service not found" — telling a paying customer their
      // container is gone during a backend hiccup is a trust incident (go-live audit H8).
      // Keep any already-loaded service on a failed silent poll; surface a retryable error.
      if (!silent) setLoadErr((e as Error).message || 'Could not load this service.');
    } finally {
      if (!silent) setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, projectId, sid]);

  // Live-update while a deploy is in flight: poll silently until the service settles to a
  // terminal state (online/crashed/stopped), so the header + history flip without a manual
  // refresh — regardless of who triggered the deploy. Stops when settled; ~5 min safety cap.
  const transitional = service?.status === 'deploying'
    || deployments.some((d) => d.status === 'deploying' || d.status === 'queued');
  useEffect(() => {
    if (!transitional) return;
    let ticks = 0;
    const id = setInterval(() => { ticks += 1; load(true); if (ticks >= 75) clearInterval(id); }, 4000);
    return () => clearInterval(id);
    /* eslint-disable-next-line */
  }, [transitional, token, projectId, sid]);

  const [deleting, setDeleting] = useState(false);
  const [expandedDeploy, setExpandedDeploy] = useState<number | null>(null);
  async function handleDelete() {
    if (!token || !service) return;
    if (!window.confirm(`Delete "${service.name}"? This stops its billing and removes the container. This can't be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteService(token, projectId, sid);
      router.push(`/dashboard/projects/${projectId}`);
    } catch (e) {
      setPayError((e as Error).message);
      setDeleting(false);
    }
  }

  // Deploy / roll back via the in-house GitHub build (same path as the Deploy panel):
  // pin the latest commit, or a specific one for rollback. Surfaces errors (no crash).
  async function redeploy(commitSha?: string) {
    if (!token || user?.tenant_id == null) return;
    setDeploying(true);
    setPayError(null);
    try {
      if (!placed) await site.reconcileTenant(token, user.tenant_id); // place the tenant only if not yet placed
      await site.deployRepo(token, user.tenant_id, siteAppId, { service_id: sid, ...(commitSha ? { commit_sha: commitSha } : {}) });
      await load();
    } catch (e) {
      setPayError((e as Error).message || 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  }

  // Bring the container online (or resize) at the chosen compute size. The server prices
  // it: an included (free) container is applied in place here; anything with a charge is
  // sent to the shared Billing checkout page (review + GST/tax + Razorpay live there).
  async function handleBringOnline(chosen: ComputeSize) {
    if (!token || !service || user?.tenant_id == null) return;
    setBuying(true);
    setPayError(null);
    try {
      const q = await site.deployQuote(token, user.tenant_id, sid, chosen);
      if (q.free) {
        await api.checkoutContainer(token, projectId, sid, chosen); // included — no charge
        await load();
        return;
      }
      const qs = new URLSearchParams({
        pro: 'container',
        project: String(projectId),
        service: String(sid),
        size: chosen,
        name: service.name,
        amount: String(q.amount),
        currency: q.currency,
      });
      router.push(`/dashboard/billing/checkout?${qs.toString()}`);
    } catch (e) {
      setPayError((e as Error).message);
      setBuying(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-text-muted"><Loader2 className="animate-spin" /></div>;
  if (!service && loadErr) return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p className="font-medium">Couldn&apos;t load this service right now.</p>
      <p className="mt-0.5 text-xs">{loadErr}</p>
      <button onClick={() => load()} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300 px-3 py-1 text-xs font-medium hover:bg-amber-100">
        <RotateCcw size={12} /> Retry
      </button>
    </div>
  );
  if (!service) return <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">Service not found</p>;

  const domain = host || `${service.name}.rachbase.app`;

  return (
    <div className="max-w-4xl">
      <Link href={`/dashboard/projects/${projectId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft size={15} /> Back to project
      </Link>

      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary-blue"><Box size={22} /></div>
        <div>
          <h2 className="text-xl font-bold font-display text-text-primary">{service.name}</h2>
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className={cn('h-2 w-2 rounded-full', STATUS_COLOR[service.status] || 'bg-neutral-400')} />
            {service.status}
            {service.repo_full_name && <><span className="text-neutral-border">·</span><GitBranch size={11} /> {service.repo_full_name}</>}
          </p>
        </div>
        {(user?.role === 'admin' || user?.role === 'tenant_admin') && (
          <button onClick={handleDelete} disabled={deleting}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
          </button>
        )}
      </div>

      {/* Pay-to-online banner for a draft / awaiting-payment service */}
      {(service.status === 'draft' || service.status === 'pending_payment') && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">This container is not online yet</p>
            <p className="text-xs text-text-muted">
              Pick a compute size and bring it online. Containers within your plan&apos;s included allowance are free;
              each additional container is {containerFee}/mo, plus any compute upgrade. Billed monthly{cur === 'INR' ? ' (+ GST)' : ''}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select value={size} onChange={(e) => setSize(e.target.value as ComputeSize)}
              className="rounded-full border border-neutral-border bg-surface-card px-3 py-2 text-sm">
              {COMPUTE_SIZES.map((s) => (
                <option key={s} value={s}>{s} · {PRO.compute_sizes[s].specs}{deltaStr(s)}</option>
              ))}
            </select>
            <button
              onClick={() => handleBringOnline(size)} disabled={buying}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {buying ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />} Bring online
            </button>
          </div>
        </div>
      )}
      {payError && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{payError}</p>}

      {/* Tabs — shared deep-linkable resource IA (Phase 2 · WS1) */}
      <ResourceTabs tabs={tabs} active={tab} onChange={setTab} />

      {/* ── Data (Postgres) ── */}
      {tab === 'data' && (
        isPg && token
          ? <DbConsole serviceId={sid} token={token} />
          : <Panel title="Data"><p className="py-2 text-sm text-text-muted">The data viewer is available for Postgres services once provisioned.</p></Panel>
      )}

      {/* ── Deploy ── */}
      {tab === 'deploy' && (
        <div className="space-y-5">
          {user?.tenant_id != null && (user.role === 'admin' || user.role === 'tenant_admin') && (
            <DeployPanel tenantId={user.tenant_id} projectId={projectId} appId={siteAppId} serviceId={sid} repoFullName={service.repo_full_name} branch={service.branch} deployments={deployments} placed={placed} onDeployed={load} />
          )}
          <Panel title="Source">
            <Row label="Type" value={service.source_type === 'github_repo' ? 'GitHub Repository' : 'Docker Image'} />
            {service.repo_full_name && <Row label="Repository" value={service.repo_full_name} />}
            <Row label="Branch" value={service.branch} />
          </Panel>
          <Panel title="Deployment history">
            {deployments.length === 0 ? (
              <p className="py-2 text-sm text-text-muted">No deployments yet.</p>
            ) : (
              <div className="divide-y divide-neutral-border">
                {deployments.map((d) => {
                  const open = expandedDeploy === d.id;
                  return (
                  <div key={d.id} className="text-sm">
                    <button
                      onClick={() => setExpandedDeploy(open ? null : d.id)}
                      className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-bg-secondary/60"
                    >
                      {open ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                      <span className={cn('h-2 w-2 rounded-full', STATUS_COLOR[d.status] || 'bg-neutral-400')} />
                      <span className="font-mono text-text-secondary">#{d.id}</span>
                      <span className="text-text-primary">{d.status}</span>
                      {d.commit_sha && <span className="font-mono text-xs text-text-muted">{d.commit_sha.slice(0, 7)}</span>}
                      <span className="ml-auto text-xs text-text-muted">{new Date(d.created_at).toLocaleString()}</span>
                    </button>

                    {open && (
                      <div className="space-y-3 pb-3 pl-7 pr-1">
                        {/* Metadata */}
                        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
                          <dt className="text-text-muted">Artifact</dt>
                          <dd className="font-mono text-text-primary break-all">{d.image_tag || d.commit_sha || '—'}</dd>
                          <dt className="text-text-muted">Triggered by</dt>
                          <dd className="text-text-secondary">{d.triggered_by || 'manual'}</dd>
                          <dt className="text-text-muted">When</dt>
                          <dd className="text-text-secondary">{new Date(d.created_at).toLocaleString()}</dd>
                          {d.op_state && (<><dt className="text-text-muted">Operation</dt><dd className="font-mono text-text-secondary">{d.op_state}</dd></>)}
                        </dl>

                        {/* Deploy log = the site outcome / failure reason */}
                        <div>
                          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-text-secondary"><FileText size={12} /> Deploy log</p>
                          {d.status === 'failed' ? (
                            <pre className="whitespace-pre-wrap break-all rounded-lg bg-red-50 px-3 py-2 font-mono text-xs leading-snug text-red-600">
                              {d.error_reason || 'Deploy failed — no reason was reported by the site.'}
                            </pre>
                          ) : d.status === 'success' ? (
                            <pre className="whitespace-pre-wrap rounded-lg bg-emerald-50 px-3 py-2 font-mono text-xs text-emerald-700">Deploy succeeded — workload is running.</pre>
                          ) : (
                            <pre className="whitespace-pre-wrap rounded-lg bg-bg-secondary px-3 py-2 font-mono text-xs text-text-muted">Deploy in progress…</pre>
                          )}
                        </div>

                        {/* Runtime logs — pending the site logs endpoint */}
                        <div>
                          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-text-secondary"><FileText size={12} /> Runtime logs</p>
                          <pre className="whitespace-pre-wrap rounded-lg bg-bg-secondary px-3 py-2 font-mono text-xs text-text-muted">
                            Live container logs aren&apos;t available yet for this service. They&apos;ll appear here once streaming from the cluster is enabled.
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ── Network ── */}
      {tab === 'network' && (
        <div className="space-y-5">
          <Panel title="Public networking">
            <div className="flex items-center justify-between py-1">
              <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-text-primary hover:underline"><Globe size={15} className="text-text-muted" /> {domain}</a>
              <button onClick={() => navigator.clipboard?.writeText(domain)} className="text-text-muted hover:text-text-primary" aria-label="Copy domain"><Copy size={15} /></button>
            </div>
            <Row label="SSL" value="Automatic (Let's Encrypt)" />
            <Row label="Static outbound IP" value="Provisioned by your site — allowlist it with your DB / provider" muted />
            {(user?.role === 'admin' || user?.role === 'tenant_admin' || user?.role === 'developer') && (
              <CustomDomainEditor
                token={token!} projectId={projectId} sid={sid}
                current={service.custom_domain ?? ''} fallback={`${service.name}.rachbase.app`}
                onSaved={load}
              />
            )}
          </Panel>
          <Panel title="Private networking">
            <Row label="Internal hostname" value={`${service.name}.internal`} />
            {(user?.role === 'admin' || user?.role === 'tenant_admin' || user?.role === 'developer') ? (
              <PortEditor token={token!} projectId={projectId} sid={sid} current={service.port ?? null} onSaved={load} />
            ) : (
              <Row label="Port" value={String(service.port ?? 8080)} />
            )}
            <p className="pt-1 text-xs text-text-muted">The port your container listens on. Services in this project reach each other over the private network — no config.</p>
          </Panel>
        </div>
      )}

      {/* ── Scale ── */}
      {tab === 'scale' && (
        <div className="space-y-5">
          <Panel title="Compute size">
            <div className="grid grid-cols-3 gap-3">
              <Metric icon={<Cpu size={16} />} label="CPU" value={PRO.compute_sizes[(service.compute_size ?? 'nano')].cpu} />
              <Metric icon={<MemoryStick size={16} />} label="Memory" value={`${(PRO.compute_sizes[(service.compute_size ?? 'nano')].memory_mb / 1024).toFixed(1)} GB`} />
              <Metric icon={<HardDrive size={16} />} label="Disk" value={`${service.disk_gb} GB`} />
            </div>
          </Panel>
          <Panel title="Billing">
            <Row label="Current size" value={`${service.compute_size ?? 'nano'} · ${PRO.compute_sizes[(service.compute_size ?? 'nano')].specs}`} />
            <Row label="Container fee" value={`${containerFee}/mo per additional container (included ones are free within your plan)`} />
            <Row label="Compute upgrade" value={computeDeltaCents(service.compute_size ?? 'nano', cur) ? `+${formatCents(computeDeltaCents(service.compute_size ?? 'nano', cur), cur)}/mo` : 'none (nano)'} />
            <div className="mt-3 flex items-center gap-2">
              <select value={size} onChange={(e) => setSize(e.target.value as ComputeSize)}
                className="rounded-full border border-neutral-border bg-surface-card px-3 py-2 text-sm">
                {COMPUTE_SIZES.map((s) => (
                  <option key={s} value={s}>{s} · {PRO.compute_sizes[s].specs}{deltaStr(s)}</option>
                ))}
              </select>
              <button onClick={() => handleBringOnline(size)} disabled={buying || size === (service.compute_size ?? 'nano')}
                className="inline-flex items-center gap-2 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {buying ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Change size
              </button>
            </div>
            <p className="pt-2 text-xs text-text-muted">Compute size is a per-container add-on: nano (included) · micro (+{formatCents(computeDeltaCents('micro', cur), cur)}) · small (+{formatCents(computeDeltaCents('small', cur), cur)}). Replicas don&apos;t change the price.</p>
          </Panel>
        </div>
      )}

      {/* ── Monitor ── */}
      {tab === 'monitor' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Metric icon={<Cpu size={16} />} label="CPU" value="—" />
            <Metric icon={<MemoryStick size={16} />} label="Memory" value="—" />
            <Metric icon={<Activity size={16} />} label="Requests" value="—" />
          </div>
          <Panel title="Logs">
            <div className="rounded-lg bg-ink/95 p-4 font-mono text-xs text-neutral-300">
              <p className="text-text-muted">Live logs stream here once the service is running on the cluster.</p>
            </div>
          </Panel>
        </div>
      )}

      {/* ── Console ── */}
      {tab === 'console' && (
        <div className="space-y-3">
          {service.vm_id && token ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text-primary">Console</p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(`ssh root@${service.vm_id}`)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-border px-3 py-1 text-xs text-text-muted hover:text-text-primary"
                >
                  <Copy size={13} /> Copy SSH command
                </button>
              </div>
              <Terminal
                vmId={service.vm_id}
                vmName={service.name}
                token={token}
                onClose={() => setTab('deploy')}
              />
              <p className="text-xs text-text-muted">
                Live shell into the VM running this service. Sessions are scoped to your tenant.
              </p>
            </>
          ) : (
            <Panel title="Console">
              <p className="py-2 text-sm text-text-muted">
                The console is available once this service is running on a VM.
              </p>
            </Panel>
          )}
        </div>
      )}

      {/* ── Evolve ── */}
      {tab === 'evolve' && (
        <div className="space-y-5">
          <Panel title="Environments">
            <Row label="Current" value="production" />
            <p className="pt-1 text-xs text-text-muted">Preview environments spin up automatically for each pull request.</p>
          </Panel>
          <Panel title="Rollback">
            {deployments.length <= 1 ? (
              <p className="py-1 text-sm text-text-muted">Roll back to a previous deployment once you have deploy history.</p>
            ) : (
              <div className="divide-y divide-neutral-border">
                {deployments.slice(1).map((d) => (
                  <div key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <RotateCcw size={14} className="text-text-muted" />
                    <span className="font-mono text-text-secondary">#{d.id}</span>
                    <span className="ml-auto"><button onClick={() => redeploy(d.commit_sha ?? undefined)} disabled={deploying} className="rounded-full border border-neutral-border px-3 py-1 text-xs hover:bg-bg-secondary disabled:opacity-50">Roll back</button></span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Variables & secrets">
            {token && (user?.role === 'admin' || user?.role === 'tenant_admin' || user?.role === 'developer') ? (
              <EnvPanel token={token} projectId={projectId} sid={sid} appType={service.app_type} />
            ) : (
              <div className="flex items-center gap-2 py-1 text-sm text-text-muted"><Lock size={14} /> You need write access to edit variables for this service.</div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-border bg-surface-card p-5">
      <p className="mb-3 text-sm font-semibold text-text-primary">{title}</p>
      {children}
    </div>
  );
}
function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className={cn(muted ? 'text-text-muted' : 'text-text-primary')}>{value}</span>
    </div>
  );
}
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg-secondary p-3">
      <div className="flex items-center gap-1.5 text-xs text-text-muted">{icon} {label}</div>
      <p className="mt-1 font-display text-lg font-bold text-text-primary">{value}</p>
    </div>
  );
}

function PortEditor({ token, projectId, sid, current, onSaved }: {
  token: string; projectId: number; sid: number; current: number | null; onSaved: () => void;
}) {
  const [value, setValue] = useState(current != null ? String(current) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    const n = value.trim() === '' ? null : Number(value);
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 65535)) { setErr('Port must be 1–65535'); return; }
    setSaving(true); setErr('');
    try { await api.setConfig(token, projectId, sid, { port: n }); onSaved(); }
    catch (e) { setErr((e as Error).message || 'Could not save'); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-text-muted">Port</span>
      <div className="flex items-center gap-2">
        <input
          value={value} onChange={(e) => { setValue(e.target.value.replace(/[^0-9]/g, '')); setErr(''); }}
          placeholder="8080" inputMode="numeric"
          className="w-24 rounded-lg border border-neutral-border bg-white px-2.5 py-1 text-right font-mono text-sm text-text-primary placeholder:text-text-muted"
        />
        <button onClick={save} disabled={saving || value.trim() === (current != null ? String(current) : '')}
          className="rounded-full border border-neutral-border px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg-secondary disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {err && <span className="ml-2 text-xs text-red-600">{err}</span>}
    </div>
  );
}

function CustomDomainEditor({ token, projectId, sid, current, fallback, onSaved }: {
  token: string; projectId: number; sid: number; current: string; fallback: string; onSaved: () => void;
}) {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true); setErr(''); setSaved(false);
    try {
      await api.setConfig(token, projectId, sid, { custom_domain: value.trim() || null });
      setSaved(true); onSaved();
    } catch (e) { setErr((e as Error).message || 'Could not save'); }
    finally { setSaving(false); }
  }

  return (
    <div className="mt-3 border-t border-neutral-border pt-3">
      <label className="mb-1 block text-xs font-medium text-text-secondary">Custom domain</label>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false); }}
          placeholder={fallback}
          className="flex-1 rounded-lg border border-neutral-border bg-white px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted"
        />
        <button onClick={save} disabled={saving || value.trim() === current.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      <p className="mt-1 text-xs text-text-muted">
        Blank uses the platform domain <span className="font-mono">{fallback}</span>. Point a CNAME at your site&apos;s edge, then redeploy to apply.
      </p>
    </div>
  );
}
