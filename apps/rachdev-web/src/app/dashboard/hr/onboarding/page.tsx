'use client';

import { useState } from 'react';
import { Loader2, Send, Sparkles, Check, Square, CheckSquare, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import { Pill, DraftCard, CARD, BTN, BTN_GHOST } from '@/components/dashboard/hr/bits';
import { formatDate, type OnboardingPlan } from '@/lib/hr/demo';

export default function HrOnboardingPage() {
  const { token } = useAuth();
  const { get, loading, error, reload, setLoading } = useHr(['onboarding']);
  const plans = get<OnboardingPlan>('onboarding');
  const [busy, setBusy] = useState('');

  async function run(key: string, fn: () => Promise<unknown>) {
    if (!token) return;
    setBusy(key);
    try { await fn(); await reload(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Onboarding"
        subtitle="Each joiner's plan — day-1 schedule, checklist, group invites, and an AI-drafted induction kit a human approves before sharing."
        actions={
          <button onClick={() => { setLoading(true); reload(); }} disabled={loading} className={BTN_GHOST}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-dash-muted">Loading…</p>
      ) : plans.length === 0 ? (
        <p className="mt-6 text-sm text-dash-muted">No onboarding plans yet.</p>
      ) : (
        <div className="mt-6 space-y-5">
          {plans.map((p) => {
            const doneCount = p.checklist.filter((c) => c.status === 'done').length;
            const invitesPending = p.invites.some((i) => i.status === 'not_sent');
            return (
              <div key={p.id} className={`${CARD} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-dash-heading">{p.joinerName}</h3>
                    <p className="mt-0.5 text-[12px] text-dash-muted">
                      Day 1: {formatDate(p.day1.date)} · {p.day1.location} · Reporting to {p.day1.reportingTo} · Buddy {p.buddyName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Pill className={p.bgvStatus === 'clear' ? 'bg-ok-bg text-ok' : 'bg-amber-50 text-amber-600'}>BGV {p.bgvStatus.replace('_', ' ')}</Pill>
                    <Pill>{doneCount}/{p.checklist.length} tasks</Pill>
                  </div>
                </div>

                {/* Checklist */}
                <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
                  {p.checklist.map((c) => (
                    <button key={c.id} disabled={!!busy} onClick={() => run(`chk-${p.id}-${c.id}`, () => hr.onboarding.toggleChecklist(p.id, c.id, token!))}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-surface-hover disabled:opacity-50">
                      {c.status === 'done' ? <CheckSquare size={15} className="text-ok" /> : <Square size={15} className="text-dash-muted" />}
                      <span className={c.status === 'done' ? 'text-dash-muted line-through' : 'text-dash-body'}>{c.item}</span>
                      <span className="ml-auto text-[10px] uppercase text-dash-muted">{c.owner}</span>
                    </button>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className={BTN_GHOST} disabled={!invitesPending || !!busy} onClick={() => run(`inv-${p.id}`, () => hr.onboarding.sendInvites(p.id, token!))}>
                    {busy === `inv-${p.id}` ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {invitesPending ? 'Send group invites' : 'Invites sent'}
                  </button>
                  {!p.inductionKit && (
                    <button className={BTN} disabled={!!busy} onClick={() => run(`kit-${p.id}`, () => hr.onboarding.generateKit(p.id, token!))}>
                      {busy === `kit-${p.id}` ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate induction kit
                    </button>
                  )}
                </div>

                {/* Induction kit */}
                {p.inductionKit && (
                  <div className="mt-4 space-y-3">
                    <DraftCard
                      title="Induction kit" body={p.inductionKit.body}
                      approved={p.inductionKit.status === 'approved'} approvedByName={p.inductionKit.approvedByName}
                      busy={busy === `apk-${p.id}`}
                      onApprove={() => run(`apk-${p.id}`, () => hr.onboarding.approveKit(p.id, token!))}
                    />
                    <div className="flex flex-wrap gap-2">
                      {p.inductionKit.modules.map((m) => (
                        <button key={m.key} disabled={m.status === 'completed' || !!busy}
                          onClick={() => run(`mod-${p.id}-${m.key}`, () => hr.onboarding.completeModule(p.id, m.key, token!))}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${m.status === 'completed' ? 'bg-ok-bg text-ok' : 'border border-neutral-border text-dash-body hover:bg-surface-hover'}`}>
                          {m.status === 'completed' ? <Check size={12} /> : null} {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
