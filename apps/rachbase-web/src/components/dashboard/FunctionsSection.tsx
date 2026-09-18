'use client';

import { useEffect, useState } from 'react';
import { Loader2, FunctionSquare, KeyRound, Code2, Plus, Trash2, Rocket, ServerCrash, Check, ChevronRight, X, Eye, EyeOff, BookOpen, Play, FlaskConical } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { projects as api, type BaasFunction, type FunctionSecret } from '@rach/ui/lib/api';

/**
 * Backend → Functions: the Edge Functions surface (Supabase-style). Sub-nav Functions + Secrets.
 * Functions are deployed code (live, deploy-gated); Secrets are project-level env for functions.
 */
type SubKey = 'functions' | 'secrets';

export default function FunctionsSection({ token, projectId }: { token: string; projectId: number }) {
  const [sub, setSub] = useState<SubKey>('functions');
  return (
    <div className="grid grid-cols-[180px_1fr] gap-6">
      <nav className="space-y-1">
        <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Manage</p>
        {([['functions', 'Functions', FunctionSquare], ['secrets', 'Secrets', KeyRound]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setSub(k)}
            className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm', sub === k ? 'bg-blue-50 font-medium text-primary-blue' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary')}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>
      <div className="min-w-0">
        {sub === 'functions' ? <FunctionsPage token={token} projectId={projectId} /> : <SecretsPage token={token} projectId={projectId} />}
      </div>
    </div>
  );
}

const Center = () => <div className="flex items-center justify-center py-16 text-text-muted"><Loader2 className="animate-spin" /></div>;

const TEMPLATES: { name: string; desc: string; code: string }[] = [
  { name: 'Simple Hello World', desc: 'Basic function that returns a JSON response', code: `Deno.serve((req) => {\n  return new Response(JSON.stringify({ message: "Hello World" }), {\n    headers: { "content-type": "application/json" },\n  });\n});` },
  { name: 'Database Access', desc: 'Query your project database via the REST API', code: `Deno.serve(async (req) => {\n  const url = \`\${Deno.env.get("RACHBASE_URL")}/rest/v1/todos?select=*\`;\n  const res = await fetch(url, { headers: { apikey: Deno.env.get("RACHBASE_SECRET_KEY") ?? "" } });\n  return new Response(await res.text(), { headers: { "content-type": "application/json" } });\n});` },
  { name: 'Send Emails', desc: 'Send emails using a transactional API', code: `Deno.serve(async (req) => {\n  const { to, subject, html } = await req.json();\n  const res = await fetch("https://api.brevo.com/v3/smtp/email", {\n    method: "POST",\n    headers: { "api-key": Deno.env.get("BREVO_API_KEY") ?? "", "content-type": "application/json" },\n    body: JSON.stringify({ sender: { email: "no-reply@app" }, to: [{ email: to }], subject, htmlContent: html }),\n  });\n  return new Response(await res.text(), { status: res.status });\n});` },
  { name: 'Node Built-in API', desc: 'Example using built-in crypto', code: `Deno.serve(() => {\n  const id = crypto.randomUUID();\n  return new Response(JSON.stringify({ id }), { headers: { "content-type": "application/json" } });\n});` },
  { name: 'Stripe Webhook', desc: 'Handle webhook events securely', code: `Deno.serve(async (req) => {\n  const sig = req.headers.get("stripe-signature");\n  const body = await req.text();\n  // verify sig with Deno.env.get("STRIPE_WEBHOOK_SECRET")\n  return new Response(JSON.stringify({ received: true }), { headers: { "content-type": "application/json" } });\n});` },
];

