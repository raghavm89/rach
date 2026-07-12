'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Server, Cpu, MemoryStick, HardDrive, Clock, AlertCircle, BarChart2 } from 'lucide-react';
import VMHistoryModal from '@/components/VMHistoryModal';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { monitoring, expansion, tenants, VM, VMSummary, Tenant } from '@rach/ui/lib/api';
import { cn } from '@rach/ui/lib/utils';

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

export default function MonitoringPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [summary, setSummary]       = useState<VMSummary | null>(null);
  const [vms, setVMs]               = useState<VM[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedVM, setSelectedVM] = useState<VM | null>(null);

  // Obs assignment state
  const [obsVmIds, setObsVmIds]             = useState<Set<string>>(new Set());
  const [obsQuotas, setObsQuotas]           = useState<{ tenant_id: number; tenant_name: string; quota: number; used: number }[]>([]);
  const [tenantList, setTenantList]         = useState<Tenant[]>([]);
  const [obsToggling, setObsToggling]       = useState<string | null>(null); // vm_id being toggled

  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/dashboard');
  }, [user, router]);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) { setRefreshing(true); } else { setLoading(true); }
    setError('');
    try {
      const [summaryData, vmsData, assignmentsData, quotaData, tenantsData] = await Promise.all([
        monitoring.getSummary(token),
        monitoring.getVMs(token),
        expansion.listObsAssignments(token),
        expansion.getObsQuota(token),
        tenants.getAll(token),
      ]);
      setSummary(summaryData);
      setVMs(vmsData.vms);
      setObsVmIds(new Set(assignmentsData.assignments.map((a) => a.vm_id)));
      setObsQuotas(quotaData.quotas);
      setTenantList(tenantsData.tenants);
      setLastUpdated(new Date());
    } catch (err) {
      setError((err as Error).message || 'Failed to load monitoring data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Build pool → tenant_id map from tenant list
  const poolToTenantId = new Map(
    tenantList.filter((t) => t.pve_pool).map((t) => [t.pve_pool!, t.id])
  );

  const toggleObs = async (vm: VM) => {
    if (!token || obsToggling) return;
    const tenantId = poolToTenantId.get(vm.pool ?? '');
    if (!tenantId) return;
    setObsToggling(vm.id);
    try {
      if (obsVmIds.has(vm.id)) {
        await expansion.unassignObs(token, tenantId, vm.id);
        setObsVmIds((prev) => { const s = new Set(prev); s.delete(vm.id); return s; });
        setObsQuotas((prev) => prev.map((q) => q.tenant_id === tenantId ? { ...q, used: q.used - 1 } : q));
      } else {
        await expansion.assignObs(token, tenantId, vm.id);
        setObsVmIds((prev) => new Set(prev).add(vm.id));
        setObsQuotas((prev) => prev.map((q) => q.tenant_id === tenantId ? { ...q, used: q.used + 1 } : q));
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setObsToggling(null);
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-100 mb-2" />
            <div className="h-3.5 w-28 animate-pulse rounded bg-neutral-100" />
          </div>
          <div className="h-9 w-24 animate-pulse rounded-lg bg-neutral-100" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0,1,2,3].map((i) => (
            <div key={i} className="rounded-xl border border-neutral-border bg-white p-5">
              <div className="mb-3 h-8 w-8 animate-pulse rounded-lg bg-neutral-100" />
              <div className="h-8 w-14 animate-pulse rounded-lg bg-neutral-100 mb-2" />
              <div className="h-3.5 w-24 animate-pulse rounded bg-neutral-100" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-neutral-border bg-white overflow-hidden">
          <div className="border-b border-neutral-border px-6 py-4">
            <div className="h-4 w-36 animate-pulse rounded bg-neutral-100" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-border bg-bg-secondary">
                  {['Name','Pool','Type','Status','CPU','Memory','Disk','Uptime','Obs'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="h-3.5 w-28 animate-pulse rounded bg-neutral-100 mb-1.5" />
                      <div className="h-3 w-16 animate-pulse rounded bg-neutral-100" />
                    </td>
                    <td className="px-6 py-4"><div className="h-5 w-16 animate-pulse rounded-full bg-neutral-100" /></td>
                    <td className="px-6 py-4"><div className="h-5 w-10 animate-pulse rounded-full bg-neutral-100" /></td>
                    <td className="px-6 py-4"><div className="h-5 w-16 animate-pulse rounded-full bg-neutral-100" /></td>
                    <td className="px-6 py-4">
                      <div className="h-3 w-8 animate-pulse rounded bg-neutral-100 mb-1.5" />
                      <div className="h-1.5 w-24 animate-pulse rounded-full bg-neutral-100" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-3 w-20 animate-pulse rounded bg-neutral-100 mb-1.5" />
                      <div className="h-1.5 w-28 animate-pulse rounded-full bg-neutral-100" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-3 w-20 animate-pulse rounded bg-neutral-100 mb-1.5" />
                      <div className="h-1.5 w-28 animate-pulse rounded-full bg-neutral-100" />
                    </td>
                    <td className="px-6 py-4"><div className="h-3.5 w-12 animate-pulse rounded bg-neutral-100" /></td>
                    <td className="px-6 py-4"><div className="h-6 w-10 animate-pulse rounded-full bg-neutral-100" /></td>
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
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={() => fetchData()} className="text-sm text-primary-blue hover:underline">Try again</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display text-text-primary">VM Monitoring</h2>
          {lastUpdated && (
            <p className="mt-0.5 text-xs text-text-muted">Last updated {lastUpdated.toLocaleTimeString()}</p>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-neutral-border bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'VMs Running',        value: summary.vms.running,                    icon: <Server size={16} />, accent: true  },
            { label: 'VMs Stopped',        value: summary.vms.stopped,                    icon: <Server size={16} />, accent: false },
            { label: 'Containers Running', value: summary.lxc.running,                    icon: <Server size={16} />, accent: false },
            { label: 'Total Guests',       value: summary.vms.total + summary.lxc.total,  icon: <Server size={16} />, accent: false },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-neutral-border bg-white p-5">
              <div className={cn('mb-3 flex h-8 w-8 items-center justify-center rounded-lg', stat.accent ? 'bg-gradient-to-br from-primary-blue to-primary-purple text-white' : 'bg-bg-secondary text-text-muted')}>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold font-mono text-text-primary">{stat.value}</p>
              <p className="mt-0.5 text-xs text-text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Obs Quota Banner */}
      {obsQuotas.filter((q) => q.quota > 0).length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-6 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-700 flex items-center gap-2">
            <BarChart2 size={13} /> Observability Quota
          </p>
          <div className="flex flex-wrap gap-4">
            {obsQuotas.filter((q) => q.quota > 0).map((q) => (
              <div key={q.tenant_id} className="flex items-center gap-2 text-sm">
                <span className="font-medium text-text-primary">{q.tenant_name}</span>
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-bold',
                  q.used >= q.quota ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                )}>
                  {q.used} / {q.quota} slots
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VM Table */}
      <div className="rounded-xl border border-neutral-border bg-white overflow-hidden">
        <div className="border-b border-neutral-border px-6 py-4">
          <h3 className="text-sm font-semibold text-text-primary">Virtual Machines</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-border bg-bg-secondary">
                {['Name', 'Pool', 'Type', 'Status', 'CPU', 'Memory', 'Disk', 'Uptime', 'Obs'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-border">
              {vms.map((vm) => (
                <tr key={vm.id} onClick={() => setSelectedVM(vm)} className="hover:bg-bg-secondary transition-colors cursor-pointer" title="Click to view graph">
                  {/* Name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Server size={14} className="text-text-muted shrink-0" />
                      <div>
                        <p className="font-medium text-text-primary">{vm.name}</p>
                        <p className="text-xs text-text-muted font-mono">{vm.id}</p>
                      </div>
                    </div>
                  </td>
                  {/* Pool */}
                  <td className="px-6 py-4">
                    {vm.pool ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-blue/10 border border-primary-blue/20 px-2.5 py-0.5 text-xs font-medium text-primary-blue">
                        {vm.pool}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                  {/* Type */}
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-bg-secondary px-2.5 py-0.5 text-xs font-medium text-text-secondary uppercase">{vm.type}</span>
                  </td>
                  {/* Status */}
                  <td className="px-6 py-4">
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', vm.status === 'running' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-text-muted')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', vm.status === 'running' ? 'bg-emerald-500' : 'bg-neutral-400')} />
                      {vm.status}
                    </span>
                  </td>
                  {/* CPU */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <Cpu size={12} className="text-text-muted shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-mono text-text-primary mb-1">{vm.cpuPct}%</p>
                        <UsageBar pct={vm.cpuPct} />
                      </div>
                    </div>
                  </td>
                  {/* Memory */}
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
                  {/* Disk */}
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
                  {/* Uptime */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Clock size={12} className="text-text-muted" />
                      <span className="font-mono"><UptimeLabel seconds={vm.uptimeSeconds} /></span>
                    </div>
                  </td>
                  {/* Obs toggle */}
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const tenantId = poolToTenantId.get(vm.pool ?? '');
                      const quota    = obsQuotas.find((q) => q.tenant_id === tenantId);
                      const hasObs   = obsVmIds.has(vm.id);
                      const isFull   = !hasObs && quota && quota.used >= quota.quota;
                      const spinning = obsToggling === vm.id;
                      if (!tenantId || !quota || quota.quota === 0) {
                        return <span className="text-xs text-text-muted">—</span>;
                      }
                      return (
                        <button
                          onClick={() => toggleObs(vm)}
                          disabled={!!isFull || spinning}
                          title={isFull ? `Quota full (${quota.used}/${quota.quota})` : hasObs ? 'Remove observability' : 'Enable observability'}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all',
                            spinning && 'opacity-50 cursor-wait',
                            hasObs
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                              : isFull
                              ? 'bg-neutral-100 text-text-muted border border-neutral-border cursor-not-allowed'
                              : 'bg-bg-secondary text-text-muted border border-neutral-border hover:border-amber-300 hover:text-amber-700',
                          )}
                        >
                          <BarChart2 size={11} />
                          {hasObs ? 'On' : 'Off'}
                        </button>
                      );
                    })()}
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
