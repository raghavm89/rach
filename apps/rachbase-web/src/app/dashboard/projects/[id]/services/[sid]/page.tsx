'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Box, GitBranch, Rocket, Globe, Gauge, Activity, GitPullRequestArrow,
  Loader2, Lock, RotateCcw, Cpu, MemoryStick, HardDrive, Copy, Plus,
  Terminal as TerminalIcon, Database,
} from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { projects as api, type Service, type Deployment } from '@rach/ui/lib/api';
import { ResourceTabs, useResourceTab } from '@/components/dashboard/ResourceTabs';
import { Terminal } from '@/components/dashboard/Terminal';
import { DbConsole } from '@/components/dashboard/database/DbConsole';

declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open(): void };
  }
}
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById('rzp-script')) { resolve(true); return; }
    const s = document.createElement('script');
    s.id = 'rzp-script';
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

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
  const { token } = useAuth();
  const params = useParams();
  const projectId = Number(params.id);
  const sid = Number(params.sid);

  const [service, setService] = useState<Service | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const isPg = service?.source_type === 'postgres';
  const tabs = isPg ? [DATA_TAB, ...TABS] : TABS;
  const [tab, setTab] = useResourceTab(tabs.map((t) => t.key), isPg ? 'data' : 'deploy');
  const [deploying, setDeploying] = useState(false);
  const [buying, setBuying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function load() {
    if (!token || !sid) return;
    setLoading(true);
    try {
      const data = await api.getService(token, projectId, sid);
      setService(data.service);
      setDeployments(data.deployments);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, projectId, sid]);

  async function handleDeploy() {
    if (!token) return;
    setDeploying(true);
    try {
      await api.deploy(token, projectId, sid, {});
      await load();
    } finally {
      setDeploying(false);
    }
  }

  // Buy one Service Unit ($15/mo). First unit brings a draft online; each extra scales live.
  async function handleBuyUnit() {
    if (!token || !service) return;
    setBuying(true);
    setPayError(null);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Failed to load Razorpay checkout. Please try again.');
      const co = await api.checkoutUnit(token, projectId, sid);
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: co.razorpay_key_id,
          order_id: co.razorpay_order_id,
          amount: co.amount,
          currency: co.currency,
          name: 'RachBase',
          description: `Service Unit — ${service.name} (0.5 vCPU · 0.5 GB · 0.5 GB)`,
          handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              await api.verifyUnit(token, projectId, sid, {
                razorpay_order_id: r.razorpay_order_id,
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_signature: r.razorpay_signature,
              });
              await load();
              resolve();
            } catch (e) { reject(e); }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
        });
        rzp.open();
      });
    } catch (e) {
      setPayError((e as Error).message);
    } finally {
      setBuying(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-text-muted"><Loader2 className="animate-spin" /></div>;
  if (!service) return <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">Service not found</p>;

  const domain = `${service.name}.rachbase.app`;

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
      </div>

      {/* Pay-to-online banner for a draft / awaiting-payment service */}
      {(service.status === 'draft' || service.status === 'pending_payment') && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">This service is not online yet</p>
            <p className="text-xs text-text-muted">Add your first Service Unit — 0.5 vCPU · 0.5 GB · 0.5 GB for $15/mo — to bring it online.</p>
          </div>
          <button onClick={handleBuyUnit} disabled={buying}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {buying ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />} Add unit &amp; go live · $15/mo
          </button>
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
          <Panel title="Source">
            <Row label="Type" value={service.source_type === 'github_repo' ? 'GitHub Repository' : 'Docker Image'} />
            {service.repo_full_name && <Row label="Repository" value={service.repo_full_name} />}
            <Row label="Branch" value={service.branch} />
          </Panel>
          <div className="flex items-center justify-between rounded-xl border border-neutral-border bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">Trigger a deployment</p>
              <p className="text-xs text-text-muted">Builds the latest commit and rolls it out with zero downtime.</p>
            </div>
            <button onClick={handleDeploy} disabled={deploying}
              className="inline-flex items-center gap-2 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {deploying ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />} Deploy
            </button>
          </div>
          <Panel title="Deployment history">
            {deployments.length === 0 ? (
              <p className="py-2 text-sm text-text-muted">No deployments yet.</p>
            ) : (
              <div className="divide-y divide-neutral-border">
                {deployments.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className={cn('h-2 w-2 rounded-full', STATUS_COLOR[d.status] || 'bg-neutral-400')} />
                    <span className="font-mono text-text-secondary">#{d.id}</span>
                    <span className="text-text-primary">{d.status}</span>
                    {d.commit_sha && <span className="font-mono text-xs text-text-muted">{d.commit_sha.slice(0, 7)}</span>}
                    <span className="ml-auto text-xs text-text-muted">{new Date(d.created_at).toLocaleString()}</span>
                  </div>
                ))}
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
              <div className="flex items-center gap-2 text-sm text-text-primary"><Globe size={15} className="text-text-muted" /> {domain}</div>
              <button className="text-text-muted hover:text-text-primary"><Copy size={15} /></button>
            </div>
            <Row label="SSL" value="Automatic (Let's Encrypt)" />
            <Row label="Custom domain" value="Add one — available once the service is running" muted />
          </Panel>
          <Panel title="Private networking">
            <Row label="Internal hostname" value={`${service.name}.internal`} />
            <Row label="Port" value="8080" />
            <p className="pt-1 text-xs text-text-muted">Services in this project reach each other over the private network — no config.</p>
          </Panel>
        </div>
      )}

      {/* ── Scale ── */}
      {tab === 'scale' && (
        <div className="space-y-5">
          <Panel title="Resources (per unit)">
            <div className="grid grid-cols-3 gap-3">
              <Metric icon={<Cpu size={16} />} label="CPU" value={`${service.cpu} vCPU`} />
              <Metric icon={<MemoryStick size={16} />} label="Memory" value={`${(service.memory_mb / 1024).toFixed(1)} GB`} />
              <Metric icon={<HardDrive size={16} />} label="Disk" value={`${service.disk_gb} GB`} />
            </div>
          </Panel>
          <Panel title="Units">
            <Row label="Active units" value={String(service.units ?? 0)} />
            <Row label="Total allocated" value={`${(Number(service.cpu) * (service.units ?? 0)).toFixed(1)} vCPU · ${((service.memory_mb * (service.units ?? 0)) / 1024).toFixed(1)} GB · ${(Number(service.disk_gb) * (service.units ?? 0)).toFixed(1)} GB`} />
            <Row label="Monthly cost" value={`$${(15 * (service.units ?? 0)).toLocaleString()}/mo`} />
            <button onClick={handleBuyUnit} disabled={buying}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {buying ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add power (+1 unit · $15/mo)
            </button>
            <p className="pt-2 text-xs text-text-muted">Each unit is 0.5 vCPU / 0.5 GB / 0.5 GB ($15/mo). Adding a unit scales the service live — the rolling update runs with zero downtime.</p>
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
                    <span className="ml-auto"><button onClick={handleDeploy} className="rounded-full border border-neutral-border px-3 py-1 text-xs hover:bg-bg-secondary">Roll back</button></span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Variables & secrets">
            <div className="flex items-center gap-2 py-1 text-sm text-text-muted"><Lock size={14} /> Add environment variables and secrets for this service.</div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-border bg-white p-5">
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
