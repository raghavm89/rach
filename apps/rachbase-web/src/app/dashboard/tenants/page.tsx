'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Building2, Server, Users, Pencil, X, Loader2,
  AlertCircle, RefreshCw, Trash2, ChevronDown, ChevronUp,
  PackageCheck, Clock, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { tenants as tenantsApi, monitoring, users as usersApi, expansion, Tenant, VM, User, ExpansionRequest } from '@rach/ui/lib/api';
import { cn } from '@rach/ui/lib/utils';

// ── Create Tenant Modal ───────────────────────────────────────────────────────

function CreateTenantModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: (t: Tenant) => void;
}) {
  const [name, setName] = useState('');
  const [pvePool, setPvePool] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const { tenant } = await tenantsApi.create(token, name.trim(), pvePool.trim() || undefined);
      onCreated(tenant);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-border bg-surface-card shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-border px-6 py-4">
          <h3 className="font-semibold text-text-primary">New Tenant</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Tenant name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full rounded-lg border border-neutral-border px-4 py-2.5 text-sm outline-none focus:border-primary-blue focus:ring-2 focus:ring-blue-500/20 transition-colors"
              onKeyDown={(e) => { if (e.key === 'Enter') { handleCreate(); } }}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Pool Name <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              type="text"
              value={pvePool}
              onChange={(e) => setPvePool(e.target.value)}
              placeholder="e.g. k3s"
              className="w-full rounded-lg border border-neutral-border px-4 py-2.5 text-sm outline-none focus:border-primary-blue focus:ring-2 focus:ring-blue-500/20 transition-colors font-mono"
            />
            <p className="mt-1 text-xs text-text-muted">When set, monitoring uses <code className="bg-bg-secondary px-1 rounded">pool=&quot;name&quot;</code> — VMs added to this pool appear automatically.</p>
          </div>
          {error && (
            <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-neutral-border px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create Tenant
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign VMs Modal ──────────────────────────────────────────────────────────

function AssignVMsModal({
  tenantId,
  tenantName,
  token,
  onClose,
  onSaved,
}: {
  tenantId: number;
  tenantName: string;
  token: string;
  onClose: () => void;
  onSaved: (count: number) => void;
}) {
  const [allVMs, setAllVMs] = useState<VM[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingVMs, setLoadingVMs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [vmsData, poolData] = await Promise.all([
          monitoring.getVMs(token),
          tenantsApi.getVMs(token, tenantId),
        ]);
        setAllVMs(vmsData.vms);
        setSelected(new Set(poolData.vms.map((v) => v.vm_id)));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingVMs(false);
      }
    })();
  }, [token, tenantId]);

  const toggle = (vmId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(vmId)) { next.delete(vmId); } else { next.add(vmId); }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await tenantsApi.setVMs(token, tenantId, Array.from(selected));
      onSaved(selected.size);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-border bg-surface-card shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-neutral-border px-6 py-4 shrink-0">
          <div>
            <h3 className="font-semibold text-text-primary">Assign VM Pool</h3>
            <p className="text-xs text-text-muted mt-0.5">{tenantName}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadingVMs ? (
            <div className="flex justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-border border-t-primary-blue" />
            </div>
          ) : error ? (
            <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </p>
          ) : allVMs.length === 0 ? (
            <p className="text-center text-sm text-text-muted py-10">No VMs found in cluster</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-text-muted mb-3">
                Select VMs to include in this tenant&apos;s pool. {selected.size} selected.
              </p>
              {allVMs.map((vm) => {
                const isChecked = selected.has(vm.id);
                return (
                  <label
                    key={vm.id}
                    className={cn(
                      'flex items-center gap-4 rounded-lg border px-4 py-3 cursor-pointer transition-all duration-150',
                      isChecked ? 'border-primary-blue bg-blue-50' : 'border-neutral-border hover:bg-bg-secondary',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(vm.id)}
                      className="h-4 w-4 rounded accent-primary-blue"
                    />
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', vm.status === 'running' ? 'bg-emerald-50' : 'bg-surface-hover')}>
                        <Server size={14} className={vm.status === 'running' ? 'text-emerald-600' : 'text-text-muted'} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary text-sm truncate">{vm.name}</p>
                        <p className="text-xs text-text-muted font-mono">{vm.id}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', vm.status === 'running' ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-hover text-text-muted')}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', vm.status === 'running' ? 'bg-emerald-500' : 'bg-neutral-400')} />
                        {vm.status}
                      </span>
                      <p className="text-xs text-text-muted mt-1 font-mono">{vm.cpuPct}% CPU</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-border px-6 py-4 shrink-0">
          <button onClick={onClose} className="rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loadingVMs}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Pool ({selected.size} VMs)
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create First Admin Modal ──────────────────────────────────────────────────

function CreateAdminModal({
  tenantId,
  tenantName,
  token,
  onClose,
  onCreated,
}: {
  tenantId: number;
  tenantName: string;
  token: string;
  onClose: () => void;
  onCreated: (u: User) => void;
}) {
  const [form, setForm] = useState<{ name: string; email: string; password: string; phone_number: string; role: 'tenant_admin' | 'tenant_user' }>({ name: '', email: '', password: '', phone_number: '', role: 'tenant_admin' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password || !form.phone_number) {
      setError('All fields are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { user } = await usersApi.create(token, { ...form, tenant_id: tenantId });
      onCreated(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-border px-4 py-2.5 text-sm outline-none focus:border-primary-blue focus:ring-2 focus:ring-blue-500/20 transition-colors"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-border bg-surface-card shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-border px-6 py-4">
          <div>
            <h3 className="font-semibold text-text-primary">Add User to Tenant</h3>
            <p className="text-xs text-text-muted mt-0.5">{tenantName}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {field('Full name', 'name', 'text', 'John Smith')}
          {field('Email', 'email', 'email', 'john@company.com')}
          {field('Password', 'password', 'password', '••••••••')}
          {field('Phone (with country code)', 'phone_number', 'tel', '+1 415 555 0100')}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'tenant_admin' | 'tenant_user' }))}
              className="w-full rounded-lg border border-neutral-border px-4 py-2.5 text-sm outline-none focus:border-primary-blue transition-colors"
            >
              <option value="tenant_admin">Tenant Admin</option>
              <option value="tenant_user">Tenant User</option>
            </select>
          </div>
          {error && (
            <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-border px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create User
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Modal =
  | { type: 'create' }
  | { type: 'vms'; tenant: Tenant }
  | { type: 'addUser'; tenant: Tenant };

export default function TenantsPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [tenantList, setTenantList] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<Modal | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/dashboard');
  }, [user, router]);

  const fetchTenants = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await tenantsApi.getAll(token);
      setTenantList(data.tenants);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm('Delete this tenant? This cannot be undone.')) return;
    try {
      await tenantsApi.delete(token, id);
      setTenantList((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display text-text-primary">Tenants</h2>
          <p className="mt-0.5 text-sm text-text-muted">Manage organisations and their VM pools</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTenants}
            className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => setModal({ type: 'create' })}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            New Tenant
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Tenants', value: tenantList.length, icon: <Building2 size={16} />, accent: true },
          { label: 'Total Users',   value: tenantList.reduce((s, t) => s + (t.user_count ?? 0), 0), icon: <Users size={16} />, accent: false },
          { label: 'Total VMs',     value: tenantList.reduce((s, t) => s + (t.vm_count  ?? 0), 0), icon: <Server size={16} />, accent: false },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-neutral-border bg-surface-card p-5">
            <div className={cn('mb-3 flex h-8 w-8 items-center justify-center rounded-lg', stat.accent ? 'bg-gradient-to-br from-primary-blue to-primary-purple text-white' : 'bg-bg-secondary text-text-muted')}>
              {stat.icon}
            </div>
            {loading
              ? <div className="h-8 w-12 animate-pulse rounded-lg bg-surface-hover mb-2" />
              : <p className="text-2xl font-bold font-mono text-text-primary">{stat.value}</p>
            }
            <p className="mt-0.5 text-xs text-text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tenant list */}
      <div className="rounded-xl border border-neutral-border bg-surface-card overflow-hidden">
        <div className="border-b border-neutral-border px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Organisations</h3>
          <span className="text-xs text-text-muted">{tenantList.length} tenants</span>
        </div>

        {loading ? (
          <div className="divide-y divide-neutral-border">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="h-5 w-5 animate-pulse rounded bg-surface-hover shrink-0" />
                <div className="h-9 w-9 animate-pulse rounded-xl bg-surface-hover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-4 w-40 animate-pulse rounded bg-surface-hover mb-2" />
                  <div className="h-3 w-52 animate-pulse rounded bg-surface-hover" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-7 w-20 animate-pulse rounded-lg bg-surface-hover" />
                  <div className="h-7 w-20 animate-pulse rounded-lg bg-surface-hover" />
                  <div className="h-7 w-8 animate-pulse rounded-lg bg-surface-hover" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={fetchTenants} className="text-sm text-primary-blue hover:underline">Retry</button>
          </div>
        ) : tenantList.length === 0 ? (
          <div className="py-20 text-center">
            <Building2 size={32} className="mx-auto text-text-muted mb-3" />
            <p className="text-sm text-text-muted">No tenants yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-border">
            {tenantList.map((tenant) => {
              const isOpen = expanded.has(tenant.id);
              return (
                <div key={tenant.id}>
                  <div className="flex items-center gap-3 px-4 sm:px-6 py-4 hover:bg-bg-secondary transition-colors">
                    {/* Expand toggle */}
                    <button onClick={() => toggleExpand(tenant.id)} className="text-text-muted hover:text-text-primary shrink-0">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {/* Icon */}
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-blue to-primary-purple text-white shrink-0">
                      <Building2 size={16} />
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary truncate">{tenant.name}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <p className="text-xs text-text-muted">
                          {tenant.user_count ?? 0} user{(tenant.user_count ?? 0) !== 1 ? 's' : ''} ·{' '}
                          {tenant.vm_count ?? 0} VM{(tenant.vm_count ?? 0) !== 1 ? 's' : ''} in pool
                        </p>
                        {tenant.pve_pool && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-mono font-medium text-emerald-700 max-w-[140px] truncate">
                            pool=&quot;{tenant.pve_pool}&quot;
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions — icon-only on mobile, labeled on sm+ */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setModal({ type: 'addUser', tenant })}
                        title="Add User"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-2 py-1.5 sm:px-3 text-xs font-medium text-text-secondary hover:bg-bg-secondary hover:border-primary-blue hover:text-primary-blue transition-all"
                      >
                        <Users size={13} /> <span className="hidden sm:inline">Add User</span>
                      </button>
                      <button
                        onClick={() => setModal({ type: 'vms', tenant })}
                        title="VM Pool"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-2 py-1.5 sm:px-3 text-xs font-medium text-text-secondary hover:bg-bg-secondary hover:border-primary-blue hover:text-primary-blue transition-all"
                      >
                        <Pencil size={13} /> <span className="hidden sm:inline">VM Pool</span>
                      </button>
                      <button
                        onClick={() => handleDelete(tenant.id)}
                        title="Delete"
                        className="inline-flex items-center rounded-lg border border-neutral-border px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded: users in tenant */}
                  {isOpen && <TenantDetail tenantId={tenant.id} token={token!} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expansion requests */}
      <ExpansionRequestsPanel token={token!} />

      {/* Modals */}
      {modal?.type === 'create' && (
        <CreateTenantModal
          token={token!}
          onClose={() => setModal(null)}
          onCreated={(t) => { setTenantList((prev) => [...prev, t]); setModal(null); }}
        />
      )}
      {modal?.type === 'vms' && (
        <AssignVMsModal
          tenantId={modal.tenant.id}
          tenantName={modal.tenant.name}
          token={token!}
          onClose={() => setModal(null)}
          onSaved={(count) => {
            setTenantList((prev) => prev.map((t) => t.id === modal.tenant.id ? { ...t, vm_count: count } : t));
            setModal(null);
          }}
        />
      )}
      {modal?.type === 'addUser' && (
        <CreateAdminModal
          tenantId={modal.tenant.id}
          tenantName={modal.tenant.name}
          token={token!}
          onClose={() => setModal(null)}
          onCreated={() => { fetchTenants(); setModal(null); }}
        />
      )}
    </div>
  );
}

// ── Expansion Requests Panel ──────────────────────────────────────────────────

function ExpansionRequestsPanel({ token }: { token: string }) {
  const [requests, setRequests] = useState<ExpansionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<number | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await expansion.allRequests(token, 'pending');
      setRequests(data.requests);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleFulfil = async (id: number) => {
    setActionId(id);
    try {
      await expansion.fulfilRequest(token, id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Cancel this expansion request?')) return;
    setActionId(id);
    try {
      await expansion.cancelRequest(token, id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const fmtAmount = (cents: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(cents / 100);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="rounded-xl border border-neutral-border bg-surface-card overflow-hidden">
      <div className="border-b border-neutral-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PackageCheck size={16} className="text-primary-blue" />
          <h3 className="text-sm font-semibold text-text-primary">Pending VM Expansion Requests</h3>
        </div>
        <button
          onClick={fetchRequests}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-border bg-bg-secondary">
                {['Tenant','Package','VMs','Requested By','Date','Amount','Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-border">
              {[...Array(3)].map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4"><div className="h-4 w-28 animate-pulse rounded bg-surface-hover" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-32 animate-pulse rounded bg-surface-hover" /></td>
                  <td className="px-5 py-4"><div className="h-5 w-12 animate-pulse rounded-full bg-surface-hover" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-24 animate-pulse rounded bg-surface-hover" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-surface-hover" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-16 animate-pulse rounded bg-surface-hover" /></td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <div className="h-7 w-16 animate-pulse rounded-lg bg-surface-hover" />
                      <div className="h-7 w-16 animate-pulse rounded-lg bg-surface-hover" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <AlertCircle size={24} className="text-red-400" />
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={fetchRequests} className="text-sm text-primary-blue hover:underline">Retry</button>
        </div>
      ) : requests.length === 0 ? (
        <div className="py-12 text-center">
          <CheckCircle2 size={28} className="mx-auto text-emerald-400 mb-2" />
          <p className="text-sm text-text-muted">No pending expansion requests</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-border bg-bg-secondary">
                {['Tenant', 'Package', 'VMs', 'Requested By', 'Date', 'Amount', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-border">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-bg-secondary transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary-blue to-primary-purple text-white shrink-0">
                        <Building2 size={12} />
                      </div>
                      <span className="font-medium text-text-primary">{req.tenant_name ?? `Tenant #${req.tenant_id}`}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">{req.package_name ?? `Package #${req.package_id}`}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-bg-secondary px-2.5 py-0.5 text-xs font-semibold text-text-primary">
                      <Server size={11} />
                      {req.vm_count ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">{req.requested_by_name ?? `User #${req.requested_by}`}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Clock size={11} />
                      {fmtDate(req.requested_at)}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-text-primary">
                    {req.amount_paid ? fmtAmount(req.amount_paid, req.currency) : <span className="text-text-muted text-xs">Offline</span>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleFulfil(req.id)}
                        disabled={actionId === req.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                      >
                        {actionId === req.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                        Fulfil
                      </button>
                      <button
                        onClick={() => handleCancel(req.id)}
                        disabled={actionId === req.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-red-50 hover:border-red-300 hover:text-red-600 disabled:opacity-50 transition-all"
                      >
                        <X size={11} />
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tenant Detail sub-component (users list) ──────────────────────────────────

function TenantDetail({ tenantId, token }: { tenantId: number; token: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await tenantsApi.getById(token, tenantId);
        setUsers(data.users as unknown as User[]);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId, token]);

  if (loading) return <div className="px-4 sm:px-16 py-4 text-xs text-text-muted">Loading users…</div>;
  if (error)   return <div className="px-4 sm:px-16 py-4 text-xs text-red-500">{error}</div>;
  if (!users.length) return <div className="px-4 sm:px-16 py-4 text-xs text-text-muted">No users in this tenant yet.</div>;

  const ROLE_BADGE: Record<string, string> = {
    tenant_admin : 'bg-accent-sky/30 text-primary-blue',
    tenant_user  : 'bg-surface-hover text-text-secondary',
  };

  return (
    <div className="bg-bg-secondary border-t border-neutral-border">
      {users.map((u) => (
        <div key={u.id} className="flex items-center gap-4 px-4 sm:px-16 py-3 border-b border-neutral-border last:border-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary-blue to-primary-purple text-xs font-bold text-white shrink-0">
            {u.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">{u.name}</p>
            <p className="text-xs text-text-muted">{u.email}</p>
          </div>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ROLE_BADGE[u.role] ?? 'bg-surface-hover text-text-muted')}>
            {u.role === 'tenant_admin' ? 'Admin' : 'User'}
          </span>
        </div>
      ))}
    </div>
  );
}
