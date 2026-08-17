'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Users, UserPlus, Trash2, RefreshCw, AlertCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { users as usersApi, type User, type UserRole } from '@rach/ui/lib/api';
import { industryModules } from '@/config/dashboard/registry';
import { PageHeader } from '@/components/dashboard/PageHeader';

const BASE_ROLES: { value: UserRole; label: string }[] = [
  { value: 'tenant_user', label: 'Member' },
  { value: 'tenant_admin', label: 'Org Admin' },
];

const emptyForm = { name: '', email: '', phone_number: '', password: '', role: 'tenant_user' as UserRole };

export default function MembersPage() {
  const { token, user } = useAuth();
  const [list, setList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);

  // Role options = Member/Org Admin + the tenant's industry roles (Doctor,
  // Reception, …) so staff can be given the right workspace access.
  const roleOptions = useMemo(() => {
    const labels = (user?.tenant_industry && industryModules[user.tenant_industry]?.roleLabels) || {};
    const industryRoles = Object.entries(labels).map(([value, label]) => ({ value: value as UserRole, label }));
    return [...BASE_ROLES, ...industryRoles];
  }, [user?.tenant_industry]);
  const roleLabel = (r: string) => roleOptions.find((o) => o.value === r)?.label ?? r.replace(/_/g, ' ');

  const load = useCallback(async () => {
    if (!token) return;
    try { setError(''); setList((await usersApi.getAll(token)).data); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function addMember() {
    if (!token) return;
    if (!form.name.trim() || !form.email.trim() || !form.phone_number.trim() || form.password.length < 8) {
      toast.error('Name, email, phone and a password of 8+ characters are required.');
      return;
    }
    setAdding(true);
    try {
      await usersApi.create(token, {
        name: form.name.trim(), email: form.email.trim(), phone_number: form.phone_number.trim(),
        password: form.password, role: form.role,
      });
      toast.success(`${roleLabel(form.role)} added`);
      setForm(emptyForm); setOpen(false); load();
    } catch (e) { toast.error((e as Error).message || 'Could not add member'); }
    finally { setAdding(false); }
  }

  async function removeMember(u: User) {
    if (!token) return;
    if (!confirm(`Remove ${u.name} (${u.email}) from the workspace?`)) return;
    try { await usersApi.remove(token, u.id); toast.success('Member removed'); load(); }
    catch (e) { toast.error((e as Error).message || 'Could not remove member'); }
  }

  async function changeRole(u: User, role: UserRole) {
    if (!token || role === u.role) return;
    // Optimistic update; revert on failure.
    setList((prev) => prev.map((m) => (m.id === u.id ? { ...m, role } : m)));
    try { await usersApi.updateRole(token, u.id, role); toast.success(`${u.name} is now ${roleLabel(role)}`); }
    catch (e) { toast.error((e as Error).message || 'Could not change role'); load(); }
  }

  const inputCls = 'w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none';

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Members"
        subtitle="Add or remove people in your workspace and set whether they're a Member or an Org Admin."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => { setLoading(true); load(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              <UserPlus size={15} /> Add member
            </button>
          </div>
        }
      />

      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle size={15} /> {error}</div>}

      {open && (
        <div className="mb-6 rounded-2xl border border-neutral-border bg-surface-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-dash-heading"><UserPlus size={15} /> Add a member</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className={inputCls} />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" className={inputCls} />
            <input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="Phone (+91…)" className={inputCls} />
            <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password (8+ chars)" type="text" className={inputCls} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} className={inputCls}>
              {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="flex items-center">
              <button onClick={addMember} disabled={adding} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {adding ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Add member
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-dash-muted">They sign in with this email + password and can change it afterwards. Org Admins can manage members, billing and agents.</p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <div className="flex items-center gap-2 border-b border-neutral-border px-5 py-3">
          <Users size={15} className="text-accent" />
          <h3 className="text-sm font-semibold text-dash-heading">Workspace members {loading ? '' : `(${list.length})`}</h3>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {loading ? (
              <tr><td className="px-5 py-8 text-center text-dash-muted">Loading…</td></tr>
            ) : list.length === 0 ? (
              <tr><td className="px-5 py-8 text-center text-dash-muted">No members yet.</td></tr>
            ) : list.map((u) => (
              <tr key={u.id} className="border-b border-neutral-border last:border-0">
                <td className="px-5 py-3">
                  <div className="font-medium text-dash-heading">{u.name}{u.id === user?.id && <span className="ml-2 text-[11px] text-dash-muted">(you)</span>}</div>
                  <div className="text-xs text-dash-muted">{u.email}</div>
                </td>
                <td className="px-3 py-3">
                  {u.id === user?.id ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${u.role === 'tenant_admin' ? 'bg-accent-weak text-accent' : 'bg-surface-hover text-dash-muted'}`}>
                      {u.role === 'tenant_admin' && <Shield size={11} />} {roleLabel(u.role)}
                    </span>
                  ) : (
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as UserRole)}
                      className="rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-xs text-dash-heading focus:border-accent focus:outline-none"
                      aria-label={`Role for ${u.name}`}
                    >
                      {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      {/* Preserve an unknown current role as a selectable option so it isn't lost. */}
                      {!roleOptions.some((o) => o.value === u.role) && <option value={u.role}>{u.role.replace(/_/g, ' ')}</option>}
                    </select>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {u.id !== user?.id && (
                    <button onClick={() => removeMember(u)} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-2.5 py-1 text-xs text-dash-body hover:bg-surface-hover">
                      <Trash2 size={13} /> Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
