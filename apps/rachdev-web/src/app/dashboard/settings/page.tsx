'use client';

import { useEffect, useState } from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { workspace } from '@rach/ui/lib/api';
import { industryModules } from '@/config/dashboard/registry';

// Options come from the dashboard registry — registering an industry there makes
// it selectable here, with its module list as the hint.
const INDUSTRY_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: '', label: 'None', hint: 'No workspace — just the basics.' },
  ...Object.values(industryModules).map((m) => ({
    value: m.id,
    label: m.label,
    hint: `${m.label} workspace: ${m.modules.map((x) => x.label).join(', ')}.`,
  })),
];

export default function WorkspaceSettingsPage() {
  const { user, token, updateUser } = useAuth();
  const [industry, setIndustry] = useState<string>(user?.tenant_industry ?? '');
  const [military, setMilitary] = useState(false);
  const [loadedMilitary, setLoadedMilitary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Load the authoritative value from the server on mount.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const { tenant } = await workspace.get(token);
        if (!cancelled) { setIndustry(tenant?.industry ?? ''); setMilitary(Boolean(tenant?.military)); setLoadedMilitary(Boolean(tenant?.military)); }
      } catch {
        /* fall back to the value from the session */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setNotice(null);
    try {
      const value = industry || null;
      const { tenant } = await workspace.setIndustry(token, value);
      // Reflect it in the session immediately so the workspace nav updates.
      updateUser({ tenant_industry: tenant?.industry ?? null });
      if (industry === 'healthcare') { await workspace.setHealthcare(token, military); setLoadedMilitary(military); }
      setNotice({ type: 'success', msg: 'Workspace updated. Your navigation reflects the change.' });
    } catch (err) {
      setNotice({ type: 'error', msg: (err as Error).message || 'Failed to update workspace.' });
    } finally {
      setSaving(false);
    }
  };

  const dirty = (user?.tenant_industry ?? '') !== industry || (industry === 'healthcare' && military !== loadedMilitary);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-neutral-border bg-surface-card p-8">
        <h2 className="text-xl font-semibold text-dash-heading">Workspace</h2>
        <p className="mt-1 text-sm text-dash-body">
          Choose the industry workspace for your organisation
          {user?.tenant_name ? <> (<span className="font-medium">{user.tenant_name}</span>)</> : null}.
          This decides which agent workspace your team sees.
        </p>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-dash-muted">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {INDUSTRY_OPTIONS.map((opt) => {
              const selected = industry === opt.value;
              return (
                <button
                  key={opt.value || 'none'}
                  type="button"
                  onClick={() => setIndustry(opt.value)}
                  className={
                    'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ' +
                    (selected
                      ? 'border-accent bg-accent-weak'
                      : 'border-neutral-border hover:border-neutral-border hover:bg-surface-hover')
                  }
                >
                  <span
                    className={
                      'mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ' +
                      (selected ? 'border-accent bg-accent text-white' : 'border-dash-muted')
                    }
                  >
                    {selected && <Check size={11} />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-dash-heading">{opt.label}</span>
                    <span className="block text-xs text-dash-muted">{opt.hint}</span>
                  </span>
                </button>
              );
            })}

            {industry === 'healthcare' && (
              <div className="rounded-xl border border-neutral-border p-4">
                <p className="text-sm font-medium text-dash-heading">Hospital type</p>
                <p className="mb-3 text-xs text-dash-muted">Military hospitals (AFMS) capture service details (rank, unit, Arms/Corps, ECHS, validity) on patient registration.</p>
                <div className="flex gap-2">
                  {[{ v: false, label: 'Non-military' }, { v: true, label: 'Military (AFMS)' }].map((o) => (
                    <button key={String(o.v)} type="button" onClick={() => setMilitary(o.v)}
                      className={'rounded-lg border px-4 py-2 text-sm font-medium transition-colors ' + (military === o.v ? 'border-accent bg-accent-weak text-accent' : 'border-neutral-border text-dash-body hover:bg-surface-hover')}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {notice && (
              <div
                className={
                  'flex items-center gap-2 rounded-xl px-4 py-3 text-sm ' +
                  (notice.type === 'success'
                    ? 'border border-ok-line bg-ok-bg text-ok'
                    : 'border border-red-200 bg-red-50 text-red-600')
                }
              >
                {notice.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
                {notice.msg}
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={save}
                disabled={saving || !dirty}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
