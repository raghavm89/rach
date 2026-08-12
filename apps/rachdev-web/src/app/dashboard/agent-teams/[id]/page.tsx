'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, UploadCloud, Rocket, Sparkles, Send, Coins, ArrowRight, Download, Wand2, Code2, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { agentTeams, agentBuilder, type AgentTeam, type TeamGraph, type TeamTraceStep, type WidgetEmbed, type ModelOption } from '@rach/ui/lib/api';
import { TeamEditor } from '@/components/dashboard/teams/TeamEditor';
import { TeamLogic } from '@/components/dashboard/teams/TeamLogic';
import { TeamTechnical } from '@/components/dashboard/teams/TeamTechnical';

type Layer = 'blocks' | 'logic' | 'technical';
const LAYERS: { id: Layer; label: string; blurb: string }[] = [
  { id: 'blocks', label: 'L1 Blocks', blurb: 'Blocks — your agent team and the main flow.' },
  { id: 'logic', label: 'L2 Logic', blurb: 'Logic — routing rules that decide which specialist handles each message.' },
  { id: 'technical', label: 'L3 Technical', blurb: 'Technical — raw configuration and the exportable graph.' },
];

interface TeamMsg { role: 'you' | 'team'; content: string; trace?: TeamTraceStep[]; credits?: number }

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-surface-hover text-dash-muted', published: 'bg-accent-weak text-accent',
  deployed: 'bg-ok-bg text-ok', disabled: 'bg-red-50 text-red-600',
};