// ── Functions ───────────────────────────────────────────────────────────────
function FunctionsPage({ token, projectId }: { token: string; projectId: number }) {
  const [fns, setFns] = useState<BaasFunction[] | null>(null);
  const [loading, setLoading] = useState(true); const [down, setDown] = useState(false); const [err, setErr] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [editor, setEditor] = useState<{ name: string; code: string } | null>(null);

  async function load() { setLoading(true); setDown(false); try { const r = await api.baasFunctions(token, projectId); setFns(r.functions); } catch { setDown(true); } finally { setLoading(false); } }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, projectId]);
  async function deploy() { setDeploying(true); setErr(''); try { await api.deployBaas(token, projectId); load(); } catch (e) { setErr((e as Error).message); } finally { setDeploying(false); } }
  async function del(name: string) { try { await api.baasDeleteFunction(token, projectId, name); load(); } catch (e) { setErr((e as Error).message); } }
  async function edit(name: string) { try { const r = await api.baasGetFunction(token, projectId, name); setEditor({ name: r.function.name, code: r.function.code }); } catch (e) { setErr((e as Error).message); } }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold font-display text-text-primary">Edge Functions</h3>
          <p className="text-xs text-text-muted">Run server-side logic close to your users.</p>
        </div>
        <button onClick={() => setEditor({ name: '', code: TEMPLATES[0].code })} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><Plus size={15} /> Deploy a new function</button>
      </div>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}

      {loading ? <Center /> : (fns && fns.length > 0) ? (
        <div className="overflow-hidden rounded-2xl border border-neutral-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-text-muted"><tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Version</th><th className="px-4 py-2 font-medium">Updated</th><th className="px-4 py-2" /></tr></thead>
            <tbody className="divide-y divide-neutral-border">
              {fns.map((f) => (
                <tr key={f.name} className="hover:bg-bg-secondary">
                  <td className="px-4 py-2.5"><button onClick={() => edit(f.name)} className="inline-flex items-center gap-1.5 font-mono text-primary-blue hover:underline"><Code2 size={13} /> {f.name}</button></td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">v{f.version}</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">{new Date(f.updated_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-right"><button onClick={() => del(f.name)} className="text-text-muted hover:text-red-600" aria-label="Delete"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {down && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <ServerCrash size={16} /><span>Backend not deployed — functions run once it&apos;s live. You can still draft one below.</span>
              <button onClick={deploy} disabled={deploying} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary-blue px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">{deploying ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />} Deploy</button>
            </div>
          )}
          <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Deploy your first edge function</p>
            <button onClick={() => setEditor({ name: '', code: TEMPLATES[0].code })} className="inline-flex items-center gap-2 rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"><Code2 size={15} /> Open editor</button>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-text-primary">Start with a template</p>
            <div className="divide-y divide-neutral-border rounded-2xl border border-neutral-border">
              {TEMPLATES.map((t) => (
                <button key={t.name} onClick={() => setEditor({ name: '', code: t.code })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg-secondary">
                  <Code2 size={15} className="text-text-muted" />
                  <div className="min-w-0"><p className="text-sm text-text-primary">{t.name}</p><p className="text-xs text-text-muted">{t.desc}</p></div>
                  <ChevronRight size={15} className="ml-auto text-text-muted" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {editor && <FunctionEditor token={token} projectId={projectId} initial={editor} onClose={() => setEditor(null)} onDeployed={() => { setEditor(null); load(); }} />}
    </div>
  );
}

function FunctionEditor({ token, projectId, initial, onClose, onDeployed }: { token: string; projectId: number; initial: { name: string; code: string }; onClose: () => void; onDeployed: () => void }) {
  const [name, setName] = useState(initial.name); const [code, setCode] = useState(initial.code);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [deployed, setDeployed] = useState(Boolean(initial.name)); // editing an existing fn = already deployed
  const [showTest, setShowTest] = useState(false);

  async function deploy() {
    setBusy(true); setErr('');
    try { await api.baasDeployFunction(token, projectId, { name: name.trim(), code }); setDeployed(true); onDeployed(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex h-[82vh] w-full max-w-5xl flex-col rounded-2xl border border-neutral-border bg-surface-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-neutral-border px-4 py-3">
          <Code2 size={16} className="text-text-muted" />
          <input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="function-name" className="flex-1 rounded-lg border border-neutral-border px-3 py-1.5 font-mono text-sm" />
          <button onClick={() => setShowTest((s) => !s)} className={cn('inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium', showTest ? 'border-primary-blue text-primary-blue' : 'border-neutral-border text-text-secondary hover:bg-bg-secondary')}><FlaskConical size={14} /> Test</button>
          <button onClick={deploy} disabled={busy || !name || !code} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />} Deploy</button>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex min-h-0 flex-1">
          <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} className={cn('min-h-0 flex-1 resize-none bg-neutral-950 p-4 font-mono text-xs text-neutral-100 focus:outline-none', !showTest && 'rounded-b-2xl')} />
          {showTest && <TestPanel token={token} projectId={projectId} name={name} deployed={deployed} />}
        </div>
        {err && <p className="border-t border-neutral-border bg-red-50 px-4 py-2 text-xs text-red-600">{err}</p>}
      </div>
    </div>
  );
}

// Send a sample request to the deployed function and show the response (status + body).
function TestPanel({ token, projectId, name, deployed }: { token: string; projectId: number; name: string; deployed: boolean }) {
  const [body, setBody] = useState('{\n  "name": "world"\n}');
  const [resp, setResp] = useState<{ status: number; body: unknown } | null>(null);
  const [running, setRunning] = useState(false); const [err, setErr] = useState('');
  async function run() {
    setRunning(true); setErr(''); setResp(null);
    let parsed: unknown = {};
    try { parsed = body.trim() ? JSON.parse(body) : {}; } catch { setErr('Request body must be valid JSON.'); setRunning(false); return; }
    try { setResp(await api.baasInvokeFunction(token, projectId, name, parsed)); }
    catch (e) { setErr((e as Error).message); }
    finally { setRunning(false); }
  }
  return (
    <div className="flex w-2/5 min-w-0 flex-col border-l border-neutral-border bg-surface-card">
      <div className="flex items-center gap-2 border-b border-neutral-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Test request</span>
        <button onClick={run} disabled={running || !name || !deployed} title={!deployed ? 'Deploy the function first' : ''}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary-blue px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40">
          {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Send
        </button>
      </div>
      {!deployed && <p className="border-b border-neutral-border bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">Deploy the function to test it.</p>}
      <label className="px-3 pt-2 text-[11px] font-medium text-text-muted">Body (JSON)</label>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} className="mx-3 mt-1 h-28 resize-none rounded-lg border border-neutral-border p-2 font-mono text-xs" />
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
        <p className="mb-1 text-[11px] font-medium text-text-muted">Response</p>
        {err && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-600">{err}</p>}
        {resp && (
          <>
            <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-medium', resp.status < 400 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>HTTP {resp.status}</span>
            <pre className="mt-1.5 whitespace-pre-wrap break-words rounded-lg bg-neutral-950 p-2 font-mono text-[11px] text-neutral-100">{typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body, null, 2)}</pre>
          </>
        )}
        {!resp && !err && <p className="text-xs text-text-muted">Send a request to see the response.</p>}
      </div>
    </div>
  );
}

// ── Secrets ─────────────────────────────────────────────────────────────────
const DEFAULT_SECRETS: [string, string][] = [
  ['RACHBASE_URL', 'The API gateway for your project.'],
  ['RACHBASE_DB_URL', 'The direct Postgres connection URL. Server-side only.'],
  ['RACHBASE_PUBLISHABLE_KEY', 'Publishable API key. Safe in a browser if RLS is enabled.'],
  ['RACHBASE_SECRET_KEY', 'Secret API key. Never expose to a browser.'],
  ['RACHBASE_JWKS', 'JSON Web Key Set used to verify JWTs issued by your auth server.'],
  ['RACHBASE_REF', 'Your project ref.'],
  ['DENO_DEPLOYMENT_ID', 'The version of the function code. Set when the function is deployed.'],
];

function SecretsPage({ token, projectId }: { token: string; projectId: number }) {
  const [secrets, setSecrets] = useState<FunctionSecret[] | null>(null);
  const [loading, setLoading] = useState(true); const [down, setDown] = useState(false); const [err, setErr] = useState(''); const [saved, setSaved] = useState(false);
  const [rows, setRows] = useState<{ name: string; value: string }[]>([{ name: '', value: '' }]);
  const [reveal, setReveal] = useState(false); const [query, setQuery] = useState('');

  async function load() { setLoading(true); setDown(false); try { const r = await api.baasFunctionSecrets(token, projectId); setSecrets(r.secrets); } catch { setDown(true); } finally { setLoading(false); } }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, projectId]);

  async function save() {
    setErr(''); setSaved(false);
    const clean = rows.filter((r) => r.name.trim() && r.value !== '');
    if (!clean.length) { setErr('Add at least one name/value.'); return; }
    try { await api.baasSetFunctionSecrets(token, projectId, clean.map((r) => ({ name: r.name.trim(), value: r.value }))); setRows([{ name: '', value: '' }]); setSaved(true); load(); }
    catch (e) { setErr((e as Error).message); }
  }
  async function del(name: string) { try { await api.baasDeleteFunctionSecret(token, projectId, name); load(); } catch (e) { setErr((e as Error).message); } }

  const list = (secrets ?? []).filter((s) => !query || s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold font-display text-text-primary">Edge Function Secrets</h3>
        <p className="text-xs text-text-muted">Manage encrypted values for your functions.</p>
      </div>

      {/* Add or replace */}
      <div className="rounded-2xl border border-neutral-border bg-surface-card">
        <p className="border-b border-neutral-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Add or replace secrets</p>
        <div className="space-y-3 p-4">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <input value={r.name} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="e.g. CLIENT_KEY" className="rounded-lg border border-neutral-border px-3 py-2 font-mono text-sm" />
              <div className="relative">
                <textarea value={r.value} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} rows={1} placeholder="value" className="w-full rounded-lg border border-neutral-border px-3 py-2 pr-9 font-mono text-sm" style={reveal ? undefined : ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)} />
                <button onClick={() => setReveal((v) => !v)} className="absolute right-2 top-2.5 text-text-muted hover:text-text-primary" aria-label="Toggle reveal">{reveal ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button onClick={() => setRows((rs) => [...rs, { name: '', value: '' }])} className="text-xs text-primary-blue hover:underline">+ Add another</button>
            <div className="flex items-center gap-2">
              {saved && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check size={13} /> Saved</span>}
              <button onClick={save} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Save</button>
            </div>
          </div>
        </div>
      </div>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
      {down && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"><ServerCrash size={16} /> Backend not deployed — secrets apply once it&apos;s live.</div>}

      {/* Custom secrets */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div><p className="text-sm font-semibold text-text-primary">Custom secrets</p><p className="text-xs text-text-muted">Secrets you have defined for this project.</p></div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for a secret" className="w-48 rounded-lg border border-neutral-border px-3 py-1.5 text-sm" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-neutral-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-secondary text-xs uppercase text-text-muted"><tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Digest (SHA256)</th><th className="px-4 py-2 font-medium">Updated</th><th className="px-4 py-2" /></tr></thead>
            <tbody className="divide-y divide-neutral-border">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" size={18} /></td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center"><p className="text-sm font-medium text-text-primary">No custom secrets created</p><p className="text-xs text-text-muted">This project has no custom secrets yet.</p></td></tr>
              ) : list.map((s) => (
                <tr key={s.name}>
                  <td className="px-4 py-2.5 font-mono text-text-primary">{s.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-text-muted">{s.digest.slice(0, 16)}…</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">{new Date(s.updated_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-right"><button onClick={() => del(s.name)} className="text-text-muted hover:text-red-600" aria-label="Delete"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Default secrets (reference) */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div><p className="text-sm font-semibold text-text-primary">Default secrets</p><p className="text-xs text-text-muted">Reserved secrets available in every project.</p></div>
          <BookOpen size={15} className="text-text-muted" />
        </div>
        <div className="divide-y divide-neutral-border rounded-2xl border border-neutral-border">
          {DEFAULT_SECRETS.map(([name, desc]) => (
            <div key={name} className="flex items-center gap-4 px-4 py-2.5">
              <code className="rounded bg-bg-secondary px-2 py-0.5 font-mono text-xs text-text-primary">{name}</code>
              <span className="text-xs text-text-muted">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
