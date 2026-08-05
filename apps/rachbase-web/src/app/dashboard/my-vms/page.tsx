'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Server, Cpu, MemoryStick, HardDrive, Clock, ServerOff, AlertCircle, SquareTerminal, Network } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { monitoring, expansion, VM } from '@rach/ui/lib/api';
import { cn } from '@rach/ui/lib/utils';
import VMHistoryModal from '@/components/VMHistoryModal';
import { useTerminal } from '@/contexts/TerminalContext';

function UptimeLabel({ seconds }: { seconds: number }) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return <>{d}d {h}h</>;
  if (h > 0) return <>{h}h {m}m</>;
  return <>{m}m</>;
}

function UsageBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? 'bg-red-500' :
    'bg-gradient-to-r from-primary-blue to-primary-purple';
  return (
    <div className="h-1.5 w-full rounded-full bg-neutral-border overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function MyVMsPage() {
  const { token, user } = useAuth();
  const router = useRouter();

  // My VMs is a tenant-user view (tenant_admin uses VM Monitor).
  useEffect(() => {
    if (user && !['tenant_user', 'developer'].includes(user.role)) router.replace('/dashboard');
  }, [user, router]);

  const [vms, setVMs]           = useState<VM[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedVM, setSelectedVM] = useState<VM | null>(null);
  const { openTerminal } = useTerminal();
  const [obsVmIds, setObsVmIds] = useState<Set<string>>(new Set());
  const [ipsByVm, setIpsByVm] = useState<Record<string, { id: number; ip_address: string; purpose: string | null }[]>>({});

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) { setRefreshing(true); } else { setLoading(true); }
    setError('');
    try {
      const [data, obsData, ipData] = await Promise.all([
        monitoring.getVMs(token),
        expansion.hasObservability(token),
        expansion.myIps(token),
      ]);
      setVMs(data.vms);
      setObsVmIds(new Set(obsData.obs_vm_ids ?? []));
      const grouped: Record<string, { id: number; ip_address: string; purpose: string | null }[]> = {};
      for (const ip of ipData.ips) { (grouped[ip.vm_id] ??= []).push(ip); }
      setIpsByVm(grouped);
      setLastUpdated(new Date());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-28 animate-pulse rounded-lg bg-surface-hover mb-2" />
            <div className="h-3.5 w-32 animate-pulse rounded bg-surface-hover" />
          </div>
          <div className="h-9 w-24 animate-pulse rounded-lg bg-surface-hover" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2].map((i) => (
            <div key={i} className="rounded-xl border border-neutral-border bg-surface-card p-5">
              <div className="h-8 w-12 animate-pulse rounded-lg bg-surface-hover mb-2" />
              <div className="h-3.5 w-20 animate-pulse rounded bg-surface-hover" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-neutral-border bg-surface-card overflow-hidden">
          <div className="border-b border-neutral-border px-6 py-4">
            <div className="h-4 w-40 animate-pulse rounded bg-surface-hover" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-border bg-bg-secondary">
                  {['Name','Type','Status','CPU','Memory','Disk','Uptime'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="h-3.5 w-28 animate-pulse rounded bg-surface-hover mb-1.5" />
                      <div className="h-3 w-16 animate-pulse rounded bg-surface-hover" />
                    </td>
                    <td className="px-6 py-4"><div className="h-5 w-10 animate-pulse rounded-full bg-surface-hover" /></td>
                    <td className="px-6 py-4"><div className="h-5 w-16 animate-pulse rounded-full bg-surface-hover" /></td>
                    <td className="px-6 py-4">
                      <div className="h-3 w-8 animate-pulse rounded bg-surface-hover mb-1.5" />
                      <div className="h-1.5 w-24 animate-pulse rounded-full bg-surface-hover" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-3 w-20 animate-pulse rounded bg-surface-hover mb-1.5" />
                      <div className="h-1.5 w-28 animate-pulse rounded-full bg-surface-hover" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-3 w-20 animate-pulse rounded bg-surface-hover mb-1.5" />
                      <div className="h-1.5 w-28 animate-pulse rounded-full bg-surface-hover" />
                    </td>
                    <td className="px-6 py-4"><div className="h-3.5 w-12 animate-pulse rounded bg-surface-hover" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isPending = error.toLowerCase().includes('no vms');
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center max-w-sm mx-auto">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-secondary">
          <ServerOff size={28} className="text-text-muted" />
        </div>
        <div>
          <p className="font-semibold text-text-primary">
            {isPending ? 'No VMs assigned yet' : 'Something went wrong'}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {isPending
              ? 'Your VMs will appear here once your plan is confirmed and resources are assigned by our team.'
              : error}
          </p>
        </div>
        {!isPending && (
          <button onClick={() => fetchData()} className="text-sm text-primary-blue hover:underline">
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display text-text-primary">My VMs</h2>
          {lastUpdated && (
            <p className="mt-0.5 text-xs text-text-muted">
              Last updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total VMs',    value: vms.length },
          { label: 'Running',      value: vms.filter((v) => v.status === 'running').length },
          { label: 'Stopped',      value: vms.filter((v) => v.status !== 'running').length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-border bg-surface-card p-5">
            <p className="text-2xl font-bold font-mono text-text-primary">{s.value}</p>
            <p className="mt-0.5 text-xs text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* VM Table */}
      <div className="rounded-xl border border-neutral-border bg-surface-card overflow-hidden">
        <div className="border-b border-neutral-border px-6 py-4 flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-primary">Your Virtual Machines</h3>
          {obsVmIds.size === 0 && (
            <Link
              href="/dashboard/billing"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <AlertCircle size={11} />
              Add Observability to view graphs
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-border bg-bg-secondary">
                {['Name', 'Type', 'Status', 'CPU', 'Memory', 'Disk', 'Uptime', 'SSH'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-border">
              {vms.map((vm) => (
                <tr
                  key={vm.id}
                  onClick={() => obsVmIds.has(vm.id) && setSelectedVM(vm)}
                  title={obsVmIds.has(vm.id) ? 'Click to view graph' : 'Observability not enabled for this VM'}
                  className={cn('hover:bg-bg-secondary transition-colors', obsVmIds.has(vm.id) ? 'cursor-pointer' : 'cursor-default')}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Server size={14} className="text-text-muted shrink-0" />
                      <div>
                        <p className="font-medium text-text-primary">{vm.name}</p>
                        <p className="text-xs text-text-muted font-mono">{vm.id}</p>
                        {ipsByVm[vm.id]?.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {ipsByVm[vm.id].map((ip) => (
                              <span key={ip.id} title={ip.purpose ? `Additional IP · ${ip.purpose}` : 'Additional IP'}
                                className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-mono text-sky-700">
                                <Network size={10} /> {ip.ip_address}{ip.purpose ? <span className="text-sky-500/70 not-italic">· {ip.purpose}</span> : null}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-bg-secondary px-2.5 py-0.5 text-xs font-medium text-text-secondary uppercase">{vm.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      vm.status === 'running' ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-hover text-text-muted',
                    )}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', vm.status === 'running' ? 'bg-emerald-500' : 'bg-neutral-400')} />
                      {vm.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <Cpu size={12} className="text-text-muted shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-mono text-text-primary mb-1">{vm.cpuPct}%</p>
                        <UsageBar pct={vm.cpuPct} />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 min-w-[130px]">
                      <MemoryStick size={12} className="text-text-muted shrink-0" />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-mono text-text-primary">{vm.memoryUsedGib} / {vm.memoryTotalGib} GiB</span>
                          <span className="text-text-muted">{vm.memoryPct}%</span>
                        </div>
                        <UsageBar pct={vm.memoryPct} />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {vm.diskTotalGib > 0 ? (
                      <div className="flex items-center gap-2 min-w-[130px]">
                        <HardDrive size={12} className="text-text-muted shrink-0" />
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-mono text-text-primary">{vm.diskUsedGib} / {vm.diskTotalGib} GiB</span>
                            <span className="text-text-muted">{vm.diskPct}%</span>
                          </div>
                          <UsageBar pct={vm.diskPct} />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Clock size={12} className="text-text-muted" />
                      <span className="font-mono"><UptimeLabel seconds={vm.uptimeSeconds} /></span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); openTerminal({ id: vm.id, name: vm.name }); }}
                      disabled={vm.status !== 'running'}
                      title={vm.status === 'running' ? 'Open SSH terminal' : 'VM is not running'}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-primary-blue hover:border-primary-blue/40 hover:bg-bg-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <SquareTerminal size={13} /> SSH
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedVM && token && (
        <VMHistoryModal
          vmId={selectedVM.id}
          vmName={selectedVM.name}
          vmType={selectedVM.type}
          vmStatus={selectedVM.status}
          token={token}
          onClose={() => setSelectedVM(null)}
        />
      )}
    </div>
  );
}
