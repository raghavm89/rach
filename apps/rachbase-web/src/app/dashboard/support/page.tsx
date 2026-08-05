'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LifeBuoy, Plus, Loader2, X, Send, RefreshCw, CheckCircle2, RotateCcw, Sparkles, Bot } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import {
  support, Ticket, TicketMessage, TicketStatus, TicketPriority, TicketCategory, ChatOption,
} from '@rach/ui/lib/api';

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open', in_progress: 'In progress', waiting_on_customer: 'Awaiting you', resolved: 'Resolved', closed: 'Closed',
};
const STATUS_CLASS: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  waiting_on_customer: 'bg-violet-100 text-violet-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-surface-hover text-neutral-600',
};
const PRIORITY_CLASS: Record<TicketPriority, string> = {
  low: 'text-neutral-500', normal: 'text-neutral-600', high: 'text-orange-600', urgent: 'text-red-600',
};
const CATEGORIES: TicketCategory[] = ['billing', 'deployment', 'vm', 'account', 'other'];
const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

export default function SupportPage() {
  const { token, user } = useAuth();
  const isSupport = user?.role === 'admin';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState<TicketStatus | ''>('');
  const [creating, setCreating] = useState(false);
  const [seedBody, setSeedBody] = useState('');
  const [seedSource, setSeedSource] = useState<'human' | 'bot'>('human');
  const [openId, setOpenId]   = useState<number | null>(null);
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [limit, setLimit]     = useState(20);
  const newTicket = (body = '', source: 'human' | 'bot' = 'human') => { setSeedBody(body); setSeedSource(source); setCreating(true); };

  // Reset to the first page whenever the status filter changes.
  useEffect(() => { setPage(1); }, [filter]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const r = await support.list(token, { ...(filter ? { status: filter } : {}), page });
      setTickets(r.tickets);
      setTotal(r.total); setLimit(r.limit);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token, filter, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="max-w-5xl mx-auto py-6 px-1">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center w-9 h-9 rounded-lg bg-black/5 text-black/60"><LifeBuoy size={17} /></div>
          <div>
            <h1 className="text-lg font-semibold text-black">Support</h1>
            <p className="text-xs text-black/50">Raise an issue and track it to resolution.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-black/12 text-black/50 hover:bg-black/5 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => newTicket()} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-solid text-white px-3 py-2 text-xs font-semibold hover:bg-neutral-800">
            <Plus size={14} /> New ticket
          </button>
        </div>
      </div>

      <SupportChat token={token!} onRaiseTicket={(transcript) => newTicket(transcript, 'bot')} />

      <div className="flex items-center gap-1.5 mb-4">
        {(['', 'open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === s ? 'bg-ink-solid text-white' : 'bg-black/5 text-black/50 hover:text-black/70'}`}>
            {s === '' ? 'All' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-black/30" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20 text-black/40">
          <p className="text-sm">No tickets yet.</p>
          <button onClick={() => newTicket()} className="mt-3 text-sm font-semibold text-primary-blue hover:underline">Raise your first ticket →</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => setOpenId(t.id)}
              className="w-full flex items-center gap-3 rounded-xl border border-black/10 bg-surface-card px-4 py-3 text-left hover:border-black/25 transition-colors">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[t.status]}`}>{STATUS_LABEL[t.status]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-black truncate">{t.subject}</p>
                <p className="text-[11px] text-black/40">#{t.id} · {t.category} · <span className={PRIORITY_CLASS[t.priority]}>{t.priority}</span>{t.source === 'bot' ? ' · via assistant' : ''}{t.user_name ? ` · ${t.user_name}` : ''}</p>
                {isSupport && (
                  <p className="text-[11px] text-black/35">User #{t.user_id}{t.user_name ? ` · ${t.user_name}` : ''}{t.user_email ? ` · ${t.user_email}` : ''} · Tenant {t.tenant_id ?? '—'}</p>
                )}
              </div>
              <span className="shrink-0 text-[11px] text-black/35">{new Date(t.updated_at).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-black/50">
          <span>{total} ticket{total === 1 ? '' : 's'} · page {page} of {totalPages}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}
              className="rounded-lg border border-black/12 px-2.5 py-1 font-medium text-black/60 hover:bg-black/5 disabled:opacity-40">Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}
              className="rounded-lg border border-black/12 px-2.5 py-1 font-medium text-black/60 hover:bg-black/5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {creating && <NewTicketModal token={token!} initialBody={seedBody} initialSource={seedSource} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); load(); setOpenId(id); }} />}
      {openId != null && <TicketModal token={token!} id={openId} onClose={() => { setOpenId(null); load(); }} />}
    </div>
  );
}

type ChatTurn = { role: 'user' | 'assistant'; content: string; options?: ChatOption[] };

function SupportChat({ token, onRaiseTicket }: { token: string; onRaiseTicket: (transcript: string) => void }) {
  const [msgs, setMsgs]       = useState<ChatTurn[]>([]);
  const [input, setInput]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [msgs, busy]);

  // Greeting + menu on first render.
  useEffect(() => {
    let cancelled = false;
    support.ask(token, { intent: 'greeting' })
      .then((r) => { if (!cancelled) setMsgs([{ role: 'assistant', content: r.reply, options: r.options }]); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  const ask = async (payload: { message?: string; intent?: string }, echo?: string) => {
    if (busy) return;
    setBusy(true); setErr('');
    if (echo) setMsgs((p) => [...p, { role: 'user', content: echo }]);
    try {
      const r = await support.ask(token, payload);
      setMsgs((p) => [...p, { role: 'assistant', content: r.reply, options: r.options }]);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const send = () => { const t = input.trim(); if (!t) return; setInput(''); ask({ message: t }, t); };
  const transcript = () => msgs.map((m) => `${m.role === 'user' ? 'Me' : 'Assistant'}: ${m.content}`).join('\n\n');

  const clickOption = (opt: ChatOption) => {
    if (opt.action === 'raise_ticket') { onRaiseTicket(transcript()); return; }
    if (opt.intent) ask({ intent: opt.intent }, opt.label);
  };

  const lastOptions = [...msgs].reverse().find((m) => m.role === 'assistant')?.options || [];

  return (
    <div className="mb-5 rounded-xl border border-black/10 bg-surface-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/8 bg-surface-hover/60">
        <div className="grid place-items-center w-6 h-6 rounded-md bg-violet-100 text-violet-700"><Sparkles size={13} /></div>
        <p className="text-xs font-semibold text-black/70">RachBase Assistant</p>
        <span className="text-[11px] text-black/35">· orders, deployments, VMs, billing &amp; how-tos</span>
      </div>

      <div ref={scrollRef} className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
        {msgs.length === 0 && (
          <div className="text-sm text-black/40 py-4 text-center"><Bot size={22} className="mx-auto mb-1.5 text-black/25" /> Loading…</div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary-blue text-white' : 'bg-black/5 text-black/80'}`}>{m.content}</div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="rounded-xl px-3.5 py-2 bg-black/5"><Loader2 size={14} className="animate-spin text-black/40" /></div></div>}
      </div>

      {/* Quick replies */}
      {lastOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {lastOptions.map((opt) => (
            <button key={opt.label} onClick={() => clickOption(opt)} disabled={busy}
              className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 ${opt.action === 'raise_ticket' ? 'bg-ink-solid text-white hover:bg-neutral-800' : 'bg-black/5 text-black/60 hover:bg-black/10'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {err && <p className="px-4 pb-1 text-xs text-red-600">{err}</p>}

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-black/8">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
          placeholder="Ask about an order, deployment, VM, billing…"
          className="flex-1 rounded-lg border border-black/12 px-3 py-2 text-sm outline-none focus:border-primary-blue"
        />
        <button onClick={send} disabled={busy || !input.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink-solid text-white px-3 py-2 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>
    </div>
  );
}

function NewTicketModal({ token, onClose, onCreated, initialBody, initialSource }: { token: string; onClose: () => void; onCreated: (id: number) => void; initialBody?: string; initialSource?: 'human' | 'bot' }) {
  const [subject, setSubject]   = useState('');
  const [body, setBody]         = useState(initialBody || '');
  const [category, setCategory] = useState<TicketCategory>('other');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState('');

  const submit = async () => {
    if (!subject.trim()) { setErr('Subject is required'); return; }
    setBusy(true); setErr('');
    try {
      const r = await support.create(token, { subject: subject.trim(), body: body.trim() || undefined, category, priority, source: initialSource });
      onCreated(r.ticket.id);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-card border border-black/12 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/8">
          <h3 className="text-sm font-semibold text-black">New ticket</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-black/5"><X size={16} className="text-black/40" /></button>
        </div>
        <div className="p-5 space-y-4">
          {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
          <div>
            <label className="mb-1 block text-xs font-medium text-black/60">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary of the issue"
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary-blue" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-black/60">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary-blue capitalize">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-black/60">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary-blue capitalize">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-black/60">Details</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="What happened? Include order ids, service names, or error messages if relevant."
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary-blue resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-black/8">
          <button onClick={onClose} className="rounded-lg border border-black/12 px-3 py-2 text-xs font-semibold text-black/60 hover:bg-black/5">Cancel</button>
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-solid text-white px-3 py-2 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Create ticket
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketModal({ token, id, onClose }: { token: string; id: number; onClose: () => void }) {
  const { user } = useAuth();
  const isSupport = user?.role === 'admin';
  const [ticket, setTicket]     = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [reply, setReply]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await support.get(token, id); setTicket(r.ticket); setMessages(r.messages); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true); setErr('');
    try {
      await support.reply(token, id, reply.trim());
      setReply('');
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const patch = async (p: { status?: TicketStatus; priority?: TicketPriority; assigned_to?: number | null }) => {
    setBusy(true); setErr('');
    try { await support.update(token, id, p); await load(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const setStatus = (status: TicketStatus) => patch({ status });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-surface-card border border-black/12 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        {loading || !ticket ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin text-black/30" /></div>
        ) : (
          <>
            <div className="flex items-start justify-between px-5 py-3.5 border-b border-black/8">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[ticket.status]}`}>{STATUS_LABEL[ticket.status]}</span>
                  <p className="text-sm font-semibold text-black truncate">{ticket.subject}</p>
                </div>
                <p className="mt-0.5 text-[11px] text-black/40">#{ticket.id} · {ticket.category} · {ticket.priority} priority</p>
              </div>
              <button onClick={onClose} className="rounded-md p-1 hover:bg-black/5"><X size={16} className="text-black/40" /></button>
            </div>

            {isSupport && (
              <div className="flex flex-wrap items-center gap-2 px-5 py-2 border-b border-black/8 bg-surface-hover/60 text-xs">
                <span className="text-black/40">Support:</span>
                <select value={ticket.status} onChange={(e) => setStatus(e.target.value as TicketStatus)} disabled={busy}
                  className="rounded-md border border-black/12 px-2 py-1 text-xs">
                  {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <select value={ticket.priority} onChange={(e) => patch({ priority: e.target.value as TicketPriority })} disabled={busy}
                  className="rounded-md border border-black/12 px-2 py-1 text-xs capitalize">
                  {(['low', 'normal', 'high', 'urgent'] as TicketPriority[]).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button onClick={() => user && patch({ assigned_to: user.id })} disabled={busy}
                  className="rounded-md border border-black/12 px-2 py-1 text-xs text-black/60 hover:bg-black/5 disabled:opacity-50">
                  {ticket.assigned_to === user?.id ? 'Assigned to you' : 'Assign to me'}
                </button>
                <span className="text-black/40 ml-auto truncate">User #{ticket.user_id}{ticket.user_name ? ` · ${ticket.user_name}` : ''}{ticket.user_email ? ` · ${ticket.user_email}` : ''} · Tenant {ticket.tenant_id ?? '—'}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
              {messages.length === 0 && <p className="text-center text-black/30 text-sm py-6">No messages yet.</p>}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.author_type === 'customer' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm ${
                    m.author_type === 'customer' ? 'bg-primary-blue text-white'
                    : m.author_type === 'bot' ? 'bg-violet-50 text-violet-900 border border-violet-200'
                    : 'bg-black/5 text-black/80'}`}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={`mt-1 text-[10px] ${m.author_type === 'customer' ? 'text-white/60' : 'text-black/35'}`}>
                      {m.author_type === 'support' ? 'Support' : m.author_type === 'bot' ? 'Assistant' : (m.author_name || 'You')} · {new Date(m.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-black/8 p-3 space-y-2">
              {ticket.status !== 'closed' ? (
                <>
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Write a reply…"
                    className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary-blue resize-none" />
                  <div className="flex items-center justify-between">
                    <button onClick={() => setStatus('closed')} disabled={busy}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/50 hover:text-black/80 disabled:opacity-50">
                      <CheckCircle2 size={13} /> Close ticket
                    </button>
                    <button onClick={send} disabled={busy || !reply.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-ink-solid text-white px-3 py-2 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50">
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-black/40">This ticket is closed.</p>
                  <button onClick={() => setStatus('open')} disabled={busy}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-blue hover:underline disabled:opacity-50">
                    <RotateCcw size={13} /> Reopen
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
