'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes, Loader2, KeyRound, ExternalLink, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { projects as api, type BaasLimits, type BaasProjectSummary } from '@rach/ui/lib/api';

/**
 * Tenant-level Backend (BaaS) overview. Backends are per-project (isolated); the plan grants
 * how many. Lists the tenant's projects with their BaaS state, enable action, and plan usage.
 */
export default function BackendPage() {
  const { token } = useAuth();
  const [plan, setPlan] = useState('');
  const [limits, setLimits] = useState<BaasLimits | null>(null);
  const [used, setUsed] = useState(0);
  const [rows, setRows] = useState<BaasProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const o = await api.baasOverview(token);
      setPlan(o.plan); setLimits(o.limits); setUsed(o.used.projects); setRows(o.projects); setErr('');
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  async function enable(id: number) {
    if (!token) return;
    setBusy(id); setErr('');
    try { await api.enableBaas(token, id); await load(); }
    catch (e) { setErr((e as Error).message || 'Could not enable'); }
    finally { setBusy(null); }
  }

  const atLimit = limits ? used >= limits.projects : false;

  return (
    <div className="max-w-4xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary-blue"><Boxes size={22} /></div>
        <div>
          <h2 className="text-xl font-bold font-display text-text-primary">Backend</h2>
          <p className="text-xs text-text-muted">Auth, Data, Storage &amp; Functions for your apps&apos; end-users — one isolated backend per project.</p>
        </div>
        {limits && (
          <span className="ml-auto rounded-full border border-neutral-border px-3 py-1 text-xs text-text-secondary">
            {used}/{limits.projects} backend{limits.projects === 1 ? '' : 's'} · {plan}
          </span>
        )}
      </div>

      {err && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{err}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-text-muted"><Loader2 className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-8 text-center">
          <p className="text-sm text-text-muted">No projects yet. Create a project first, then enable its backend here.</p>
          <Link href="/dashboard/projects" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Go to Projects <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-border rounded-2xl border border-neutral-border bg-surface-card">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">{p.name}</p>
                {p.baas_enabled && p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-primary-blue hover:underline">
                    {p.url.replace('https://', '')} <ExternalLink size={11} />
                  </a>
                ) : (
                  <p className="text-xs text-text-muted">Backend not enabled</p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {p.baas_enabled ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check size={13} /> Enabled</span>
                    <Link href={`/dashboard/backend/${p.id}`} className="rounded-full border border-neutral-border px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg-secondary">
                      Manage
                    </Link>
                  </>
                ) : (
                  <button onClick={() => enable(p.id)} disabled={busy === p.id || atLimit}
                    title={atLimit ? `Your ${plan} plan allows ${limits?.projects} backend project(s).` : ''}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary-blue px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />} Enable
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {atLimit && (
        <p className="mt-3 text-xs text-text-muted">
          You&apos;ve used all {limits?.projects} backend project{limits?.projects === 1 ? '' : 's'} on the {plan} plan.{' '}
          <Link href="/dashboard/billing" className="text-primary-blue hover:underline">Upgrade</Link> to add more.
        </p>
      )}
    </div>
  );
}
