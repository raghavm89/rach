'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import {
  support,
  type Ticket, type TicketMessage, type TicketStatus, type TicketPriority, type TicketCategory,
} from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';

const CATEGORIES = ['agent', 'account', 'other'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const STATUSES: TicketStatus[] = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'];

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open', in_progress: 'In progress', waiting_on_customer: 'Awaiting you', resolved: 'Resolved', closed: 'Closed',
};
const STATUS_CLASS: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-accent-weak text-accent',
  waiting_on_customer: 'bg-wait-bg text-wait',
  resolved: 'bg-ok-bg text-ok',
  closed: 'bg-surface-hover text-dash-muted',
};

export default function SupportPage() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try { const r = await support.list(token); setTickets(r.tickets); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (openId != null && token) {
    return <TicketDetail id={openId} token={token} isAdmin={isAdmin} onBack={() => { setOpenId(null); load(); }} />;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Support"
        subtitle="Raise a ticket and track its progress"
        actions={
          <button onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Plus size={15} /> New ticket
          </button>
        }
      />

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {creating && token && <NewTicket token={token} onCreated={() => { setCreating(false); setLoading(true); load(); }} onCancel={() => setCreating(false)} />}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-border bg-surface-card">
          {tickets.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-dash-muted">No tickets yet.</p>
          ) : tickets.map((t) => (
            <button key={t.id} onClick={() => setOpenId(t.id)} className="flex w-full items-center justify-between gap-3 border-b border-neutral-border px-5 py-3 text-left last:border-0 hover:bg-surface-hover">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-dash-heading">{t.subject}</p>
                <p className="text-xs text-dash-muted">
                  #{t.id} · {t.category}{isAdmin && t.user_name ? ` · ${t.user_name}` : ''} · {new Date(t.updated_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[t.status]}`}>{STATUS_LABEL[t.status]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewTicket({ token, onCreated, onCancel }: { token: string; onCreated: () => void; onCancel: () => void }) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('agent');
  const [priority, setPriority] = useState('normal');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!subject.trim()) return;
    setSaving(true); setErr('');
    try {
      await support.create(token, { subject: subject.trim(), body: body.trim() || undefined, category: category as TicketCategory, priority: priority as TicketPriority });
      onCreated();
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  return (
    <div className="mb-5 rounded-xl border border-neutral-border bg-surface-card p-5">
      <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-neutral-border bg-surface-app px-2 py-2 text-sm text-dash-muted focus:border-accent focus:outline-none">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-neutral-border bg-surface-app px-2 py-2 text-sm text-dash-muted focus:border-accent focus:outline-none">
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Describe the issue…" className="w-full resize-y rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button onClick={submit} disabled={saving || !subject.trim()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {saving && <Loader2 size={14} className="animate-spin" />} Submit
        </button>
        <button onClick={onCancel} className="text-sm text-dash-muted hover:text-dash-heading">Cancel</button>
      </div>
    </div>
  );
}

function TicketDetail({ id, token, isAdmin, onBack }: { id: number; token: string; isAdmin: boolean; onBack: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await support.get(token, id);
    setTicket(r.ticket); setMessages(r.messages); setLoading(false);
  }, [token, id]);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try { await support.reply(token, id, reply.trim()); setReply(''); await load(); }
    finally { setSending(false); }
  };

  const setStatus = async (status: TicketStatus) => { await support.update(token, id, { status }); await load(); };

  if (loading || !ticket) return <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-muted hover:text-dash-heading"><ArrowLeft size={15} /> Back to tickets</button>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-dash-heading">{ticket.subject}</h2>
          <p className="text-xs text-dash-muted">#{ticket.id} · {ticket.category} · {ticket.priority}</p>
        </div>
        {isAdmin ? (
          <select value={ticket.status} onChange={(e) => setStatus(e.target.value as TicketStatus)} className="rounded-lg border border-neutral-border bg-surface-app px-2 py-1 text-sm text-dash-muted focus:border-accent focus:outline-none">
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        ) : (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[ticket.status]}`}>{STATUS_LABEL[ticket.status]}</span>
        )}
      </div>

      <div className="space-y-3">
        {ticket.body && (
          <div className="rounded-xl border border-neutral-border bg-surface-hover/50 px-4 py-3 text-sm text-dash-heading">{ticket.body}</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`rounded-xl border px-4 py-3 text-sm ${m.author_type === 'support' ? 'border-accent-line bg-accent-weak/40' : 'border-neutral-border bg-surface-card'}`}>
            <p className="mb-1 text-xs font-semibold text-dash-muted">{m.author_type === 'support' ? 'Support' : (m.author_name || 'You')} · {new Date(m.created_at).toLocaleString()}</p>
            <p className="whitespace-pre-wrap text-dash-heading">{m.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== 'closed' && (
        <div className="mt-4 flex items-end gap-2">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Write a reply…" className="flex-1 resize-y rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-heading focus:border-accent focus:outline-none" />
          <button onClick={send} disabled={sending || !reply.trim()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send
          </button>
        </div>
      )}
    </div>
  );
}