export default function TeamCanvasPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const { token } = useAuth();
  const [team, setTeam] = useState<AgentTeam | null>(null);
  const [agents, setAgents] = useState<{ id: number; name: string; role?: string }[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [name, setName] = useState('');
  const [layer, setLayer] = useState<Layer>('blocks');

  // Test panel
  const [msgs, setMsgs] = useState<TeamMsg[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, running]);

  async function runTeam() {
    if (!token || !team || !input.trim()) return;
    const message = input.trim();
    setMsgs((m) => [...m, { role: 'you', content: message }]);
    setInput(''); setRunning(true); setPaywall(false);
    try {
      const r = await agentTeams.run(team.id, message, token);
      setMsgs((m) => [...m, { role: 'team', content: r.reply, trace: r.trace, credits: r.creditsUsed }]);
    } catch (e) {
      if ((e as { status?: number }).status === 402) setPaywall(true);
      else setMsgs((m) => [...m, { role: 'team', content: `⚠ ${(e as Error).message}` }]);
    } finally { setRunning(false); }
  }

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [t, d, m] = await Promise.all([agentTeams.get(id, token), agentBuilder.list(token).catch(() => ({ definitions: [] })), agentBuilder.models(token).catch(() => [])]);
      setTeam(t); setName(t.name);
      setAgents(d.definitions.map((a) => ({ id: a.id, name: a.name, role: a.role })));
      setModels(m);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token, id]);
  useEffect(() => { load(); }, [load]);

  async function renameTeam() {
    if (!token || !team) return;
    const n = name.trim();
    if (!n || n === team.name) { setName(team.name); return; }
    try { const t = await agentTeams.update(team.id, { name: n }, token); setTeam(t); setName(t.name); toast.success('Renamed'); }
    catch (e) { toast.error((e as Error).message); setName(team.name); }
  }

  async function publish() {
    if (!token || !team) return;
    setBusy('publish');
    try { const t = await agentTeams.publish(team.id, token); setTeam(t); toast.success(`Published v${t.version}`); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }

  async function saveGraph(graph: TeamGraph) {
    if (!token || !team) return;
    setBusy('save');
    try { const t = await agentTeams.update(team.id, { graph }, token); setTeam(t); toast.success('Saved'); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }

  const [embed, setEmbed] = useState<WidgetEmbed | null>(null);
  async function deploy() {
    if (!token || !team) return;
    setBusy('deploy');
    try {
      const r = await agentTeams.deploy(team.id, token);
      setTeam(r.team); setEmbed({ publicToken: r.publicToken, widgetUrl: r.widgetUrl, embed: r.embed });
      toast.success('Deployed');
    }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }
  async function rotateToken() {
    if (!token || !team) return;
    setBusy('rotate');
    try { const r = await agentTeams.rotateToken(team.id, token); setEmbed(r); toast.success('New token — re-paste the snippet'); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }

  function exportConfig() {
    if (!team) return;
    const blob = new Blob([JSON.stringify({ name: team.name, industry: team.industry, graph: team.graph }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${team.key}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  const [instruction, setInstruction] = useState('');
  async function editByChat() {
    if (!token || !team || !instruction.trim()) return;
    setBusy('edit');
    try { const r = await agentTeams.edit(team.id, instruction.trim(), token); setTeam(r.team); setInstruction(''); toast.success('Applied change'); }
    catch (e) {
      if ((e as { status?: number }).status === 402) toast.error('Out of credits — top up in Billing.');
      else toast.error((e as Error).message);
    }
    finally { setBusy(''); }
  }

  if (loading) return <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  if (error || !team) return <p className="text-sm text-dash-muted">{error || 'Team not found.'} <Link href="/dashboard/agent-teams" className="text-accent">Back</Link></p>;

  const lastTrace = [...msgs].reverse().find((m) => m.role === 'team' && m.trace && m.trace.length)?.trace ?? [];

  const hasWhatsApp = (team.graph?.nodes ?? []).some((n) => {
    const d = (n.data ?? {}) as Record<string, unknown>;
    return n.type === 'channel' && /whatsapp/i.test(String(d.channel ?? d.integration ?? d.label ?? ''));
  });

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/agent-teams" className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-muted hover:text-accent"><ArrowLeft size={15} /> Agent Teams</Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={renameTeam}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setName(team.name); (e.target as HTMLInputElement).blur(); } }}
            aria-label="Team name"
            className="max-w-[280px] rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xl font-semibold text-dash-heading outline-none hover:border-neutral-border focus:border-accent focus:bg-surface-app"
          />
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[team.status] ?? 'bg-surface-hover text-dash-muted'}`}>{team.status}</span>
          <span className="text-[11px] text-dash-muted">v{team.version}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={exportConfig} className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-medium text-dash-body hover:bg-surface-hover" title="Export graph JSON (self-host)"><Download size={13} /> Export</button>
          <button onClick={publish} disabled={!!busy} className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-medium text-dash-body hover:bg-surface-hover disabled:opacity-50">{busy === 'publish' ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} Publish</button>
          <button onClick={deploy} disabled={!!busy || team.version < 1} title={team.version < 1 ? 'Publish before deploying' : 'Deploy on RachBase'} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40">{busy === 'deploy' ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />} Deploy</button>
        </div>
      </div>

      {/* Chat-to-edit */}
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-weak/40 px-3 py-2">
        <Wand2 size={16} className="shrink-0 text-accent" />
        <input value={instruction} onChange={(e) => setInstruction(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && editByChat()} disabled={busy === 'edit'}
          className="w-full bg-transparent text-sm text-dash-heading outline-none placeholder:text-dash-muted" placeholder="Describe a change — e.g. “add a returns specialist that handles refunds”" />
        <button onClick={editByChat} disabled={!instruction.trim() || busy === 'edit'} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {busy === 'edit' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Apply
        </button>
      </div>

      {/* L1 / L2 / L3 tabs */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-neutral-border bg-surface-card p-1">
          {LAYERS.map((l) => (
            <button key={l.id} onClick={() => setLayer(l.id)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${layer === l.id ? 'bg-accent-weak text-accent' : 'text-dash-muted hover:text-dash-body'}`}>
              {l.label}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-dash-muted">{LAYERS.find((l) => l.id === layer)?.blurb}</p>
      </div>

      {layer === 'blocks' && (
        <>
          <TeamEditor key={team.updated_at} initialGraph={team.graph} onSave={saveGraph} saving={busy === 'save'} agents={agents} models={models} />
          <p className="mt-2 text-[11px] text-dash-muted">Editing the graph resets the team to draft; Publish to freeze a version.</p>
        </>
      )}
      {layer === 'logic' && (
        <TeamLogic key={`logic-${team.updated_at}`} graph={team.graph} onSave={saveGraph} saving={busy === 'save'} lastTrace={lastTrace} />
      )}
      {layer === 'technical' && (
        <TeamTechnical key={`tech-${team.updated_at}`} graph={team.graph} onImport={saveGraph} saving={busy === 'save'} />
      )}

      {/* Website widget embed — appears after deploy */}
      {embed && (
        <div className="mt-4 rounded-2xl border border-neutral-border bg-surface-card p-5">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-dash-heading"><Code2 size={15} className="text-accent" /> Embed on your website</h3>
          <p className="mt-0.5 text-[12px] text-dash-muted">Paste this snippet before <code className="rounded bg-surface-hover px-1">&lt;/body&gt;</code>. A chat bubble appears bottom-right and talks to this team.</p>
          <div className="mt-3 flex items-start gap-2">
            <pre className="flex-1 overflow-x-auto rounded-lg bg-surface-app px-3 py-2.5 text-[12px] text-dash-body ring-1 ring-neutral-border"><code>{embed.embed}</code></pre>
            <button onClick={() => { navigator.clipboard.writeText(embed.embed); toast.success('Copied'); }} title="Copy snippet" className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-2 text-xs font-medium text-dash-body hover:bg-surface-hover"><Copy size={13} /> Copy</button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-dash-muted">Conversations spend this workspace&apos;s credits. The token is public — rotate it to revoke old embeds.</p>
            <button onClick={rotateToken} disabled={busy === 'rotate'} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-border px-2.5 py-1.5 text-[11px] font-medium text-dash-body hover:bg-surface-hover disabled:opacity-50">{busy === 'rotate' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Rotate</button>
          </div>

          {embed.whatsappWebhookUrl && hasWhatsApp && (
            <div className="mt-4 border-t border-neutral-border pt-3">
              <p className="text-[12px] font-medium text-dash-heading">WhatsApp webhook</p>
              <p className="mt-0.5 text-[11px] text-dash-muted">In your BSP (Meta / Gupshup) set this as the callback URL, with the verify token you saved under Connections → WhatsApp.</p>
              <div className="mt-2 flex items-start gap-2">
                <pre className="flex-1 overflow-x-auto rounded-lg bg-surface-app px-3 py-2 text-[12px] text-dash-body ring-1 ring-neutral-border"><code>{embed.whatsappWebhookUrl}</code></pre>
                <button onClick={() => { navigator.clipboard.writeText(embed.whatsappWebhookUrl!); toast.success('Copied'); }} title="Copy URL" className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-2 text-xs font-medium text-dash-body hover:bg-surface-hover"><Copy size={13} /> Copy</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Test the team */}
      <div className="mt-6 rounded-2xl border border-neutral-border bg-surface-card p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-dash-heading"><Sparkles size={15} className="text-accent" /> Test the team</h3>
        <p className="mt-0.5 text-[12px] text-dash-muted">Send a message — the conductor routes it to a specialist. Each run spends credits.</p>

        {paywall && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-amber-800"><Coins size={16} /> You&apos;re out of credits.</p>
            <Link href="/dashboard/billing" className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90">Top up →</Link>
          </div>
        )}

        <div ref={scrollRef} className="mt-3 max-h-[340px] min-h-[120px] space-y-2 overflow-y-auto">
          {msgs.length === 0 && !running && <p className="py-6 text-center text-[13px] text-dash-muted">No messages yet. Try a customer question your team should handle.</p>}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'you' ? 'flex justify-end' : 'flex flex-col items-start'}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] ${m.role === 'you' ? 'bg-accent text-white' : 'bg-surface-hover text-dash-body'}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.credits != null && <p className="mt-1 text-[10px] opacity-70">−{m.credits} credit{m.credits === 1 ? '' : 's'}</p>}
              </div>
              {m.trace && m.trace.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1 pl-1 text-[11px] text-dash-muted">
                  {m.trace.map((s, j) => (
                    <span key={j} className="flex items-center gap-1">
                      {j > 0 && <ArrowRight size={11} />}
                      <span className="rounded-full bg-surface-hover px-2 py-0.5"><span className="font-medium text-dash-body">{s.label}</span> · {s.detail}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {running && <div className="flex justify-start"><div className="rounded-2xl bg-surface-hover px-3.5 py-2"><Loader2 size={14} className="animate-spin text-dash-muted" /></div></div>}
        </div>

        <div className="mt-3 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runTeam()} disabled={running}
            className="w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading outline-none focus:border-accent" placeholder="Message your team…" />
          <button onClick={runTeam} disabled={!input.trim() || running} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"><Send size={15} /></button>
        </div>
      </div>
    </div>
  );
}
