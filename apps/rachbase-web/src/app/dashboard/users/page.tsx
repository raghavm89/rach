'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, Trash2, X, Loader2, AlertCircle,
  RefreshCw, ChevronDown, Shield, Building2, Users,
  UserCog, Code2, Eye, EyeOff, Check,
} from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { users as usersApi, tenants as tenantsApi, User, Tenant, UserRole } from '@rach/ui/lib/api';
import { cn } from '@rach/ui/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ROLES: UserRole[] = ['admin', 'tenant_admin', 'tenant_user', 'developer'];

const ROLE_META: Record<UserRole, { label: string; textCls: string; bgCls: string; icon: React.ReactNode }> = {
  admin:        { label: 'Admin',        textCls: 'text-white',          bgCls: 'bg-gradient-to-r from-primary-blue to-primary-purple', icon: <Shield size={11} /> },
  tenant_admin: { label: 'Tenant Admin', textCls: 'text-primary-blue',   bgCls: 'bg-blue-50',     icon: <UserCog size={11} /> },
  tenant_user:  { label: 'Tenant User',  textCls: 'text-text-secondary', bgCls: 'bg-neutral-100', icon: <Users size={11} /> },
  developer:    { label: 'Developer',    textCls: 'text-amber-700',      bgCls: 'bg-amber-50',    icon: <Code2 size={11} /> },
};

const ROLE_TABS: { key: UserRole | 'all'; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'admin',        label: 'Admins' },
  { key: 'tenant_admin', label: 'Tenant Admins' },
  { key: 'tenant_user',  label: 'Tenant Users' },
  { key: 'developer',    label: 'Developers' },
];

// ─── Role Badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const m = ROLE_META[role];
  if (!m) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-text-muted">
        {role ?? 'unknown'}
      </span>
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', m.bgCls, m.textCls)}>
      {m.icon} {m.label}
    </span>
  );
}

// ─── Inline Role Selector ─────────────────────────────────────────────────────

