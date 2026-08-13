'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Network, RefreshCw, MessagesSquare, Globe, MessageCircle, Hash, Plug, FlaskConical } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { agentMonitor, type AgentRunRow } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';

const CHANNELS: { id: string; label: string; icon: typeof Globe }[] = [
  { id: '', label: 'All channels', icon: MessagesSquare },
  { id: 'widget', label: 'Website', icon: Globe },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'slack', label: 'Slack', icon: Hash },
  { id: 'api', label: 'API', icon: Plug },
  { id: 'test', label: 'Test', icon: FlaskConical },
];
const CHANNEL_META: Record<string, { label: string; cls: string }> = {
  widget:   { label: 'Website',  cls: 'bg-accent-weak text-accent' },
  whatsapp: { label: 'WhatsApp', cls: 'bg-ok-bg text-ok' },
  slack:    { label: 'Slack',    cls: 'bg-purple-50 text-purple-600' },
  api:      { label: 'API',      cls: 'bg-surface-hover text-dash-body' },
  test:     { label: 'Test',     cls: 'bg-surface-hover text-dash-muted' },
};

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ConversationsPage() {
  const { token } = useAuth();
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [channel, setChannel] = useState('');
  const [selected, setSelected] = useState<AgentRunRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try { setRuns((await agentMonitor.conversations(token, { channel: channel || undefined, limit: 200 })).runs); setError(''); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token, channel]);
  useEffect(() => { load(); }, [load]);

  const active = useMemo(() => selected ?? runs[0] ?? null, [selected, runs]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Conversations"
        subtitle="Every message your agents and teams have handled — across the website widget, WhatsApp, Slack, the API, and test runs."
        actions={
          <button onClick={() => { setLoading(true); load(); }} disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {/* Channel filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        {CHANNELS.map((c) => {
          const Icon = c.icon;
          const on = channel === c.id;
          return (
            <button key={c.id || 'all'} onClick={() => { setChannel(c.id); setSelected(null); }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${on ? 'border-accent bg-accent-weak text-accent' : 'border-neutral-border bg-surface-card text-dash-muted hover:bg-surface-hover'}`}>
              <Icon size={13} /> {c.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* List */}
        <div className="overflow-hidden rounded-xl border border-neutral-border bg-surface-card">
          <div className="border-b border-neutral-border px-5 py-3">
            <h3 className="text-sm font-semibold text-dash-heading">Recent {loading ? '' : `(${runs.length})`}</h3>
          </div>
          <ul className="max-h-[70vh] divide-y divide-neutral-border overflow-y-auto">
            {runs.map((r) => {
              const on = active?.id === r.id;
              const meta = CHANNEL_META[r.channel] ?? { label: r.channel, cls: 'bg-surface-hover text-dash-muted' };
              return (
                <li key={r.id}>
                  <button onClick={() => setSelected(r)}
                    className={`block w-full px-5 py-3 text-left hover:bg-surface-hover ${on ? 'bg-surface-hover' : ''}`}>
                    <div className="mb-1 flex items-center gap-2">
                      {r.subject_type === 'team' ? <Network size={13} className="text-accent" /> : <Bot size={13} className="text-accent" />}
                      <span className="truncate text-sm font-medium text-dash-heading">{r.subject_name || `${r.subject_type} ${r.subject_id}`}</span>
                      <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <p className="truncate text-sm text-dash-body">{r.user_message || '—'}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-dash-muted">
                      <span>{timeAgo(r.created_at)}</span>
                      {r.status === 'error' && <span className="text-red-600">· error</span>}
                      {r.credits_used > 0 && <span>· {r.credits_used} cr</span>}
                    </div>
                  </button>
                </li>
              );
            })}
            {!loading && runs.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-dash-muted">No conversations yet. Once your agents handle messages, they show up here.</li>
            )}
          </ul>
        </div>

        {/* Detail */}
        <div className="overflow-hidden rounded-xl border border-neutral-border bg-surface-card">
          {active ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-neutral-border px-5 py-3">
                <div className="flex items-center gap-2">
                  {active.subject_type === 'team' ? <Network size={15} className="text-accent" /> : <Bot size={15} className="text-accent" />}
                  <span className="font-semibold text-dash-heading">{active.subject_name || `${active.subject_type} ${active.subject_id}`}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-dash-muted">
                  <span className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide ${(CHANNEL_META[active.channel] ?? { cls: 'bg-surface-hover text-dash-muted' }).cls}`}>{(CHANNEL_META[active.channel] ?? { label: active.channel }).label}</span>
                  <span>{new Date(active.created_at).toLocaleString()}</span>
                  {active.model && <span className="font-mono">· {active.model}</span>}
                  {active.credits_used > 0 && <span>· {active.credits_used} credits</span>}
                  {active.conversation_id && <span className="truncate">· thread {active.conversation_id}</span>}
                </div>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-dash-muted">User</div>
                  <div className="rounded-lg bg-surface-hover px-4 py-3 text-sm text-dash-body whitespace-pre-wrap">{active.user_message || '—'}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-dash-muted">Reply</div>
                  <div className={`rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${active.status === 'error' ? 'bg-red-50 text-red-600' : 'bg-accent-weak text-dash-body'}`}>{active.reply || '—'}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-dash-muted">Select a conversation to read the full exchange.</div>
          )}
        </div>
      </div>
    </div>
  );
}
