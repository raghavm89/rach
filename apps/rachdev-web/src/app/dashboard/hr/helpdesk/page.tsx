'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Loader2, Sparkles, Send, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import { Pill, CARD, INPUT, BTN, BTN_GHOST } from '@/components/dashboard/hr/bits';
import {
  TICKET_STATUS_LABELS, formatDateTime,
  type HrTicket, type Employee, type TicketStatus,
} from '@/lib/hr/demo';

const STATUS_CLASS: Record<TicketStatus, string> = {
  open: 'bg-amber-50 text-amber-600', awaiting_employee: 'bg-accent-weak text-accent', resolved: 'bg-ok-bg text-ok',
};

function slaChip(t: HrTicket) {
  if (t.status === 'resolved') return null;
  const hrs = Math.round((new Date(t.slaDueAt).getTime() - Date.now()) / 3_600_000);
  if (hrs < 0) return <Pill className="bg-red-50 text-red-600"><Clock size={11} className="mr-1" /> SLA breached</Pill>;
  return <Pill className="bg-surface-hover text-dash-muted"><Clock size={11} className="mr-1" /> {hrs}h left</Pill>;
}

export default function HrHelpdeskPage() {
  const { token } = useAuth();
  const { get, loading, error, reload, setLoading } = useHr(['tickets', 'employees']);
  const tickets = get<HrTicket>('tickets');
  const empMap = new Map(get<Employee>('employees').map((e) => [e.id, e]));
  const [selId, setSelId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState('');

  const sel = tickets.find((t) => t.id === selId) ?? tickets[0];
  useEffect(() => { if (sel && sel.replyDraft && !reply) setReply(sel.replyDraft.body); }, [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(key: string, fn: () => Promise<unknown>) {
    if (!token) return; setBusy(key);
    try { await fn(); await reload(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Helpdesk"
        subtitle="Tickets escalated from Ask HR when the bot has no scripted answer. Replies can be AI-drafted but a human always sends. 48-hour SLA."
        actions={<button onClick={() => { setLoading(true); reload(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>}
      />
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      {loading ? <p className="mt-6 text-sm text-dash-muted">Loading…</p> : tickets.length === 0 ? (
        <p className="mt-6 text-sm text-dash-muted">No tickets — nothing has escalated from Ask HR.</p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
          {/* List */}
          <div className="space-y-2">
            {tickets.map((t) => (
              <button key={t.id} onClick={() => { setSelId(t.id); setReply(''); }}
                className={`${CARD} block w-full p-3 text-left ${sel?.id === t.id ? 'ring-1 ring-accent' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-dash-heading">{t.subject}</span>
                  <Pill className={STATUS_CLASS[t.status]}>{TICKET_STATUS_LABELS[t.status]}</Pill>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] text-dash-muted">{empMap.get(t.employeeId)?.name ?? t.employeeId}</span>
                  {slaChip(t)}
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          {sel && (
            <div className={`${CARD} p-5`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-dash-heading">{sel.subject}</h3>
                  <p className="mt-0.5 text-[11px] text-dash-muted">{empMap.get(sel.employeeId)?.name} · {formatDateTime(sel.createdAt)}</p>
                </div>
                <Pill className={STATUS_CLASS[sel.status]}>{TICKET_STATUS_LABELS[sel.status]}</Pill>
              </div>
              <p className="mt-3 rounded-lg bg-surface-hover p-3 text-[13px] text-dash-body">{sel.body}</p>

              {/* Thread */}
              {sel.replies?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {sel.replies.map((r, i) => (
                    <div key={i} className="rounded-lg border border-neutral-border p-3">
                      <div className="flex items-center justify-between text-[11px] text-dash-muted">
                        <span className="font-medium text-dash-heading">{r.authorName}</span>
                        <span>{formatDateTime(r.at)}{r.viaAiDraft ? ' · from AI draft' : ''}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] text-dash-body">{r.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {sel.status !== 'resolved' && (
                <div className="mt-4">
                  {sel.replyDraft && <p className="mb-1 flex items-center gap-1 text-[11px] text-accent"><Sparkles size={12} /> AI draft loaded — edit before sending.</p>}
                  <textarea rows={5} className={INPUT} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className={BTN_GHOST} disabled={!!busy} onClick={() => run('draft', async () => { const t = await hr.ticket.draftReply(sel.id, token!) as HrTicket; if (t?.replyDraft) setReply(t.replyDraft.body); })}>
                      {busy === 'draft' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Draft reply
                    </button>
                    <button className={BTN_GHOST} disabled={!reply.trim() || !!busy} onClick={() => run('send', async () => { await hr.ticket.reply(sel.id, { body: reply.trim(), resolve: false }, token!); setReply(''); })}>
                      <Send size={14} /> Send
                    </button>
                    <button className={BTN} disabled={!reply.trim() || !!busy} onClick={() => run('resolve', async () => { await hr.ticket.reply(sel.id, { body: reply.trim(), resolve: true }, token!); setReply(''); })}>
                      <CheckCircle2 size={14} /> Send & resolve
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
