'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plug, Check, RefreshCw, X, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { integrations, type Connector } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';

const INPUT = 'w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading outline-none focus:border-accent';

export default function ConnectionsPage() {
  const { token } = useAuth();
  const [conns, setConns] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    try { setConns(await integrations.list(token)); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  // Surface the result of an OAuth round-trip, then clean the URL.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const ok = p.get('connected'); const err = p.get('error');
    if (ok) toast.success(`${ok} connected`);
    else if (err) toast.error(`Couldn't connect ${err}. Please try again.`);
    if (ok || err) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  function openConnect(c: Connector) { setOpenId(c.id); setForm({}); }

  async function connect(c: Connector) {
    if (!token) return;
    setBusy(c.id);
    try {
      // api_key connectors send their fields as credentials; others connect directly.
      const credentials = c.auth === 'api_key' ? form : undefined;
      await integrations.connect(c.id, { credentials }, token);
      toast.success(`${c.name} connected`);
      setOpenId(null); await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }

  // OAuth: connectors with fields (e.g. Shopify needs a shop) open a small form
  // first; otherwise we go straight to the provider authorize page.
  async function authorize(c: Connector) {
    if (!token) return;
    if (c.fields.length > 0 && openId !== c.id) { openConnect(c); return; }
    setBusy(c.id);
    try {
      const { url } = await integrations.oauthStart(c.id, token, form.shop);
      window.location.href = url;
    } catch (e) { toast.error((e as Error).message); setBusy(''); }
  }

  async function disconnect(c: Connector) {
    if (!token || !window.confirm(`Disconnect ${c.name}? Agents using it will stop working.`)) return;
    setBusy(c.id);
    try { await integrations.disconnect(c.id, token); toast.success(`${c.name} disconnected`); await load(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }

  const channels = conns.filter((c) => c.category === 'channel');
  const tools = conns.filter((c) => c.category === 'tool');
  const modelsList = conns.filter((c) => c.category === 'model');

  function Card({ c }: { c: Connector }) {
    return (
      <div className={`rounded-2xl border bg-surface-card p-4 ${c.connected ? 'border-accent/40' : 'border-neutral-border'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {c.category === 'channel' ? <Radio size={16} className="text-accent" /> : <Plug size={16} className="text-accent" />}
            <span className="text-sm font-semibold text-dash-heading">{c.name}</span>
          </div>
          {c.connected
            ? <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-[11px] font-semibold text-ok"><Check size={11} /> Connected</span>
            : <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-dash-muted uppercase">{c.auth === 'oauth' ? 'OAuth' : c.auth === 'none' ? 'Built-in' : 'API key'}</span>}
        </div>
        <p className="mt-1 text-[12px] text-dash-muted">{c.blurb}</p>

        {openId === c.id && c.fields.length > 0 && (c.auth === 'api_key' || c.auth === 'oauth') && (
          <div className="mt-3 space-y-2 rounded-xl border border-neutral-border p-3">
            {c.fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-[11px] font-medium text-dash-muted">{f.label}</label>
                <input type={f.secret ? 'password' : 'text'} value={form[f.key] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} className={INPUT} />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={() => (c.auth === 'oauth' ? authorize(c) : connect(c))} disabled={busy === c.id} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy === c.id ? <Loader2 size={13} className="animate-spin" /> : null} {c.auth === 'oauth' ? 'Authorize' : 'Save'}</button>
              <button onClick={() => setOpenId(null)} className="rounded-lg border border-neutral-border px-3 py-1.5 text-[12px] text-dash-body hover:bg-surface-hover">Cancel</button>
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          {c.connected ? (
            <button onClick={() => disconnect(c)} disabled={!!busy} className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-[12px] font-medium text-dash-body hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><X size={13} /> Disconnect</button>
          ) : c.auth === 'oauth' ? (
            openId === c.id && c.fields.length > 0 ? null : (
              <button onClick={() => authorize(c)} disabled={busy === c.id} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy === c.id ? <Loader2 size={13} className="animate-spin" /> : null} Authorize</button>
            )
          ) : c.auth === 'none' ? (
            <button onClick={() => connect(c)} disabled={busy === c.id} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy === c.id ? <Loader2 size={13} className="animate-spin" /> : null} Enable</button>
          ) : openId !== c.id ? (
            <button onClick={() => openConnect(c)} className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90">Connect</button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Connections"
        subtitle="Connect the channels your agents talk on and the tools they use. Credentials are encrypted at rest."
        actions={<button onClick={() => { setLoading(true); load(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>}
      />
      {loading ? <p className="mt-6 text-sm text-dash-muted">Loading…</p> : (
        <>
          <h3 className="mb-3 mt-6 text-sm font-semibold text-dash-heading">Channels</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{channels.map((c) => <Card key={c.id} c={c} />)}</div>
          <h3 className="mb-3 mt-8 text-sm font-semibold text-dash-heading">Tools</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tools.map((c) => <Card key={c.id} c={c} />)}</div>

          {modelsList.length > 0 && (
            <>
              <h3 className="mb-1 mt-8 text-sm font-semibold text-dash-heading">Models (bring your own key)</h3>
              <p className="mb-3 text-[12px] text-dash-muted">Connect your own LLM key and your agents run on it — usage is billed by the provider, and these runs don&apos;t consume credits.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{modelsList.map((c) => <Card key={c.id} c={c} />)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
