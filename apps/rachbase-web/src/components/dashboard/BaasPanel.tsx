'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Copy, Check, Boxes, KeyRound, ExternalLink, Plus, Trash2, ShieldAlert, Cpu, Sparkles } from 'lucide-react';
import { projects as api, type BaasConfig, type BaasApiKey, type BaasCompute } from '@rach/ui/lib/api';
import { PRO } from '@rach/ui/lib/catalog';

/**
 * A project's backend keys — Supabase's current model: one PUBLISHABLE key (public, ships in
 * client apps) plus any number of SECRET keys (server-side only), each revocable individually.
 * Secret keys are shown once at creation; only their last 4 chars are stored for display.
 */
export default function BaasPanel({ token, projectId }: { token: string; projectId: number }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<BaasConfig | null>(null);
  const [keys, setKeys] = useState<BaasApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [err, setErr] = useState('');

  // A newly minted secret key, shown ONCE (plaintext) until dismissed.
  const [freshSecret, setFreshSecret] = useState<BaasApiKey | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const [compute, setCompute] = useState<BaasCompute | null>(null);
  const [resizing, setResizing] = useState(false);
  const [vector, setVector] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await api.getBaas(token, projectId); if (alive) { setCfg(r.baas); setKeys(r.keys); setCompute(r.compute); setVector(Boolean(r.capabilities?.vector)); } }
      catch { /* 404 = not enabled (or feature off) → show the enable card */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [token, projectId]);

  // Pay-first resize. An upsize (positive delta) goes to the shared billing checkout, where
  // the server prices the delta + opens Razorpay; a same-size / downsize is free and applied
  // in place. The display delta is from the catalog; the server is the pricing authority.
  async function resize(size: string) {
    if (!compute || size === compute.size) return;
    const cs = PRO.compute_sizes as Record<string, { delta_cents: number }>;
    const deltaCents = ((cs[size]?.delta_cents ?? 0) - (cs[compute.size]?.delta_cents ?? 0)) * compute.containers;
    if (deltaCents > 0) {
      const qs = new URLSearchParams({ pro: 'baas', project: String(projectId), size, amount: String(deltaCents), currency: 'USD' });
      router.push(`/dashboard/billing/checkout?${qs.toString()}`);
      return;
    }
    setResizing(true); setErr('');
    try { const r = await api.baasSetCompute(token, projectId, size); setCompute(r.compute); } // free / downsize
    catch (e) { setErr((e as Error).message); }
    finally { setResizing(false); }
  }

  async function enable() {
    setEnabling(true); setErr('');
    try { const r = await api.enableBaas(token, projectId); setCfg(r.baas); setKeys(r.keys); }
    catch (e) { setErr((e as Error).message || 'Could not enable'); }
    finally { setEnabling(false); }
  }

  async function createSecret() {
    setCreating(true); setErr('');
    try {
      const r = await api.baasCreateSecretKey(token, projectId, newName.trim() || 'secret');
      setFreshSecret(r.key); setNewName('');
      const list = await api.baasKeys(token, projectId); setKeys(list.keys);
    } catch (e) { setErr((e as Error).message); }
    finally { setCreating(false); }
  }

  async function revoke(id: number) {
    setErr('');
    try { const r = await api.baasRevokeKey(token, projectId, id); setKeys(r.keys); }
    catch (e) { setErr((e as Error).message); }
  }

  if (loading) return null;

  const publishable = keys.find((k) => k.type === 'publishable' && !k.revoked_at);
  const secrets = keys.filter((k) => k.type === 'secret');

  return (
    <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-primary-blue"><Boxes size={18} /></div>
        <div>
          <p className="text-sm font-semibold text-text-primary">Backend (BaaS)</p>
          <p className="text-xs text-text-muted">Auth, Data, Storage &amp; Functions for your app&apos;s end-users, behind one project URL.</p>
        </div>
      </div>

      {err && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {!cfg ? (
        <>
          <p className="text-sm text-text-secondary">
            Turn this project into a backend: a project URL plus a public <span className="font-mono">publishable</span> key
            for your client app and revocable <span className="font-mono">secret</span> keys for your servers.
          </p>
          <button onClick={enable} disabled={enabling}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {enabling ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Enable backend
          </button>
        </>
      ) : (
        <div className="space-y-5">
          <Field label="Project URL" value={cfg.url} link />
          <Field label="Project ref" value={cfg.ref} mono />

          <div>
            <span className="mb-1 block text-xs font-medium text-text-secondary">Publishable key (public)</span>
            {publishable?.key
              ? <CopyRow value={publishable.key} copyValue={publishable.key} />
              : <p className="text-xs text-text-muted">No active publishable key.</p>}
            <p className="mt-1 text-xs text-text-muted">Safe to ship in browser &amp; mobile apps. Access is governed by your row-level policies.</p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">Secret keys (server-side only)</span>
              <div className="flex items-center gap-1.5">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="name (optional)"
                  className="w-32 rounded-lg border border-neutral-border px-2 py-1 text-xs" />
                <button onClick={createSecret} disabled={creating}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-blue px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} New secret key
                </button>
              </div>
            </div>

            {freshSecret?.key && (
              <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-800"><ShieldAlert size={13} /> Copy this now — it won&apos;t be shown again.</div>
                <CopyRow value={freshSecret.key} copyValue={freshSecret.key} />
                <button onClick={() => setFreshSecret(null)} className="mt-1.5 text-xs text-amber-700 hover:underline">Done</button>
              </div>
            )}

            {secrets.length === 0 ? (
              <p className="rounded-lg border border-neutral-border bg-bg-secondary px-3 py-2 text-xs text-text-muted">
                No secret keys yet. Create one for your server code — it bypasses row-level policies, so never expose it client-side.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-border rounded-lg border border-neutral-border">
                {secrets.map((k) => (
                  <li key={k.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <KeyRound size={13} className="text-text-muted" />
                    <span className="text-text-primary">{k.name}</span>
                    <span className="font-mono text-xs text-text-muted">rb_secret_…{k.last4}</span>
                    {k.revoked_at
                      ? <span className="ml-auto text-xs text-red-500">revoked</span>
                      : <button onClick={() => revoke(k.id)} className="ml-auto text-text-muted hover:text-red-600" aria-label="Revoke key"><Trash2 size={14} /></button>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {compute && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5"><Cpu size={13} className="text-text-muted" /><span className="text-xs font-medium text-text-secondary">Backend compute</span></div>
              <p className="mb-2 text-xs text-text-muted">Applies to all {compute.containers} backend containers. Bump this if your Auth/Functions traffic grows.</p>
              <div className="flex flex-wrap items-center gap-2">
                {compute.sizes.map((s) => (
                  <button key={s} onClick={() => resize(s)} disabled={resizing || s === compute.size}
                    className={cn('rounded-full border px-3 py-1 text-xs font-medium capitalize',
                      s === compute.size ? 'border-primary-blue bg-blue-50 text-primary-blue' : 'border-neutral-border text-text-secondary hover:bg-bg-secondary disabled:opacity-50')}>
                    {s}
                  </button>
                ))}
                {resizing && <Loader2 size={14} className="animate-spin text-text-muted" />}
              </div>
              <p className="mt-1.5 text-xs text-text-muted">
                Current: <span className="font-medium text-text-primary capitalize">{compute.size}</span> · {compute.per_container.cpu}, {compute.per_container.memory_mb} MB per container
                {compute.monthly_delta_cents > 0 && <> · <span className="text-text-primary">+${(compute.monthly_delta_cents / 100).toFixed(0)}/mo</span> over nano</>}
              </p>
            </div>
          )}

          {vector && (
            <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-violet-600" />
              <p className="text-xs text-violet-800">
                <span className="font-medium">pgvector is enabled</span> on your database — store embeddings and run similarity search natively.
                Try <code className="rounded bg-white/70 px-1 font-mono">create table docs (id bigserial primary key, embedding vector(1536));</code> in the SQL editor.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function cn(...xs: (string | false | undefined)[]) { return xs.filter(Boolean).join(' '); }

function Field({ label, value, mono, link }: { label: string; value: string; mono?: boolean; link?: boolean }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-text-secondary">{label}</span>
      {link ? (
        <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary-blue hover:underline">
          <span className="font-mono">{value}</span> <ExternalLink size={13} />
        </a>
      ) : (
        <span className={mono ? 'font-mono text-sm text-text-primary' : 'text-sm text-text-primary'}>{value}</span>
      )}
    </div>
  );
}

function CopyRow({ value, copyValue }: { value: string; copyValue: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard?.writeText(copyValue); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* noop */ }
  }
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-lg border border-neutral-border bg-bg-secondary px-2.5 py-1.5 font-mono text-xs text-text-primary">{value}</code>
      <button onClick={copy} aria-label="Copy" className="rounded-lg border border-neutral-border p-1.5 text-text-muted hover:text-text-primary">
        {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
