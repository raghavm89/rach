'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Send, MessageCircleQuestion, Ticket } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useMySpace } from '@/lib/hr/useMySpace';
import { Pill, CARD, INPUT, BTN } from '@/components/dashboard/hr/bits';
import { TICKET_STATUS_LABELS, formatDateTime, type TicketStatus } from '@/lib/hr/demo';

interface Turn { role: 'you' | 'hr'; text: string; escalated?: boolean }

const STATUS_CLASS: Record<TicketStatus, string> = {
  open: 'bg-amber-50 text-amber-600', awaiting_employee: 'bg-accent-weak text-accent', resolved: 'bg-ok-bg text-ok',
};

export default function AskHrPage() {
  const { token } = useAuth();
  const { tickets, reload } = useMySpace();
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (!token || !q.trim()) return;
    const question = q.trim();
    setTurns((t) => [...t, { role: 'you', text: question }]);
    setQ(''); setBusy(true);
    try {
      const r = await hr.askHr(question, token);
      setTurns((t) => [...t, { role: 'hr', text: r.answer, escalated: r.escalated }]);
      if (r.escalated) await reload();
    } catch (e) {
      setTurns((t) => [...t, { role: 'hr', text: (e as Error).message }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/hr/me" className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-muted hover:text-accent"><ArrowLeft size={15} /> My Space</Link>
      <PageHeader title="Ask HR" subtitle="Answers to common questions are instant. Anything the bot can't answer becomes a ticket People Ops replies to within 48 hours." />

      <div className={`${CARD} mt-6 p-4`}>
        <div className="min-h-[160px] space-y-3">
          {turns.length === 0 && (
            <p className="flex items-center gap-2 py-8 text-center text-sm text-dash-muted">
              <MessageCircleQuestion size={16} /> Ask about leave, insurance, PF, ID cards, payslips…
            </p>
          )}
          {turns.map((t, i) => (
            <div key={i} className={t.role === 'you' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] ${t.role === 'you' ? 'bg-accent text-white' : 'bg-surface-hover text-dash-body'}`}>
                {t.text}
                {t.escalated && <div className="mt-1.5 flex items-center gap-1 text-[11px] opacity-90"><Ticket size={11} /> Escalated to a ticket</div>}
              </div>
            </div>
          ))}
          {busy && <div className="flex justify-start"><div className="rounded-2xl bg-surface-hover px-3.5 py-2"><Loader2 size={14} className="animate-spin text-dash-muted" /></div></div>}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} className={INPUT} placeholder="Type your question…" />
          <button className={BTN} disabled={!q.trim() || busy} onClick={ask}><Send size={15} /></button>
        </div>
      </div>

      {tickets.length > 0 && (
        <>
          <h3 className="mb-3 mt-8 text-sm font-semibold text-dash-heading">My tickets</h3>
          <div className="space-y-2">
            {tickets.map((t) => (
              <div key={t.id} className={`${CARD} p-4`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-dash-heading">{t.subject}</span>
                  <Pill className={STATUS_CLASS[t.status]}>{TICKET_STATUS_LABELS[t.status]}</Pill>
                </div>
                <p className="mt-1 text-[11px] text-dash-muted">Raised {formatDateTime(t.createdAt)}</p>
                {t.replies?.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {t.replies.map((r, i) => (
                      <div key={i} className="rounded-lg bg-surface-hover p-2.5 text-[12px] text-dash-body">
                        <span className="font-medium text-dash-heading">{r.authorName}: </span>{r.body}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
