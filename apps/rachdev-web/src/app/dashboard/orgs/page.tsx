'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Building2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { admin, type Org } from '@rach/ui/lib/api';
import { industryModules } from '@/config/dashboard/registry';
import { Modal, Field, inputCls } from '@/components/dashboard/Modal';

const INDUSTRY_OPTIONS = [
  { value: '', label: 'None' },
  ...Object.values(industryModules).map((m) => ({ value: m.id, label: m.label })),
];

const WORKSPACE_FILTERS = [
  { value: 'all', label: 'All workspaces' },
  { value: 'none', label: 'None' },
  ...Object.values(industryModules).map((m) => ({ value: m.id, label: m.label })),
];

// Matches the @rach/llm model catalog. Empty = platform default.
const MODEL_OPTIONS = [
  { value: '', label: 'Default (platform)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { value: 'sarvam-105b', label: 'On-prem · Sarvam 105B' },
  { value: 'sarvam-30b', label: 'On-prem · Sarvam 30B' },
];

export default function OrgsPage() {
  const { token } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingModelId, setSavingModelId] = useState<number | null>(null);
  const [savingMilId, setSavingMilId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [workspace, setWorkspace] = useState('all');

  // Create-org modal
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [industry, setIndustryValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!token) return;
    admin.orgs(token)
      .then((r: { orgs: Org[] }) => setOrgs(r.orgs))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const visible = useMemo(() => orgs.filter((o) => {
    if (workspace === 'all') return true;
    if (workspace === 'none') return !o.industry;
    return o.industry === workspace;
  }), [orgs, workspace]);

  const setIndustry = async (org: Org, next: string) => {
    if (!token) return;
    setSavingId(org.id); setError('');
    try {
      const { org: updated } = await admin.setOrgIndustry(token, org.id, next || null);
      setOrgs((list) => list.map((o) => (o.id === updated.id ? { ...o, industry: updated.industry } : o)));
    } catch (e) { setError((e as Error).message); } finally { setSavingId(null); }
  };

  const setModel = async (org: Org, next: string) => {
    if (!token) return;
    setSavingModelId(org.id); setError('');
    try {
      const { org: updated } = await admin.setOrgModel(token, org.id, next || null);
      setOrgs((list) => list.map((o) => (o.id === org.id ? { ...o, llm_model: updated.llm_model } : o)));
    } catch (e) { setError((e as Error).message); } finally { setSavingModelId(null); }
  };

  const setMilitary = async (org: Org, military: boolean) => {
    if (!token) return;
    setSavingMilId(org.id); setError('');
    try {
      const { org: updated } = await admin.setOrgHealthcare(token, org.id, military);
      setOrgs((list) => list.map((o) => (o.id === org.id ? { ...o, military: updated.military } : o)));
    } catch (e) { setError((e as Error).message); } finally { setSavingMilId(null); }
  };

  const deleteOrg = async (org: Org) => {
    if (!token || !window.confirm(`Delete "${org.name}" and all ${org.user_count} of its users? This cannot be undone.`)) return;
    setDeletingId(org.id); setError('');
    try {
      await admin.deleteOrg(token, org.id);
      setOrgs((list) => list.filter((o) => o.id !== org.id));
    } catch (e) { setError((e as Error).message); } finally { setDeletingId(null); }
  };

  const createOrg = async () => {
    if (!token || !name.trim()) return;
    setCreating(true); setCreateError('');
    try {
      const { org } = await admin.createOrg(token, { name: name.trim(), industry: industry || null });
      setOrgs((list) => [org, ...list]);
      setShowCreate(false); setName(''); setIndustryValue('');
    } catch (e) { setCreateError((e as Error).message); } finally { setCreating(false); }
  };

  const selCls = 'rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-body focus:border-accent focus:outline-none disabled:opacity-50';

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 size={20} className="text-accent" />
          <h2 className="text-xl font-semibold text-dash-heading">Organizations</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-dash-muted">
            Workspace
            <select value={workspace} onChange={(e) => setWorkspace(e.target.value)} className={selCls}>
              {WORKSPACE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <button onClick={() => { setCreateError(''); setShowCreate(true); }}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Plus size={15} /> New Organization
          </button>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-border text-left text-xs uppercase tracking-wide text-dash-muted">
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">Workspace</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold">Users</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={o.id} className="border-b border-neutral-border last:border-0">
                  <td className="px-4 py-3 font-medium text-dash-heading">{o.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select value={o.industry ?? ''} disabled={savingId === o.id} onChange={(e) => setIndustry(o, e.target.value)} className={selCls}>
                        {INDUSTRY_OPTIONS.map((opt) => <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>)}
                      </select>
                      {savingId === o.id && <Loader2 size={14} className="animate-spin text-dash-muted" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {o.industry === 'healthcare' ? (
                      <div className="flex items-center gap-2">
                        <select value={o.military ? 'mil' : 'civ'} disabled={savingMilId === o.id} onChange={(e) => setMilitary(o, e.target.value === 'mil')} className={selCls}>
                          <option value="civ">Non-military</option>
                          <option value="mil">Military (AFMS)</option>
                        </select>
                        {savingMilId === o.id && <Loader2 size={14} className="animate-spin text-dash-muted" />}
                      </div>
                    ) : <span className="text-dash-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select value={o.llm_model ?? ''} disabled={savingModelId === o.id} onChange={(e) => setModel(o, e.target.value)} className={selCls}>
                        {MODEL_OPTIONS.map((m) => <option key={m.value || 'default'} value={m.value}>{m.label}</option>)}
                      </select>
                      {savingModelId === o.id && <Loader2 size={14} className="animate-spin text-dash-muted" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-dash-body">{o.user_count}</td>
                  <td className="px-4 py-3 text-dash-muted">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteOrg(o)} disabled={deletingId === o.id} aria-label="Delete organization"
                      className="rounded-md p-1 text-dash-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                      {deletingId === o.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-dash-muted">No organizations{workspace !== 'all' ? ' in this workspace' : ' yet'}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-dash-muted">Workspace unlocks that industry&apos;s dashboard; Model sets which Claude (or on-prem) model the org&apos;s agents run on. Deleting an org removes all its users and data.</p>

      {showCreate && (
        <Modal
          title="New Organization"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-dash-body hover:bg-surface-hover">Cancel</button>
              <button onClick={createOrg} disabled={creating || !name.trim()} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {creating && <Loader2 size={14} className="animate-spin" />} Create
              </button>
            </>
          }
        >
          {createError && <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{createError}</div>}
          <Field label="Organization name">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Corp" className={inputCls} onKeyDown={(e) => { if (e.key === 'Enter') createOrg(); }} />
          </Field>
          <Field label="Workspace (industry)">
            <select value={industry} onChange={(e) => setIndustryValue(e.target.value)} className={inputCls}>
              {INDUSTRY_OPTIONS.map((opt) => <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>)}
            </select>
          </Field>
        </Modal>
      )}
    </div>
  );
}
