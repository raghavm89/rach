'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Box, Database, Globe, Terminal as TerminalIcon, LayoutDashboard, GitBranch, Copy, Loader2, SlidersHorizontal, ScrollText } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { deployment, type DeploymentService } from '@rach/ui/lib/api';
import { ResourceTabs, useResourceTab } from '@/components/dashboard/ResourceTabs';
import { Terminal } from '@/components/dashboard/Terminal';
import { DbConsole } from '@/components/dashboard/database/DbConsole';
import { DomainsPanel } from '@/components/dashboard/DomainsPanel';
import { VariablesPanel } from '@/components/dashboard/VariablesPanel';
import { GroupSelector } from '@/components/dashboard/GroupSelector';
import { LogsPanel } from '@/components/dashboard/LogsPanel';
import { LinkServicePanel } from '@/components/dashboard/LinkServicePanel';

const STATUS_COLOR: Record<string, string> = {
  connected: 'bg-emerald-500', deployed: 'bg-emerald-500',
  deploying: 'bg-amber-500', failed: 'bg-red-500',
};

export default function DeploymentServiceDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const id = Number(params.id);

  const [service, setService] = useState<DeploymentService | null>(null);
  const [loading, setLoading] = useState(true);

  const isPg = service?.source_type === 'postgres';
  const OVERVIEW = { key: 'overview', label: 'Overview', icon: LayoutDashboard } as const;
  const CONSOLE = { key: 'console', label: 'Console', icon: TerminalIcon } as const;
  const DATA = { key: 'data', label: 'Data', icon: Database } as const;
  const DOMAINS = { key: 'domains', label: 'Domains', icon: Globe } as const;
  const VARS = { key: 'variables', label: 'Variables', icon: SlidersHorizontal } as const;
  const LOGS = { key: 'logs', label: 'Logs', icon: ScrollText } as const;
  const tabs = isPg ? [OVERVIEW, DATA, CONSOLE, DOMAINS, VARS] : [OVERVIEW, CONSOLE, LOGS, DOMAINS, VARS];
  const [tab, setTab] = useResourceTab(tabs.map((t) => t.key), 'overview');

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    deployment.listServices(token)
      .then((d) => setService(d.services.find((s) => s.id === id) ?? null))
      .finally(() => setLoading(false));
  }, [token, id]);

  if (loading) return <div className="flex items-center justify-center py-20 text-text-muted"><Loader2 className="animate-spin" /></div>;
  if (!service) return <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">Service not found</p>;

  const title = service.name || service.repo_full_name || `service-${service.id}`;

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/deployment" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft size={15} /> Back to deployments
      </Link>

      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary-blue">
          {isPg ? <Database size={22} /> : <Box size={22} />}
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-text-primary">{title}</h2>
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className={cn('h-2 w-2 rounded-full', STATUS_COLOR[service.status] || 'bg-neutral-400')} />
            {service.status}
            {service.repo_full_name && <><span className="text-neutral-border">·</span><GitBranch size={11} /> {service.repo_full_name}</>}
          </p>
        </div>
      </div>

      <ResourceTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-neutral-border bg-white p-5 text-sm">
            <Row label="Type" value={isPg ? 'Managed PostgreSQL' : 'GitHub service'} />
            <Row label="VM" value={service.vm_id} />
            {service.repo_full_name && <Row label="Repository" value={service.repo_full_name} />}
            {service.branch && <Row label="Branch" value={service.branch} />}
            <Row label="Status" value={service.status} />
            {token && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-text-muted">Group</span>
                <GroupSelector
                  serviceId={service.id}
                  currentGroupId={service.group_id}
                  token={token}
                  onChange={(gid) => setService((s) => (s ? { ...s, group_id: gid } : s))}
                />
              </div>
            )}
          </div>
          {token && !isPg && <LinkServicePanel serviceId={service.id} token={token} />}
        </div>
      )}

      {tab === 'console' && (
        service.vm_id && token ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">Console</p>
              <button type="button" onClick={() => navigator.clipboard?.writeText(`ssh root@${service.vm_id}`)}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-border px-3 py-1 text-xs text-text-muted hover:text-text-primary">
                <Copy size={13} /> Copy SSH command
              </button>
            </div>
            <Terminal vmId={service.vm_id} vmName={title} token={token} onClose={() => setTab('overview')} />
          </div>
        ) : <p className="rounded-lg bg-bg-secondary px-4 py-3 text-sm text-text-muted">Console available once the service is on a VM.</p>
      )}

      {tab === 'data' && isPg && token && <DbConsole serviceId={service.id} token={token} />}

      {tab === 'logs' && token && <LogsPanel serviceId={service.id} token={token} />}

      {tab === 'domains' && token && <DomainsPanel serviceId={service.id} token={token} />}

      {tab === 'variables' && token && <VariablesPanel serviceId={service.id} token={token} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono text-text-primary">{value}</span>
    </div>
  );
}
