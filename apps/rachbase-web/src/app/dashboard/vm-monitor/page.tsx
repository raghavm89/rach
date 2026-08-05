'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Server, Cpu, MemoryStick, HardDrive, Clock, AlertCircle, Plus, TriangleAlert, X, ServerOff } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { monitoring, expansion, VM, VMSummary } from '@rach/ui/lib/api';
import { cn } from '@rach/ui/lib/utils';
import VMHistoryModal from '@/components/VMHistoryModal';

function UptimeLabel({ seconds }: { seconds: number }) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return <>{d}d {h}h</>;
  if (h > 0) return <>{h}h {m}m</>;
  return <>{m}m</>;
}

function UsageBar({ pct, className }: { pct: number; className?: string }) {
  const color =
    pct >= 80 ? 'bg-red-500' :
    'bg-gradient-to-r from-primary-blue to-primary-purple';
  return (
    <div className={cn('h-1.5 w-full rounded-full bg-neutral-border overflow-hidden', className)}>
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function VMMonitorPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [summary, setSummary]   = useState<VMSummary | null>(null);
  const [vms, setVMs]           = useState<VM[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedVM, setSelectedVM] = useState<VM | null>(null);
  const [obsVmIds, setObsVmIds] = useState<Set<string>>(new Set());
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [prevOverloaded, setPrevOverloaded] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'tenant_admin') router.replace('/dashboard');
  }, [user, router]);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) { setRefreshing(true); } else { setLoading(true); }
    setError('');
    try {
      const [summaryData, vmsData, obsData] = await Promise.all([
        monitoring.getSummary(token),
        monitoring.getVMs(token),
        expansion.hasObservability(token),
      ]);
      setSummary(summaryData);
      setVMs(vmsData.vms);
      setObsVmIds(new Set(obsData.obs_vm_ids ?? []));
      setLastUpdated(new Date());
    } catch (err) {
      setError((err as Error).message || 'Failed to load monitoring data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derive overloaded VMs and auto-reset dismiss when load clears
  const overloadedVMs = vms.filter((vm) => vm.cpuPct > 80 || vm.memoryPct > 85);
  const isOverloaded = overloadedVMs.length > 0;

  // Reset dismissed state when all VMs drop back below threshold
  // so banner reappears on the next overload event
  if (prevOverloaded && !isOverloaded) {
    setPrevOverloaded(false);
    setBannerDismissed(false);
  }
  if (!prevOverloaded && isOverloaded) {
    setPrevOverloaded(true);
  }

  const showBanner = isOverloaded && !bannerDismissed;

  if (loading) {
    return (
      <div className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-36 animate-pulse rounded-lg bg-surface-hover mb-2" />
            <div className="h-3.5 w-28 animate-pulse rounded bg-surface-hover" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-24 animate-pulse rounded-lg bg-surface-hover" />
            <div className="h-9 w-36 animate-pulse rounded-lg bg-surface-hover" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0,1,2,3].map((i) => (
            <div key={i} className="rounded-xl border border-neutral-border bg-surface-card p-5">
              <div className="mb-3 h-8 w-8 animate-pulse rounded-lg bg-surface-hover" />
              <div className="h-8 w-14 animate-pulse rounded-lg bg-surface-hover mb-2" />
              <div className="h-3.5 w-24 animate-pulse rounded bg-surface-hover" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-neutral-border bg-surface-card overflow-hidden">
          <div className="border-b border-neutral-border px-6 py-4">
            <div className="h-4 w-32 animate-pulse rounded bg-surface-hover" />
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
                {[...Array(6)].map((_, i) => (
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
    const isNoVMs = error.toLowerCase().includes('no vm') || error.toLowerCase().includes('not assigned') || error.toLowerCase().includes('no pool');
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center max-w-sm mx-auto">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-secondary">
          <ServerOff size={28} className="text-text-muted" />
        </div>
        <div>
          <p className="font-semibold text-text-primary">
            {isNoVMs ? 'No VMs assigned to your tenant yet' : 'Something went wrong'}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {isNoVMs
              ? 'Your VMs will appear here once your plan is confirmed and resources are assigned by our team.'
              : error}
          </p>
        </div>
        {!isNoVMs && (
          <button onClick={() => fetchData()} className="text-sm text-primary-blue hover:underline">
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">

      {/* High-load alert banner */}
      {showBanner && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <TriangleAlert size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {overloadedVMs.length === 1 ? 'VM under high load' : `${overloadedVMs.length} VMs under high load`}
            </p>
            <ul className="mt-1 space-y-0.5">
              {overloadedVMs.map((vm) => {
                const reasons = [];
                if (vm.cpuPct > 80) reasons.push(`CPU ${vm.cpuPct}%`);
                if (vm.memoryPct > 85) reasons.push(`RAM ${vm.memoryPct}%`);
                return (
                  <li key={vm.id} className="text-xs text-amber-700">
                    <span className="font-medium">{vm.name}</span> — {reasons.join(', ')} · Consider scaling horizontally using <span className="font-medium">Add VM Resources</span> above.
                  </li>
                );
              })}
            </ul>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="shrink-0 rounded-md p-1 hover:bg-amber-100 transition-colors"
            aria-label="Dismiss"
          >
            <X size={14} className="text-amber-600" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display text-text-primary">VM Monitor</h2>
          {lastUpdated && (
            <p className="mt-0.5 text-xs text-text-muted">Last updated {lastUpdated.toLocaleTimeString()}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
            Refresh
          </button>
          <Link
            href="/dashboard/billing"
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            Add VM Resources
          </Link>
        </div>
      </div>

      {/* Summary cards — tenant pool stats */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'VMs Running',  value: summary.vms.running,  icon: <Server size={16} />, accent: true },
            { label: 'VMs Stopped',  value: summary.vms.stopped,  icon: <Server size={16} />, accent: false },
            { label: 'Containers Running', value: summary.lxc.running, icon: <Server size={16} />, accent: false },
            { label: 'Total Guests', value: summary.vms.total + summary.lxc.total, icon: <Server size={16} />, accent: false },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-neutral-border bg-surface-card p-5">
              <div className={cn('mb-3 flex h-8 w-8 items-center justify-center rounded-lg', stat.accent ? 'bg-gradient-to-br from-primary-blue to-primary-purple text-white' : 'bg-bg-secondary text-text-muted')}>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold font-mono text-text-primary">{stat.value}</p>
              <p className="mt-0.5 text-xs text-text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* VM Table */}
      <div className="rounded-xl border border-neutral-border bg-surface-card overflow-hidden">
        <div className="border-b border-neutral-border px-6 py-4 flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-primary">Tenant VM Pool</h3>
          {summary?.poolName && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary-blue/10 to-primary-purple/10 border border-primary-blue/20 px-2.5 py-0.5 text-xs font-semibold text-primary-blue">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-blue" />
              pool: {summary.poolName}
            </span>
          )}
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
                {['Name', 'Type', 'Status', 'CPU', 'Memory', 'Disk', 'Uptime'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-border">
              {vms.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-secondary">
                        <ServerOff size={24} className="text-text-muted" />
                      </div>
                      <p className="font-semibold text-text-primary text-sm">No VMs assigned yet</p>
                      <p className="text-xs text-text-muted">Your VMs will appear here once your plan is confirmed and resources are assigned by our team.</p>
                    </div>
                  </td>
                </tr>
              )}
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
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-bg-secondary px-2.5 py-0.5 text-xs font-medium text-text-secondary uppercase">{vm.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', vm.status === 'running' ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-hover text-text-muted')}>
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