function RoleSelector({
  userId, current, token, onChanged, disabled,
}: {
  userId: number; current: UserRole; token: string; onChanged: (u: User) => void; disabled?: boolean;
}) {
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = async (role: UserRole) => {
    if (role === current) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    try {
      const { user } = await usersApi.updateRole(token, userId, role);
      onChanged(user);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled || saving}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border border-neutral-border px-2 py-1 text-xs transition-all',
          disabled || saving
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-bg-secondary hover:border-primary-blue cursor-pointer',
        )}
      >
        {saving
          ? <Loader2 size={11} className="animate-spin text-text-muted" />
          : <RoleBadge role={current} />
        }
        {!disabled && !saving && <ChevronDown size={11} className="text-text-muted shrink-0" />}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-xl border border-neutral-border bg-white py-1 shadow-lg">
          {ALL_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => select(r)}
              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-bg-secondary transition-colors"
            >
              <RoleBadge role={r} />
              {r === current && <Check size={12} className="text-primary-blue shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inline Tenant Selector ───────────────────────────────────────────────────

function TenantSelector({
  userId, currentTenantId, token, tenants, onChanged,
}: {
  userId: number; currentTenantId: number | null; token: string;
  tenants: Tenant[]; onChanged: (u: User) => void;
}) {
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = async (tid: number | null) => {
    if (tid === currentTenantId) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    try {
      const { user } = await usersApi.updateTenant(token, userId, tid);
      onChanged(user);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const label = tenants.find((t) => t.id === currentTenantId)?.name ?? 'No tenant';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-bg-secondary hover:border-primary-blue transition-all disabled:opacity-50"
      >
        {saving
          ? <Loader2 size={11} className="animate-spin" />
          : <Building2 size={11} className="text-text-muted shrink-0" />
        }
        <span className="max-w-[96px] truncate">{label}</span>
        <ChevronDown size={11} className="text-text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 max-h-56 overflow-y-auto rounded-xl border border-neutral-border bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => select(null)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-text-muted hover:bg-bg-secondary transition-colors"
          >
            <span>No tenant</span>
            {currentTenantId === null && <Check size={12} className="text-primary-blue" />}
          </button>
          <div className="my-1 border-t border-neutral-border" />
          {tenants.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => select(t.id)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-bg-secondary transition-colors"
            >
              <span className="truncate">{t.name}</span>
              {t.id === currentTenantId && <Check size={12} className="text-primary-blue shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({
  token, tenants, onClose, onCreated, currentUserRole,
}: {
  token: string; tenants: Tenant[]; onClose: () => void; onCreated: (u: User) => void; currentUserRole: string;
}) {
  const [form, setForm] = useState({
    name: '', email: '', phone_number: '', password: '',
    role: 'tenant_user' as UserRole, tenant_id: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: string, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { user } = await usersApi.create(token, {
        name:         form.name.trim(),
        email:        form.email.trim(),
        phone_number: form.phone_number.trim(),
        password:     form.password,
        role:         form.role,
        tenant_id:    form.tenant_id ? Number(form.tenant_id) : null,
      });
      onCreated(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-neutral-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-blue focus:ring-2 focus:ring-blue-500/20 transition-colors placeholder:text-text-muted';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-border bg-white shadow-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-border px-6 py-4 shrink-0">
          <div>
            <h3 className="font-semibold text-text-primary">Create User</h3>
            <p className="text-xs text-text-muted mt-0.5">Admin-created accounts are immediately active — no email verification needed</p>
          </div>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <form id="create-user-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input required value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="Jane Smith" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                Email <span className="text-red-400">*</span>
              </label>
              <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="jane@company.com" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                Phone <span className="text-red-400">*</span>
              </label>
              <input required type="tel" value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)}
                placeholder="+1 415 555 0100" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input required type={showPw ? 'text' : 'password'} minLength={8}
                  value={form.password} onChange={(e) => set('password', e.target.value)}
                  placeholder="Min. 8 characters" className={cn(inputCls, 'pr-9')} />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className={currentUserRole === 'admin' ? 'grid grid-cols-2 gap-4' : ''}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                Role <span className="text-red-400">*</span>
              </label>
              <select value={form.role} onChange={(e) => set('role', e.target.value)}
                className={cn(inputCls, 'cursor-pointer')}>
                {ALL_ROLES.filter((r) => currentUserRole === 'admin' || r !== 'admin').map((r) => (
                  <option key={r} value={r}>{ROLE_META[r].label}</option>
                ))}
              </select>
            </div>
            {currentUserRole === 'admin' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-text-primary">Tenant</label>
                <select value={form.tenant_id} onChange={(e) => set('tenant_id', e.target.value)}
                  className={cn(inputCls, 'cursor-pointer')}>
                  <option value="">No tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={String(t.id)}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-border px-6 py-4 shrink-0">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors">
            Cancel
          </button>
          <button type="submit" form="create-user-form" disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}


// --- Delete Confirm Modal ---

function DeleteConfirm({
  target, token, onClose, onDeleted,
}: {
  target: User; token: string; onClose: () => void; onDeleted: (id: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const confirm = async () => {
    setLoading(true);
    try {
      await usersApi.delete(token, target.id);
      onDeleted(target.id);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-border bg-white shadow-xl p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h3 className="mb-1 text-base font-bold text-text-primary">Delete user?</h3>
        <p className="mb-5 text-sm text-text-muted leading-relaxed">
          <strong className="text-text-primary">{target.name}</strong> ({target.email}) will be
          permanently removed. This cannot be undone.
        </p>
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
            <AlertCircle size={13} className="shrink-0" /> {error}
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition-colors">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function UsersPage() {
  const { user: me, token } = useAuth();
  const router = useRouter();

  const [userList, setUserList]         = useState<User[]>([]);
  const [tenants, setTenants]           = useState<Tenant[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [search, setSearch]             = useState('');
  const [roleTab, setRoleTab]           = useState<UserRole | 'all'>('all');
  const [showCreate, setShowCreate]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  useEffect(() => {
    if (me && me.role !== 'admin' && me.role !== 'tenant_admin') router.replace('/dashboard');
  }, [me, router]);

  const fetchAll = useCallback(async () => {
    if (!token || !me) return;
    setLoading(true);
    setError('');
    try {
      const isAdmin = me.role === 'admin';
      const [usersRes, tenantsRes] = await Promise.all([
        usersApi.getAll(token),
        isAdmin ? tenantsApi.getAll(token) : Promise.resolve({ tenants: [] }),
      ]);
      setUserList(usersRes.data);
      setTenants(tenantsRes.tenants);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, me]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const isAdmin  = me?.role === 'admin';
  // tenant_admin should not see admin users
  const visibleUsers = isAdmin ? userList : userList.filter((u) => u.role !== 'admin');
  const byRole   = roleTab === 'all' ? visibleUsers : visibleUsers.filter((u) => u.role === roleTab);
  const filtered = byRole.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.tenant_name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const counts = ALL_ROLES.reduce<Record<string, number>>((acc, r) => {
    acc[r] = userList.filter((u) => u.role === r).length;
    return acc;
  }, {});

  const patchUser  = useCallback((updated: User) =>
    setUserList((prev) => prev.map((u) => (u.id === updated.id ? updated : u))), []);

  const removeUser = useCallback((id: number) => {
    setUserList((prev) => prev.filter((u) => u.id !== id));
    setDeleteTarget(null);
  }, []);

  const addUser = useCallback((u: User) => {
    setUserList((prev) => [u, ...prev]);
    setShowCreate(false);
  }, []);

  return (
    <div className="max-w-6xl space-y-6">

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-text-primary">User Management</h2>
          <p className="mt-0.5 text-sm text-text-muted">{userList.length} total users</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={fetchAll}
            className="flex items-center gap-2 rounded-lg border border-neutral-border bg-white px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors">
            <RefreshCw size={14} /> <span className="hidden sm:inline">Refresh</span>
          </button>
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm">
            <Plus size={15} /> <span className="hidden sm:inline">Create</span><span className="sm:hidden">+</span> User
          </button>
        </div>
      </div>

      <div className={`grid gap-3 grid-cols-2 ${isAdmin ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {ALL_ROLES.filter((r) => isAdmin || r !== 'admin').map((r) => (
          <button key={r} type="button" onClick={() => setRoleTab(r)}
            className={cn(
              'rounded-xl border p-4 text-left transition-all',
              roleTab === r ? 'border-primary-blue bg-blue-50 shadow-sm' : 'border-neutral-border bg-white hover:bg-bg-secondary',
            )}>
            {loading
              ? <div className="h-8 w-10 animate-pulse rounded-lg bg-neutral-100 mb-2" />
              : <p className="text-2xl font-bold text-text-primary mb-1.5">{counts[r] ?? 0}</p>
            }
            <RoleBadge role={r} />
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex flex-wrap rounded-xl border border-neutral-border bg-white p-1 gap-0.5">
          {ROLE_TABS.filter((t) => isAdmin || t.key !== 'admin').map((t) => (
            <button key={t.key} type="button" onClick={() => setRoleTab(t.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap',
                roleTab === t.key
                  ? 'bg-gradient-to-r from-primary-blue to-primary-purple text-white shadow-sm'
                  : 'text-text-muted hover:text-text-secondary',
              )}>
              {t.label}
              {t.key !== 'all' && (
                <span className={cn('ml-1.5 rounded-full px-1.5 text-[10px]',
                  roleTab === t.key ? 'bg-white/25' : 'bg-neutral-100 text-text-muted')}>
                  {counts[t.key] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or tenant..."
            className="w-full rounded-lg border border-neutral-border bg-white py-2 pl-9 pr-4 text-sm placeholder:text-text-muted outline-none focus:border-primary-blue focus:ring-2 focus:ring-blue-500/20 transition-colors" />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-border bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-border px-6 py-3.5">
          <h3 className="text-sm font-semibold text-text-primary">
            {roleTab === 'all' ? 'All Users' : (ROLE_META[roleTab as UserRole]?.label ?? '') + 's'}
          </h3>
          <span className="text-xs text-text-muted">{filtered.length} shown</span>
        </div>

        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-border bg-bg-secondary">
                  {['User','Role',...(isAdmin ? ['Tenant'] : []),'Phone','Delete'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {[...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-100 shrink-0" />
                        <div>
                          <div className="h-3.5 w-28 animate-pulse rounded bg-neutral-100 mb-1.5" />
                          <div className="h-3 w-36 animate-pulse rounded bg-neutral-100" />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><div className="h-5 w-24 animate-pulse rounded-full bg-neutral-100" /></td>
                    <td className="px-5 py-3.5"><div className="h-7 w-28 animate-pulse rounded-lg bg-neutral-100" /></td>
                    <td className="px-5 py-3.5"><div className="h-3.5 w-28 animate-pulse rounded bg-neutral-100" /></td>
                    <td className="px-5 py-3.5"><div className="h-7 w-16 animate-pulse rounded-lg bg-neutral-100" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-sm text-red-500">{error}</p>
            <button type="button" onClick={fetchAll} className="text-sm text-primary-blue hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-24 text-center text-sm text-text-muted">
            {search ? 'No users match your search' : 'No users found'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-border bg-bg-secondary">
                  {['User', 'Role', ...(isAdmin ? ['Tenant'] : []), 'Phone', 'Delete'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {filtered.map((u) => {
                  const isMe = me?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-bg-secondary/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-blue to-primary-purple text-sm font-bold text-white">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-text-primary truncate">{u.name}</p>
                              {isMe && <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">You</span>}
                            </div>
                            <p className="text-xs text-text-muted truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {token && <RoleSelector userId={u.id} current={u.role} token={token} onChanged={patchUser} disabled={isMe} />}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3.5">
                          {token && <TenantSelector userId={u.id} currentTenantId={u.tenant_id} token={token} tenants={tenants} onChanged={patchUser} />}
                        </td>
                      )}
                      <td className="px-5 py-3.5 font-mono text-xs text-text-muted">
                        {u.phone_number ?? '-'}
                      </td>
                      <td className="px-5 py-3.5">
                        {!isMe && (
                          <button type="button" onClick={() => setDeleteTarget(u)}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:border-red-400 transition-all">
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && token && (
        <CreateUserModal token={token} tenants={tenants} onClose={() => setShowCreate(false)} onCreated={addUser} currentUserRole={me?.role ?? ''} />
      )}

      {deleteTarget && token && (
        <DeleteConfirm target={deleteTarget} token={token} onClose={() => setDeleteTarget(null)} onDeleted={removeUser} />
      )}
    </div>
  );
}
