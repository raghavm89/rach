'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, Hourglass } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import { Pill, IdChip, DraftCard, Stars, StarInput, CARD, INPUT, BTN } from '@/components/dashboard/hr/bits';
import { formatDate, type ProbationCheckpoint, type Employee, type ApprovalTask } from '@/lib/hr/demo';

export default function HrProbationPage() {
  const { token } = useAuth();
  const { get, loading, error, reload, setLoading } = useHr(['probation', 'employees', 'approvals']);
  const checkpoints = get<ProbationCheckpoint>('probation');
  const empMap = new Map(get<Employee>('employees').map((e) => [e.id, e]));
  const approvals = get<ApprovalTask>('approvals');
  const [busy, setBusy] = useState('');

  const active = checkpoints
    .filter((c) => c.status !== 'completed')
    .sort((a, b) => (a.status === 'due' ? -1 : 1) - (b.status === 'due' ? -1 : 1) || a.day - b.day);
  const recent = checkpoints.filter((c) => c.status === 'completed').slice(-6).reverse();

  async function run(key: string, fn: () => Promise<unknown>) {
    if (!token) return;
    setBusy(key);
    try { await fn(); await reload(); toast.success('Saved'); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Probation"
        subtitle="Day 7 / 30 / 60 / 90 checkpoints. Check-ins are conversations; day-60/90 evaluations route through Approvals and the AI summary is advisory."
        actions={<button onClick={() => { setLoading(true); reload(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>}
      />
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      {loading ? <p className="mt-6 text-sm text-dash-muted">Loading…</p> : (
        <>
          <h3 className="mb-3 mt-6 text-sm font-semibold text-dash-heading">Active checkpoints</h3>
          {active.length === 0 ? <p className="text-sm text-dash-muted">Nothing pending.</p> : (
            <div className="space-y-4">
              {active.map((c) => {
                const emp = empMap.get(c.employeeId);
                const task = c.approvalTaskId ? approvals.find((t) => t.id === c.approvalTaskId) : undefined;
                return (
                  <div key={c.id} className={`${CARD} p-4`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Hourglass size={16} className="text-accent" />
                        <Link href={`/dashboard/hr/people/${c.employeeId}`} className="font-medium text-dash-heading hover:text-accent">{emp?.name ?? c.employeeId}</Link>
                        {emp && <IdChip id={emp.empCode} />}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Pill className="bg-accent-weak text-accent">Day {c.day}</Pill>
                        <Pill className={c.status === 'due' ? 'bg-amber-50 text-amber-600' : 'bg-surface-hover text-dash-muted'}>{c.status} · due {formatDate(c.due)}</Pill>
                      </div>
                    </div>

                    {/* Check-in (day 7/30) */}
                    {(c.day === 7 || c.day === 30) && !c.checkIn && <CheckInForm busy={busy === `ci-${c.id}`} onSubmit={(notes) => run(`ci-${c.id}`, () => hr.probation.checkIn(c.id, notes, token!))} />}

                    {/* Evaluation (day 60/90 with an approval task) */}
                    {(c.day === 60 || c.day === 90) && !c.evaluation && task && (
                      <EvalForm busy={busy === `ev-${c.id}`} onSubmit={(v) => run(`ev-${c.id}`, () => hr.probation.submitEvaluation(task.id, v, token!))} />
                    )}

                    {c.evaluation?.summaryDraft && (
                      <div className="mt-3">
                        <DraftCard title={`Day-${c.day} summary`} body={c.evaluation.summaryDraft.body}
                          approved={c.evaluation.summaryDraft.status === 'approved'} approvedByName={c.evaluation.summaryDraft.approvedByName}
                          busy={busy === `as-${c.id}`} onApprove={() => run(`as-${c.id}`, () => hr.probation.approveSummary(c.id, token!))} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {recent.length > 0 && (
            <>
              <h3 className="mb-3 mt-8 text-sm font-semibold text-dash-heading">Recently completed</h3>
              <div className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
                <table className="w-full text-sm">
                  <tbody>
                    {recent.map((c) => (
                      <tr key={c.id} className="border-b border-neutral-border last:border-0">
                        <td className="px-4 py-2.5 text-dash-heading">{empMap.get(c.employeeId)?.name ?? c.employeeId}</td>
                        <td className="px-3 py-2.5"><Pill className="bg-surface-hover text-dash-muted">Day {c.day}</Pill></td>
                        <td className="px-3 py-2.5">{c.evaluation ? <Stars value={c.evaluation.rating} /> : <span className="text-[12px] text-dash-muted">check-in</span>}</td>
                        <td className="px-4 py-2.5 text-right text-[11px] text-dash-muted">{c.completedAt ? formatDate(c.completedAt) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function CheckInForm({ onSubmit, busy }: { onSubmit: (notes: string) => void; busy: boolean }) {
  const [notes, setNotes] = useState('');
  return (
    <div className="mt-3">
      <textarea rows={2} className={INPUT} placeholder="Check-in notes — how are they settling in?" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button className={`${BTN} mt-2`} disabled={!notes.trim() || busy} onClick={() => onSubmit(notes.trim())}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : null} Record check-in
      </button>
    </div>
  );
}

function EvalForm({ onSubmit, busy }: { onSubmit: (v: { rating: number; strengths: string; growthAreas: string }) => void; busy: boolean }) {
  const [rating, setRating] = useState(0);
  const [strengths, setStrengths] = useState('');
  const [growthAreas, setGrowth] = useState('');
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2"><span className="text-[12px] text-dash-muted">Rating</span><StarInput value={rating} onChange={setRating} /></div>
      <textarea rows={2} className={INPUT} placeholder="Strengths" value={strengths} onChange={(e) => setStrengths(e.target.value)} />
      <textarea rows={2} className={INPUT} placeholder="Growth areas" value={growthAreas} onChange={(e) => setGrowth(e.target.value)} />
      <button className={BTN} disabled={!rating || !strengths.trim() || !growthAreas.trim() || busy}
        onClick={() => onSubmit({ rating, strengths: strengths.trim(), growthAreas: growthAreas.trim() })}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : null} Submit evaluation (drafts AI summary)
      </button>
    </div>
  );
}
