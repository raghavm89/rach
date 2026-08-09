'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Users as UsersIcon, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { users as usersApi, admin, type User, type UserRole, type UsersResponse, type Org, type DoctorProfile } from '@rach/ui/lib/api';
import { Modal, Field, inputCls } from '@/components/dashboard/Modal';
import { industryModules } from '@/config/dashboard/registry';
import { DEPARTMENTS } from '@/config/clinical';

// Roles that apply regardless of workspace.
const BASE_ROLES_TENANT = ['tenant_admin', 'tenant_user', 'developer'];
const BASE_ROLES_NONE = ['admin', ...BASE_ROLES_TENANT];

// Labels for every role across workspaces (cast at the API boundary since the
// shared UserRole union stays narrow).
const ROLE_LABEL: Record<string, string> = {
  admin: 'RachDev Admin',
  tenant_admin: 'Org Admin',
  tenant_user: 'Member',
  developer: 'Developer',
  doctor: 'Doctor',
  reception: 'Reception',
  store_manager: 'Store Manager',
  hr_executive: 'HR Executive',
  hr_director: 'HR Director',
  project_manager: 'Project Manager',
};

const emptyForm = { name: '', email: '', password: '', phone_number: '', role: 'tenant_user', tenant_id: '', department: '' };

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [depts, setDepts] = useState<Record<number, string | null>>({}); // userId → department
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [orgFilter, setOrgFilter] = useState('all');

  // Add-user modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!token) return;
    Promise.all([usersApi.getAll(token), admin.orgs(token), admin.doctorProfiles(token)])
      .then(([u, o, d]: [UsersResponse, { orgs: Org[] }, { profiles: DoctorProfile[] }]) => {
        setRows(u.data); setOrgs(o.orgs);
        setDepts(Object.fromEntries(d.profiles.map((p) => [p.user_id, p.department])));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const setDepartment = async (u: User, department: string) => {
    if (!token) return;
    setSavingId(u.id); setError('');
    try {
      await admin.setDoctorProfile(token, u.id, department || null);
      setDepts((m) => ({ ...m, [u.id]: department || null }));
    } catch (e) { setError((e as Error).message); } finally { setSavingId(null); }
  };

  const changeRole = async (u: User, role: string) => {
    if (!token || role === u.role) return;
    setSavingId(u.id); setError('');
    try {
      const { user } = await usersApi.updateRole(token, u.id, role as UserRole);
      setRows((list) => list.map((x) => (x.id === user.id ? { ...x, role: user.role } : x)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const deleteUser = async (u: User) => {
    if (!token || !window.confirm(`Delete ${u.name} (${u.email})? This cannot be undone.`)) return;
    setDeletingId(u.id); setError('');
    try {
      await usersApi.remove(token, u.id);
      setRows((list) => list.filter((x) => x.id !== u.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const visible = useMemo(() => rows.filter((u) => {
    if (orgFilter === 'all') return true;
    if (orgFilter === 'none') return u.tenant_id == null;
    return u.tenant_id === Number(orgFilter);
  }), [rows, orgFilter]);

  const set = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Roles assignable for a given org = base roles + that org's workspace roles.
  const rolesForTenant = (tenantId: number | null): string[] => {
    const org = tenantId ? orgs.find((o) => o.id === tenantId) : null;
    const industry = org?.industry ?? null;
    const base = tenantId ? BASE_ROLES_TENANT : BASE_ROLES_NONE;
    const ind = industry && industryModules[industry]?.roleLabels
      ? Object.keys(industryModules[industry].roleLabels as Record<string, string>)
      : [];
    return [...base, ...ind];
  };

  // Change org in the modal; keep the selected role valid for the new workspace.
  const setTenant = (v: string) => {
    const roles = rolesForTenant(v ? Number(v) : null);
    setForm((f) => ({ ...f, tenant_id: v, role: roles.includes(f.role) ? f.role : (roles[0] ?? 'tenant_user') }));
  };

  const createUser = async () => {
    if (!token) return;
    setCreating(true); setCreateError('');
    try {
      const { user } = await usersApi.create(token, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone_number: form.phone_number.trim(),
        role: form.role as UserRole,
        tenant_id: form.tenant_id ? Number(form.tenant_id) : null,
      });
      // For a doctor, persist the chosen department into their profile.
      if (form.role === 'doctor' && form.department) {
        try { await admin.setDoctorProfile(token, user.id, form.department); setDepts((m) => ({ ...m, [user.id]: form.department })); }
        catch { /* non-fatal: department can be set from the table afterwards */ }
      }
      const orgName = orgs.find((o) => o.id === user.tenant_id)?.name ?? null;
      setRows((list) => [{ ...user, tenant_name: user.tenant_name ?? orgName }, ...list]);
      setShowCreate(false); setForm(emptyForm);
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.name.trim() && form.email.trim() && form.password.length >= 8 && form.phone_number.trim();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UsersIcon size={20} className="text-accent" />
          <h2 className="text-xl font-semibold text-dash-heading">Users</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-dash-muted">
            Organization
            <select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}
              className="rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-body focus:border-accent focus:outline-none">
              <option value="all">All</option>
              <option value="none">No organization</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <button
            onClick={() => { setCreateError(''); setForm(emptyForm); setShowCreate(true); }}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus size={15} /> Add User
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-border text-left text-xs uppercase tracking-wide text-dash-muted">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id} className="border-b border-neutral-border last:border-0">
                  <td className="px-4 py-3 font-medium text-dash-heading">{u.name}</td>
                  <td className="px-4 py-3 text-dash-body">{u.email}</td>
                  <td className="px-4 py-3 text-dash-body">{u.tenant_name ?? <span className="text-dash-muted">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={u.role}
                        disabled={savingId === u.id}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className="rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-body focus:border-accent focus:outline-none disabled:opacity-50"
                      >
                        {Array.from(new Set([u.role, ...rolesForTenant(u.tenant_id ?? null)])).map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
                      </select>
                      {savingId === u.id && <Loader2 size={14} className="animate-spin text-dash-muted" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'doctor' ? (
                      <select value={depts[u.id] ?? ''} disabled={savingId === u.id} onChange={(e) => setDepartment(u, e.target.value)}
                        className="rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-body focus:border-accent focus:outline-none disabled:opacity-50">
                        <option value="">Unassigned</option>
                        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    ) : <span className="text-dash-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteUser(u)} disabled={deletingId === u.id} aria-label="Delete user"
                      className="rounded-md p-1 text-dash-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                      {deletingId === u.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-dash-muted">No users{orgFilter !== 'all' ? ' in this filter' : ''}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal
          title="Add User"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-dash-body hover:bg-surface-hover">Cancel</button>
              <button onClick={createUser} disabled={creating || !canSubmit} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {creating && <Loader2 size={14} className="animate-spin" />} Create User
              </button>
            </>
          }
        >
          {createError && <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{createError}</div>}
          <Field label="Name"><input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} /></Field>
          <Field label="Password (min 8 chars)"><input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} className={inputCls} /></Field>
          <Field label="Phone number"><input value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} placeholder="+91…" className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Organization">
              <select value={form.tenant_id} onChange={(e) => setTenant(e.target.value)} className={inputCls}>
                <option value="">None</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}{o.industry ? ` · ${industryModules[o.industry]?.label ?? o.industry}` : ''}</option>)}
              </select>
            </Field>
            <Field label="Role">
              <select value={form.role} onChange={(e) => set('role', e.target.value)} className={inputCls}>
                {rolesForTenant(form.tenant_id ? Number(form.tenant_id) : null).map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
              </select>
            </Field>
          </div>
          {form.role === 'doctor' && (
            <Field label="Department">
              <select value={form.department} onChange={(e) => set('department', e.target.value)} className={inputCls}>
                <option value="">Select department</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          )}
        </Modal>
      )}
    </div>
  );
}
