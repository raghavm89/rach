'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, RefreshCw, Rocket, UploadCloud, Plus, Loader2, Send, Sparkles, Save, Coins, X, Trash2, ScrollText, AlertCircle, Server, Download, Check, Copy, Code2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { agentBuilder, type AgentSpec, type AgentDeployment, type ModelOption, type AgentDeploymentLogs, type DeployTarget, type DeployResult, type AgentIntegration, type ApiKeyInfo } from '@rach/ui/lib/api';

// Render a log entry (string, or {ts,level,message}, or object) as one line.
function logLine(l: unknown): string {
  if (typeof l === 'string') return l;
  if (l && typeof l === 'object') {
    const o = l as Record<string, unknown>;
    const ts = o.ts || o.time || o.timestamp;
    const lvl = o.level || o.severity;
    const msg = o.message || o.msg || o.text;
    if (msg) return `${ts ? `[${ts}] ` : ''}${lvl ? `${String(lvl).toUpperCase()} ` : ''}${msg}`;
    return JSON.stringify(l);
  }
  return String(l);
}
import { PageHeader } from '@/components/dashboard/PageHeader';

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-surface-hover text-dash-muted', published: 'bg-accent-weak text-accent',
  deployed: 'bg-ok-bg text-ok', disabled: 'bg-red-50 text-red-600', pending: 'bg-amber-50 text-amber-600',
  running: 'bg-ok-bg text-ok', stopped: 'bg-surface-hover text-dash-muted', failed: 'bg-red-50 text-red-600',
};
function Badge({ value }: { value: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[value] ?? 'bg-surface-hover text-dash-muted'}`}>{value}</span>;
}
const CARD = 'rounded-2xl border border-neutral-border bg-surface-card';
const INPUT = 'w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading outline-none focus:border-accent';

interface TestMsg { role: 'user' | 'agent'; content: string; credits?: number }

export default function AgentBuilderPage() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<AgentSpec[]>([]);
  const [deployments, setDeployments] = useState<AgentDeployment[]>([]);
  const [templates, setTemplates] = useState<AgentSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [busy, setBusy] = useState<string>('');
  const [selId, setSelId] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [tplFilter, setTplFilter] = useState<string>('all');

  // Editor
  const [eName, setEName] = useState('');
  const [ePrompt, setEPrompt] = useState('');
  const [eModel, setEModel] = useState<string>('auto');
  const [models, setModels] = useState<ModelOption[]>([]);

  // Ship-it (deploy) modal
  const [shipOpen, setShipOpen] = useState(false);
  const [shipTarget, setShipTarget] = useState<DeployTarget>('rachbase');
  const [rachbaseReady, setRachbaseReady] = useState(true);
  const [shipResult, setShipResult] = useState<DeployResult | null>(null);
  const [shipErr, setShipErr] = useState('');

  // Integrate modal
  const [integrateOpen, setIntegrateOpen] = useState(false);
  const [integration, setIntegration] = useState<AgentIntegration | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [integBusy, setIntegBusy] = useState(false);

  // Logs pop-up (modal)
  const [logsId, setLogsId] = useState<number | null>(null);
  const [logsData, setLogsData] = useState<AgentDeploymentLogs | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsErr, setLogsErr] = useState('');

  // Test panel
  const [msgs, setMsgs] = useState<TestMsg[]>([]);
  const [input, setInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sel = agents.find((a) => a.id === selId) ?? null;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [d, dep, c, m, ds] = await Promise.all([agentBuilder.list(token), agentBuilder.deployments(token), agentBuilder.credits(token).catch(() => ({ balance: null })), agentBuilder.models(token).catch(() => []), agentBuilder.deploySettings(token).catch(() => ({ target: null, rachbase_ready: true }))]);
      setAgents(d.definitions);
      setDeployments(dep.deployments);
      setBalance(c.balance);
      setModels(m);
      setRachbaseReady(ds.rachbase_ready);
      if (ds.target) setShipTarget(ds.target);
      if (d.definitions.length === 0) setShowTemplates(true);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, testing]);

  // Sync editor when selecting an agent
  function select(a: AgentSpec) {
    setSelId(a.id); setEName(a.name); setEPrompt(a.prompt ?? ''); setEModel(a.model_policy?.pin ?? 'auto');
    setMsgs([]); setPaywall(false);
  }

  async function openIntegrate() {
    if (!token || !sel) return;
    setIntegrateOpen(true); setNewKey(null); setIntegration(null); setIntegBusy(true);
    try {
      const [info, keys] = await Promise.all([agentBuilder.integration(sel.id, token), agentBuilder.apiKeys(token).catch(() => [])]);
      setIntegration(info); setApiKeys(keys);
    } catch (e) { toast.error((e as Error).message); }
    finally { setIntegBusy(false); }
  }
  async function createKey() {
    if (!token) return;
    setIntegBusy(true);
    try { const k = await agentBuilder.createApiKey('Integration key', token); setNewKey(k.key); setApiKeys((ks) => [k, ...ks]); }
    catch (e) { toast.error((e as Error).message); }
    finally { setIntegBusy(false); }
  }
  async function revokeKey(id: number) {
    if (!token || !window.confirm('Revoke this key? Apps using it will stop working.')) return;
    try { await agentBuilder.revokeApiKey(id, token); setApiKeys((ks) => ks.map((k) => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k))); toast.success('Revoked'); }
    catch (e) { toast.error((e as Error).message); }
  }

  // Open run logs in an in-page pop-up (modal overlay), not a new window/tab.
  async function openLogs(deploymentId: number) {
    if (!token) return;
    setLogsId(deploymentId); setLogsData(null); setLogsErr(''); setLogsLoading(true);
    try { setLogsData(await agentBuilder.logs(deploymentId, token)); }
    catch (e) { setLogsErr((e as Error).message); }
    finally { setLogsLoading(false); }
  }

  async function openTemplates() {
    setShowTemplates(true);
    if (!templates.length && token) {
      try { const r = await agentBuilder.templates(token); setTemplates(r.templates); }
      catch (e) { toast.error((e as Error).message); }
    }
  }

  async function useTemplate(t: AgentSpec) {
    if (!token) return;
    setBusy(`tpl-${t.id}`);
    try {
      const { definition } = await agentBuilder.fromTemplate(t.id, token);
      toast.success(`Added ${definition.name}`);
      setShowTemplates(false);
      await load();
      select(definition);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }

  async function save() {
    if (!token || !sel) return;
    setBusy('save');
    try {
      await agentBuilder.update(sel.id, { name: eName.trim(), prompt: ePrompt, model_policy: { class: 'balanced', ...(eModel !== 'auto' ? { pin: eModel } : {}) } }, token);
      toast.success('Saved');
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }

  async function act(kind: 'publish' | 'deploy') {
    if (!token || !sel) return;
    if (kind === 'deploy') { setShipResult(null); setShipErr(''); setShipOpen(true); return; }
    setBusy(kind);
    try {
      const r = await agentBuilder.publish(sel.id, token); toast.success(`Published v${r.version}`);
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }

  async function ship(target: DeployTarget) {
    if (!token || !sel) return;
    setBusy('ship'); setShipErr(''); setShipResult(null);
    try {
      const r = await agentBuilder.deploy(sel.id, token, target);
      setShipResult(r); // show result (self-host export, or the live run surface)
      if (target === 'rachbase') toast.success(`Deployed: ${r.deployment?.status ?? 'ok'}`);
      await load();
    } catch (e) { setShipErr((e as Error).message || 'Deploy failed'); }
    finally { setBusy(''); }
  }
  function downloadConfig() {
    if (!shipResult?.config) return;
    const blob = new Blob([JSON.stringify(shipResult.config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${sel?.key ?? 'agent'}-config.json`; a.click();
    URL.revokeObjectURL(url);
  }

  async function removeAgent(a: AgentSpec, e: React.MouseEvent) {
    e.stopPropagation();
    if (!token || !window.confirm(`Delete "${a.name}"? This can't be undone.`)) return;
    setBusy(`del-${a.id}`);
    try {
      await agentBuilder.remove(a.id, token);
      if (selId === a.id) setSelId(null);
      toast.success('Agent deleted');
      await load();
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(''); }
  }

  async function sendTest() {
    if (!token || !sel || !input.trim()) return;
    const message = input.trim();
    setMsgs((m) => [...m, { role: 'user', content: message }]);
    setInput(''); setTesting(true); setPaywall(false);
    try {
      const r = await agentBuilder.test(sel.id, message, token);
      setMsgs((m) => [...m, { role: 'agent', content: r.reply, credits: r.creditsUsed }]);
      setBalance(r.balance);
    } catch (e) {
      if ((e as { status?: number }).status === 402) setPaywall(true);
      else setMsgs((m) => [...m, { role: 'agent', content: `⚠ ${(e as Error).message}` }]);
    } finally { setTesting(false); }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Agent Builder"
        subtitle="Start from a template → shape it → test it live → publish → deploy."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/billing" title="Credit balance — top up"
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${balance != null && balance <= 0 ? 'border-red-200 bg-red-50 text-red-600' : 'border-neutral-border bg-surface-card text-dash-body hover:bg-surface-hover'}`}>
              <Coins size={14} className="text-accent" />
              {balance == null ? '—' : balance.toLocaleString('en-IN')} <span className="text-dash-muted">credits</span>
            </Link>
            <button onClick={openTemplates} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"><Plus size={15} /> New from template</button>
            <button onClick={() => { setLoading(true); load(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        }
      />

      {/* Template gallery */}
      {showTemplates && (
        <div className={`${CARD} mt-6 p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-dash-heading"><Sparkles size={15} className="text-accent" /> Start from a template</h3>
            {agents.length > 0 && <button onClick={() => setShowTemplates(false)} className="text-dash-muted hover:text-dash-heading"><X size={16} /></button>}
          </div>
          {templates.length === 0 ? (
            <p className="text-sm text-dash-muted">Loading templates…</p>
          ) : (
            <>
            {/* Workspace / industry filter */}
            {(() => {
              const inds = Array.from(new Set(templates.map((t) => t.industry).filter(Boolean))) as string[];
              return (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {['all', ...inds].map((f) => (
                    <button key={f} onClick={() => setTplFilter(f)}
                      className={`rounded-full px-3 py-1 text-[12px] font-medium capitalize ${tplFilter === f ? 'bg-accent text-white' : 'border border-neutral-border text-dash-body hover:bg-surface-hover'}`}>
                      {f === 'all' ? 'All' : f === 'hr' ? 'HR' : f}
                    </button>
                  ))}
                </div>
              );
            })()}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.filter((t) => tplFilter === 'all' || t.industry === tplFilter).map((t) => (
                <div key={t.id} className="rounded-xl border border-neutral-border p-4">
                  <div className="flex items-center gap-2">
                    <Bot size={16} className="text-accent" />
                    <span className="text-sm font-semibold text-dash-heading">{t.name}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-dash-muted">{t.role}{t.industry ? ` · ${t.industry}` : ''}</p>
                  {t.description && <p className="mt-1 line-clamp-2 text-[12px] text-dash-body">{t.description}</p>}
                  <button onClick={() => useTemplate(t)} disabled={!!busy}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-accent/40 bg-accent-weak px-3 py-1.5 text-[12px] font-semibold text-accent hover:bg-accent hover:text-white disabled:opacity-50">
                    {busy === `tpl-${t.id}` ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Use template
                  </button>
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,300px)_1fr]">
        {/* Agents list */}
        <div className={`${CARD} h-fit`}>
          <div className="border-b border-neutral-border px-4 py-3 text-sm font-semibold text-dash-heading"><Bot size={15} className="mr-2 inline" /> Your agents</div>
          {loading ? <p className="px-4 py-8 text-center text-sm text-dash-muted">Loading…</p>
            : agents.length === 0 ? <p className="px-4 py-8 text-center text-sm text-dash-muted">None yet — start from a template.</p>
              : (
                <ul className="divide-y divide-neutral-border">
                  {agents.map((a) => (
                    <li key={a.id} className={`group flex items-center gap-1 ${selId === a.id ? 'bg-surface-hover' : ''}`}>
                      <button onClick={() => select(a)} className="flex min-w-0 flex-1 items-center justify-between px-4 py-3 text-left hover:bg-surface-hover">
                        <span className="min-w-0"><span className="block truncate text-sm font-medium text-dash-heading">{a.name}</span><span className="block truncate text-[11px] text-dash-muted">{a.industry ?? a.role}</span></span>
                        <Badge value={a.status} />
                      </button>
                      <button onClick={(e) => removeAgent(a, e)} disabled={!!busy} title="Delete agent"
                        className="mr-2 shrink-0 rounded-md p-1.5 text-dash-muted opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50">
                        {busy === `del-${a.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
        </div>

        {/* Editor + test */}
        {!sel ? (
          <div className={`${CARD} flex items-center justify-center p-10 text-sm text-dash-muted`}>Select an agent, or add one from a template, to configure and test it.</div>
        ) : (
          <div className="space-y-4">
            {/* Config */}
            <div className={`${CARD} p-5`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><h3 className="text-base font-semibold text-dash-heading">{sel.name}</h3><Badge value={sel.status} /><span className="text-[11px] text-dash-muted">v{sel.version}</span></div>
                <div className="flex gap-2">
                  <button onClick={() => act('publish')} disabled={!!busy} className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-medium text-dash-body hover:bg-surface-hover disabled:opacity-50">{busy === 'publish' ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} Publish</button>
                  <button onClick={openIntegrate} className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-medium text-dash-body hover:bg-surface-hover" title="Endpoint, embed & API keys"><Code2 size={13} /> Integrate</button>
                  <button onClick={() => act('deploy')} disabled={!!busy || sel.status === 'draft'} title={sel.status === 'draft' ? 'Publish first' : 'Deploy published version'} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"><Rocket size={13} /> Deploy</button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                <div><label className="mb-1 block text-xs font-medium text-dash-muted">Name</label><input value={eName} onChange={(e) => setEName(e.target.value)} className={INPUT} /></div>
                <div><label className="mb-1 block text-xs font-medium text-dash-muted">Model</label>
                  <select value={eModel} onChange={(e) => setEModel(e.target.value)} className={INPUT}>
                    {models.map((m) => <option key={m.id} value={m.id}>{m.label}{m.billed ? ' · credits' : ''}</option>)}
                  </select>
                </div>
              </div>
              <label className="mb-1 mt-3 block text-xs font-medium text-dash-muted">System prompt — how the agent behaves</label>
              <textarea value={ePrompt} onChange={(e) => setEPrompt(e.target.value)} rows={6} className={`${INPUT} font-mono text-[12.5px] leading-relaxed`} placeholder="You are a helpful assistant that…" />
              <button onClick={save} disabled={!!busy} className="mt-3 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save</button>
            </div>

            {/* Test panel */}
            <div className={`${CARD} p-5`}>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-dash-heading"><Sparkles size={15} className="text-accent" /> Test this agent</h3>
              <p className="mt-0.5 text-[12px] text-dash-muted">Send a message — runs your saved agent live. Each run spends credits.</p>

              {paywall && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm text-amber-800"><Coins size={16} /> You&apos;re out of credits.</p>
                  <Link href="/dashboard/billing" className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90">Top up →</Link>
                </div>
              )}

              <div ref={scrollRef} className="mt-3 max-h-[320px] min-h-[120px] space-y-2 overflow-y-auto">
                {msgs.length === 0 && !testing && <p className="py-6 text-center text-[13px] text-dash-muted">No messages yet. Try “{sel.industry === 'hr' ? 'Draft a JD for a backend engineer' : 'A customer asks where their order is'}”.</p>}
                {msgs.map((m, i) => (
                  <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] ${m.role === 'user' ? 'bg-accent text-white' : 'bg-surface-hover text-dash-body'}`}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      {m.credits != null && <p className="mt-1 text-[10px] opacity-70">−{m.credits} credit{m.credits === 1 ? '' : 's'}</p>}
                    </div>
                  </div>
                ))}
                {testing && <div className="flex justify-start"><div className="rounded-2xl bg-surface-hover px-3.5 py-2"><Loader2 size={14} className="animate-spin text-dash-muted" /></div></div>}
              </div>

              <div className="mt-3 flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendTest()} className={INPUT} placeholder="Message your agent…" disabled={testing} />
                <button onClick={sendTest} disabled={!input.trim() || testing} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"><Send size={15} /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Deployments — only when something is deployed (keeps the page clean) */}
      {deployments.length > 0 && (
        <div className={`${CARD} mt-4 overflow-hidden`}>
          <div className="border-b border-neutral-border px-5 py-3 text-sm font-semibold text-dash-heading"><Rocket size={15} className="mr-2 inline" /> Deployments</div>
          <ul className="divide-y divide-neutral-border">
            {deployments.map((d) => (
              <li key={d.id}>
                <button onClick={() => openLogs(d.id)} type="button"
                  className="flex w-full items-center justify-between px-5 py-3 text-left text-sm hover:bg-surface-hover" title="Open run logs">
                  <div className="min-w-0">
                    <span className="font-medium text-dash-heading">{d.agent_key}</span>
                    <span className="ml-2 text-xs text-dash-muted">v{d.version} · {d.runtime_target?.type}</span>
                    {d.last_error && <span className="ml-2 text-xs text-red-600">{d.last_error}</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-dash-muted"><ScrollText size={13} /> Logs</span>
                    <Badge value={d.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Integrate (endpoint + curl + API keys) */}
      {integrateOpen && sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIntegrateOpen(false)} />
          <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-border bg-surface-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-border px-5 py-3">
              <div><h3 className="text-base font-semibold text-dash-heading">Integrate {sel.name}</h3><p className="text-[12px] text-dash-muted">Call this agent from your site, app, or any tool.</p></div>
              <button onClick={() => setIntegrateOpen(false)} className="rounded-lg p-1.5 text-dash-muted hover:bg-surface-hover"><X size={16} /></button>
            </div>
            <div className="overflow-auto p-5">
              {integBusy && !integration ? (
                <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
              ) : !integration?.message_url ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Deploy this agent first — its endpoint and embed appear once it&apos;s live.</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-[12px] font-medium text-dash-heading">REST endpoint</p>
                    <div className="flex items-start gap-2">
                      <pre className="flex-1 overflow-x-auto rounded-lg bg-surface-app px-3 py-2.5 text-[12px] text-dash-body ring-1 ring-neutral-border"><code>{`curl -X POST ${integration.message_url} \\
  -H "content-type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"message":"hello"}'`}</code></pre>
                      <button onClick={() => { navigator.clipboard.writeText(`curl -X POST ${integration.message_url} -H "content-type: application/json" -H "Authorization: Bearer YOUR_API_KEY" -d '{"message":"hello"}'`); toast.success('Copied'); }} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-2 text-xs font-medium text-dash-body hover:bg-surface-hover"><Copy size={13} /></button>
                    </div>
                    <p className="mt-1 text-[11px] text-dash-muted">The API key is optional for the widget, but recommended for server-to-server (higher rate limit + revocable).</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] font-medium text-dash-heading">Embed on a website</p>
                    <div className="flex items-start gap-2">
                      <pre className="flex-1 overflow-x-auto rounded-lg bg-surface-app px-3 py-2.5 text-[12px] text-dash-body ring-1 ring-neutral-border"><code>{`<script src="${integration.widget_url}" async></script>`}</code></pre>
                      <button onClick={() => { navigator.clipboard.writeText(`<script src="${integration.widget_url}" async></script>`); toast.success('Copied'); }} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-2 text-xs font-medium text-dash-body hover:bg-surface-hover"><Copy size={13} /></button>
                    </div>
                  </div>

                  {/* API keys */}
                  <div className="border-t border-neutral-border pt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-[12px] font-medium text-dash-heading"><KeyRound size={13} /> API keys</p>
                      <button onClick={createKey} disabled={integBusy} className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"><Plus size={13} /> New key</button>
                    </div>
                    {newKey && (
                      <div className="mb-2 rounded-lg border border-ok/30 bg-ok-bg px-3 py-2">
                        <p className="text-[11px] text-ok">Copy this now — it won&apos;t be shown again.</p>
                        <div className="mt-1 flex items-center gap-2">
                          <code className="flex-1 overflow-x-auto rounded bg-surface-card px-2 py-1 text-[12px] text-dash-heading">{newKey}</code>
                          <button onClick={() => { navigator.clipboard.writeText(newKey); toast.success('Copied'); }} className="rounded-md border border-neutral-border px-2 py-1 text-xs text-dash-body hover:bg-surface-hover"><Copy size={12} /></button>
                        </div>
                      </div>
                    )}
                    {apiKeys.length === 0 ? (
                      <p className="text-[12px] text-dash-muted">No keys yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {apiKeys.map((k) => (
                          <li key={k.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-border px-3 py-2 text-[12px]">
                            <span className="flex items-center gap-2"><code className="text-dash-heading">{k.prefix}…</code><span className="text-dash-muted">{k.name}</span>{k.revoked_at && <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600">revoked</span>}</span>
                            {!k.revoked_at && <button onClick={() => revokeKey(k.id)} className="text-dash-muted hover:text-red-600" title="Revoke"><Trash2 size={13} /></button>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ship it (deploy target chooser) */}
      {shipOpen && sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShipOpen(false)} />
          <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-neutral-border bg-surface-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-border px-5 py-3">
              <div><h3 className="text-base font-semibold text-dash-heading">Ship it</h3><p className="text-[12px] text-dash-muted">Choose where <span className="font-medium text-dash-body">{sel.name}</span> runs.</p></div>
              <button onClick={() => setShipOpen(false)} className="rounded-lg p-1.5 text-dash-muted hover:bg-surface-hover"><X size={16} /></button>
            </div>

            {shipResult && shipResult.mode === 'self_hosted' ? (
              // Self-hosted export result
              <div className="overflow-auto p-5">
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok-bg px-4 py-3 text-sm text-ok"><Check size={16} /> Config exported — run it on your own backend.</div>
                <ol className="mb-4 space-y-2">
                  {(shipResult.instructions?.steps ?? []).map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-dash-body"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-weak text-[10px] font-semibold text-accent">{i + 1}</span>{s}</li>
                  ))}
                </ol>
                <div className="flex items-center gap-2">
                  <button onClick={downloadConfig} className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90"><Download size={14} /> Download config (JSON)</button>
                  {shipResult.instructions?.docs_url && <a href={shipResult.instructions.docs_url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-accent hover:underline">Setup guide →</a>}
                </div>
              </div>
            ) : shipResult && shipResult.mode === 'rachbase' ? (
              // Managed deploy — the live run surface
              <div className="overflow-auto p-5">
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok-bg px-4 py-3 text-sm text-ok"><Check size={16} /> Deployed on RachBase — your agent is live.</div>
                {shipResult.embed && (
                  <>
                    <p className="mb-1 text-[12px] font-medium text-dash-heading">Embed on your site</p>
                    <div className="mb-3 flex items-start gap-2">
                      <pre className="flex-1 overflow-x-auto rounded-lg bg-surface-app px-3 py-2.5 text-[12px] text-dash-body ring-1 ring-neutral-border"><code>{shipResult.embed}</code></pre>
                      <button onClick={() => { navigator.clipboard.writeText(shipResult.embed!); toast.success('Copied'); }} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-2 text-xs font-medium text-dash-body hover:bg-surface-hover"><Copy size={13} /> Copy</button>
                    </div>
                  </>
                )}
                {shipResult.messageUrl && (
                  <>
                    <p className="mb-1 text-[12px] font-medium text-dash-heading">Message endpoint (POST)</p>
                    <div className="flex items-start gap-2">
                      <pre className="flex-1 overflow-x-auto rounded-lg bg-surface-app px-3 py-2.5 text-[12px] text-dash-body ring-1 ring-neutral-border"><code>{shipResult.messageUrl}</code></pre>
                      <button onClick={() => { navigator.clipboard.writeText(shipResult.messageUrl!); toast.success('Copied'); }} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-2 text-xs font-medium text-dash-body hover:bg-surface-hover"><Copy size={13} /> Copy</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                {/* Managed */}
                <div className={`flex flex-col rounded-xl border p-4 ${shipTarget === 'rachbase' ? 'border-accent' : 'border-neutral-border'}`}>
                  <div className="mb-1 flex items-center gap-2"><span className="rounded bg-dash-heading px-1.5 py-0.5 text-[10px] font-semibold text-surface-card">rachbase</span><span className="rounded-full bg-accent-weak px-2 py-0.5 text-[10px] font-semibold text-accent">Recommended</span></div>
                  <h4 className="text-sm font-semibold text-dash-heading">Deploy on RachBase</h4>
                  <p className="mt-0.5 text-[12px] text-dash-muted">The backend half of the stack, already wired to this agent.</p>
                  <ul className="mt-3 flex-1 space-y-1.5 text-[12px] text-dash-body">
                    {['Managed database', 'Auth', 'File storage', 'Hosting & SSL', 'Monitoring & backups'].map((f) => <li key={f} className="flex items-center gap-1.5"><Check size={13} className="text-ok" /> {f}</li>)}
                  </ul>
                  {!rachbaseReady && <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700"><AlertCircle size={13} className="mt-0.5 shrink-0" /> Not set up for this workspace yet — configure it in Settings → Deployment, or use Self-hosted.</p>}
                  <button onClick={() => ship('rachbase')} disabled={busy === 'ship'} className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy === 'ship' ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />} Deploy to RachBase</button>
                </div>
                {/* Self-hosted */}
                <div className={`flex flex-col rounded-xl border p-4 ${shipTarget === 'self_hosted' ? 'border-accent' : 'border-neutral-border'}`}>
                  <span className="mb-1 w-fit rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-semibold text-dash-muted">Self-hosted</span>
                  <h4 className="text-sm font-semibold text-dash-heading">Bring your own backend</h4>
                  <p className="mt-0.5 text-[12px] text-dash-muted">Run it on infrastructure you already trust.</p>
                  <ul className="mt-3 flex-1 space-y-1.5 text-[12px] text-dash-body">
                    {['Export config (JSON)', 'Setup guide', 'Same agent, same guardrails, same evals', 'You own the hosting'].map((f) => <li key={f} className="flex items-center gap-1.5"><Check size={13} className="text-ok" /> {f}</li>)}
                  </ul>
                  <button onClick={() => ship('self_hosted')} disabled={busy === 'ship'} className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-neutral-border px-4 py-2.5 text-sm font-semibold text-dash-heading hover:bg-surface-hover disabled:opacity-50">{busy === 'ship' ? <Loader2 size={15} className="animate-spin" /> : <Server size={15} />} Export &amp; get instructions</button>
                </div>
              </div>
            )}
            {shipErr && <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {shipErr}</div>}
          </div>
        </div>
      )}

      {/* Run-logs pop-up (modal) */}
      {logsId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setLogsId(null)} />
          <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-neutral-border bg-surface-card shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-border px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-dash-heading">{logsData?.agent_key ?? 'Deployment'} · run logs</span>
                {logsData && <span className="text-xs text-dash-muted">v{logsData.version}{logsData.target ? ` · ${logsData.target}` : ''}</span>}
                {logsData && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[logsData.status] ?? 'bg-surface-hover text-dash-muted'}`}>{logsData.status}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openLogs(logsId)} disabled={logsLoading} className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-2.5 py-1.5 text-xs font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50"><RefreshCw size={13} className={logsLoading ? 'animate-spin' : ''} /> Refresh</button>
                <button onClick={() => setLogsId(null)} className="rounded-lg p-1.5 text-dash-muted hover:bg-surface-hover" title="Close"><X size={16} /></button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {logsLoading && !logsData ? (
                <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading logs…</div>
              ) : logsErr ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{logsErr}</div>
              ) : logsData ? (
                <>
                  {logsData.last_error && (
                    <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span className="font-mono">{logsData.last_error}</span>
                    </div>
                  )}
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1117]">
                    <div className="border-b border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Run logs</div>
                    {logsData.logs.length > 0 ? (
                      <pre className="max-h-[55vh] overflow-auto px-4 py-3 text-[12px] leading-relaxed text-slate-200"><code>{logsData.logs.map(logLine).join('\n')}</code></pre>
                    ) : (
                      <p className="px-4 py-6 text-center text-[13px] text-slate-400">{logsData.note || 'No log lines available.'}</p>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
