'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Users, Server, Pencil, X, Loader2, AlertCircle,
  RefreshCw, Trash2,
} from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { users as usersApi, monitoring, User, VM, UserRole } from '@rach/ui/lib/api';
import { cn } from '@rach/ui/lib/utils';

// ── Create User Modal ─────────────────────────────────────────────────────────

function CreateUserModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: (u: User) => void;
}) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone_number: '',
    role: 'tenant_user' as UserRole,
  });
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
      const { user } = await usersApi.create(token, form);
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
      <div className="w-full max-w-md rounded-2xl border border-neutral-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-border px-6 py-4">
          <h3 className="font-semibold text-text-primary">Add Team Member</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {field('Full name', 'name', 'text', 'Jane Smith')}
          {field('Email', 'email', 'email', 'jane@company.com')}
          {field('Password', 'password', 'password', '••••••••')}
          {field('Phone (with country code)', 'phone_number', 'tel', '+1 415 555 0100')}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
              className="w-full rounded-lg border border-neutral-border px-4 py-2.5 text-sm outline-none focus:border-primary-blue transition-colors"
            >
              <option value="tenant_user">User — can view assigned VMs</option>
              <option value="tenant_admin">Admin — can manage team &amp; assign VMs</option>
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
            Add Member
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign VMs Modal ──────────────────────────────────────────────────────────

function AssignVMsModal({
  user,
  token,
  onClose,
  onSaved,
}: {
  user: User;
  token: string;
  onClose: () => void;
  onSaved: (vmIds: string[]) => void;
}) {
  const [poolVMs, setPoolVMs] = useState<VM[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingVMs, setLoadingVMs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // tenant_admin's monitoring.getVMs returns only tenant pool VMs
        const [vmsData, assignedData] = await Promise.all([
          monitoring.getVMs(token),
          usersApi.getVMs(token, user.id),
        ]);
        setPoolVMs(vmsData.vms);
        setSelected(new Set(assignedData.vms.map((v) => v.vm_id)));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingVMs(false);
      }
    })();
  }, [token, user.id]);

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
      await usersApi.assignVMs(token, user.id, Array.from(selected));
      onSaved(Array.from(selected));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-border bg-white shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-neutral-border px-6 py-4 shrink-0">
          <div>
            <h3 className="font-semibold text-text-primary">Assign VMs</h3>
            <p className="text-xs text-text-muted mt-0.5">{user.name} · {user.email}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
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
          ) : poolVMs.length === 0 ? (
            <p className="text-center text-sm text-text-muted py-10">No VMs in your tenant pool yet. Contact Rach Dev LLP admin.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-text-muted mb-3">
                Select VMs from your tenant pool to assign to this user. {selected.size} selected.
              </p>
              {poolVMs.map((vm) => {
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
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', vm.status === 'running' ? 'bg-emerald-50' : 'bg-neutral-100')}>
                        <Server size={14} className={vm.status === 'running' ? 'text-emerald-600' : 'text-text-muted'} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary text-sm truncate">{vm.name}</p>
                        <p className="text-xs text-text-muted font-mono">{vm.id}</p>
                      </div>
                    </div>
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shrink-0', vm.status === 'running' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-text-muted')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', vm.status === 'running' ? 'bg-emerald-500' : 'bg-neutral-400')} />
                      {vm.status}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-border px-6 py-4 shrink-0">
          <button onClick={onClose} className="rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || loadingVMs}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Assign ({selected.size} VMs)
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { user: self, token } = useAuth();
  const router = useRouter();

  const [members, setMembers] = useState<User[]>([]);
  const [vmCounts, setVmCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    if (self && self.role !== 'tenant_admin') router.replace('/dashboard');
  }, [self, router]);

  const fetchMembers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await usersApi.getAll(token);
      setMembers(res.data);
      const counts = await Promise.all(
        res.data.map((u) =>
          usersApi.getVMs(token, u.id)
            .then((r) => ({ id: u.id, count: r.vms.length }))
            .catch(() => ({ id: u.id, count: 0 }))
        )
      );
      setVmCounts(Object.fromEntries(counts.map((c) => [c.id, c.count])));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleDelete = async (userId: number) => {
    if (!token || !confirm('Remove this user?')) return;
    try {
      await usersApi.delete(token, userId);
      setMembers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const ROLE_BADGE: Record<string, string> = {
    tenant_admin : 'bg-accent-sky/30 text-primary-blue',
    tenant_user  : 'bg-neutral-100 text-text-secondary',
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display text-text-primary">My Team</h2>
          <p className="mt-0.5 text-sm text-text-muted">Manage team members and their VM access</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchMembers} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> Add Member
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Members', value: members.length },
          { label: 'Admins',        value: members.filter((m) => m.role === 'tenant_admin').length },
          { label: 'With VMs',      value: Object.values(vmCounts).filter((c) => c > 0).length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-border bg-white p-5">
            <p className="text-2xl font-bold font-mono text-text-primary">{s.value}</p>
            <p className="mt-0.5 text-xs text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-border bg-white overflow-hidden">
        <div className="border-b border-neutral-border px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Team Members</h3>
          <span className="text-xs text-text-muted">{members.length} members</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-neutral-border border-t-primary-blue" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={fetchMembers} className="text-sm text-primary-blue hover:underline">Retry</button>
          </div>
        ) : members.length === 0 ? (
          <div className="py-20 text-center">
            <Users size={32} className="mx-auto text-text-muted mb-3" />
            <p className="text-sm text-text-muted">No team members yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-border bg-bg-secondary">
                  {['Member', 'Email', 'Role', 'VMs', 'Actions'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {members.map((m) => {
                  const count = vmCounts[m.id] ?? 0;
                  const isSelf = m.id === self?.id;
                  return (
                    <tr key={m.id} className="hover:bg-bg-secondary transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-blue to-primary-purple text-xs font-bold text-white shrink-0">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-text-primary">
                            {m.name}{isSelf && <span className="ml-1 text-xs text-text-muted">(you)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text-secondary">{m.email}</td>
                      <td className="px-6 py-4">
                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', ROLE_BADGE[m.role] ?? 'bg-neutral-100 text-text-muted')}>
                          {m.role === 'tenant_admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {count > 0 ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-text-primary">
                            <Server size={13} className="text-primary-blue" /> {count} VM{count !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {m.role !== 'tenant_admin' && (
                            <button
                              onClick={() => setSelectedUser(m)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary hover:border-primary-blue hover:text-primary-blue transition-all"
                            >
                              <Pencil size={11} /> {count > 0 ? 'Edit VMs' : 'Assign VMs'}
                            </button>
                          )}
                          {!isSelf && (
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-neutral-border px-2 py-1.5 text-xs text-text-secondary hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && token && (
        <CreateUserModal
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={(u) => { setMembers((prev) => [...prev, u]); setVmCounts((prev) => ({ ...prev, [u.id]: 0 })); setShowCreate(false); }}
        />
      )}
      {selectedUser && token && (
        <AssignVMsModal
          user={selectedUser}
          token={token}
          onClose={() => setSelectedUser(null)}
          onSaved={(vmIds) => { setVmCounts((prev) => ({ ...prev, [selectedUser.id]: vmIds.length })); setSelectedUser(null); }}
        />
      )}
    </div>
  );
}
