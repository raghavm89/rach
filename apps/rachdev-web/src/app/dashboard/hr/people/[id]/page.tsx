'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, CheckCircle2, CalendarClock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr } from '@rach/ui/lib/api';
import { useHr } from '@/lib/hr/useHr';
import { Pill, IdChip, DraftCard, Stars, CARD, INPUT, BTN, BTN_GHOST } from '@/components/dashboard/hr/bits';
import {
  EMPLOYEE_STATUS_LABELS, formatDate,
  type Employee, type ProbationCheckpoint, type ReviewEvaluation, type Letter, type LeaveRequest,
} from '@/lib/hr/demo';

const CP_CLASS: Record<string, string> = {
  completed: 'bg-ok-bg text-ok', due: 'bg-amber-50 text-amber-600', pending: 'bg-surface-hover text-dash-muted',
};

export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, token } = useAuth();
  const { get, loading, error, reload } = useHr(['employees', 'probation', 'review_evals', 'letters', 'leave']);
  const emp = get<Employee>('employees').find((e) => e.id === id);
  const checkpoints = get<ProbationCheckpoint>('probation').filter((c) => c.employeeId === id).sort((a, b) => a.day - b.day);
  const reviews = get<ReviewEvaluation>('review_evals').filter((r) => r.employeeId === id);
  const letters = get<Letter>('letters').filter((l) => l.employeeId === id);
  const leave = get<LeaveRequest>('leave').filter((l) => l.employeeId === id);

  const [busy, setBusy] = useState('');
  const [extend, setExtend] = useState({ open: false, reason: '', date: '' });
  const [term, setTerm] = useState({ open: false, reason: '', ack: false });

  const isDirector = user?.role === 'hr_director' || user?.role === 'tenant_admin' || user?.role === 'admin';
  const day90 = useMemo(() => checkpoints.find((c) => c.day === 90), [checkpoints]);
  const canDecideOutcome = emp?.status === 'probation' && day90 && day90.status !== 'pending';

  async function run(label: string, fn: () => Promise<unknown>) {
    if (!token) return;
    setBusy(label);
    try { await fn(); await reload(); toast.success('Done'); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }

  if (loading) return <div className="flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  if (error) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>;
  if (!emp) return <p className="text-dash-muted">Employee not found. <Link href="/dashboard/hr/people" className="text-accent">Back to People</Link></p>;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/hr/people" className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-muted hover:text-accent">
        <ArrowLeft size={15} /> People
      </Link>

      {/* Profile header */}
      <div className={`${CARD} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-dash-heading">{emp.name}</h2>
              <IdChip id={emp.empCode} />
            </div>
            <p className="mt-0.5 text-sm text-dash-body">{emp.title} · {emp.dept}</p>
            <p className="mt-0.5 text-[12px] text-dash-muted">Manager: {emp.managerName} · {emp.location} · Joined {formatDate(emp.joinDate)}</p>
            <p className="mt-0.5 text-[12px] text-dash-muted">{emp.email}</p>
          </div>
          <Pill className={emp.status === 'confirmed' ? 'bg-ok-bg text-ok' : emp.status === 'probation' ? 'bg-amber-50 text-amber-600' : 'bg-surface-hover text-dash-muted'}>
            {EMPLOYEE_STATUS_LABELS[emp.status]}
          </Pill>
        </div>
      </div>

      {/* Probation lifecycle */}
      {checkpoints.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-dash-heading">Probation lifecycle</h3>
          <div className="flex flex-wrap gap-2">
            {checkpoints.map((c) => (
              <div key={c.id} className={`${CARD} flex-1 min-w-[140px] p-3`}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-dash-heading">Day {c.day}</span>
                  <Pill className={CP_CLASS[c.status]}>{c.status}</Pill>
                </div>
                <p className="mt-1 text-[11px] text-dash-muted">Due {formatDate(c.due)}</p>
                {c.checkIn && <p className="mt-1 text-[11px] text-dash-body">“{c.checkIn.notes.slice(0, 60)}{c.checkIn.notes.length > 60 ? '…' : ''}”</p>}
                {c.evaluation && <div className="mt-1"><Stars value={c.evaluation.rating} /></div>}
              </div>
            ))}
          </div>

          {/* Evaluation summaries (approve advisory draft) */}
          {checkpoints.filter((c) => c.evaluation?.summaryDraft).map((c) => (
            <div key={`sum-${c.id}`} className="mt-3">
              <DraftCard
                title={`Day-${c.day} evaluation summary`}
                body={c.evaluation!.summaryDraft!.body}
                approved={c.evaluation!.summaryDraft!.status === 'approved'}
                approvedByName={c.evaluation!.summaryDraft!.approvedByName}
                busy={busy === `sum-${c.id}`}
                onApprove={() => run(`sum-${c.id}`, () => hr.probation.approveSummary(c.id, token!))}
                footnote="Advisory only — the confirmation decision rests with HR and the manager."
              />
            </div>
          ))}

          {/* Day-90 outcome actions */}
          {canDecideOutcome && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button className={BTN} disabled={!!busy}
                onClick={() => run('confirm', () => hr.probation.confirm(emp.id, token!))}>
                {busy === 'confirm' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Confirm employee
              </button>
              <button className={BTN_GHOST} disabled={!!busy} onClick={() => setExtend({ open: true, reason: '', date: '' })}>
                <CalendarClock size={15} /> Extend probation
              </button>
              {isDirector && (
                <button className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                  disabled={!!busy} onClick={() => setTerm({ open: true, reason: '', ack: false })}>
                  <AlertTriangle size={15} /> Initiate termination
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-dash-heading">Performance reviews</h3>
          {reviews.map((r) => (
            <div key={r.id} className={`${CARD} mb-2 p-4`}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-dash-muted">Manager: {r.managerName}</span>
                {r.rating ? <Stars value={r.rating} /> : <Pill>Pending</Pill>}
              </div>
              {r.strengths && <p className="mt-2 text-[13px] text-dash-body"><span className="font-medium text-dash-heading">Strengths:</span> {r.strengths}</p>}
              {r.growthAreas && <p className="mt-1 text-[13px] text-dash-body"><span className="font-medium text-dash-heading">Growth:</span> {r.growthAreas}</p>}
              {r.summaryDraft && <div className="mt-3"><DraftCard body={r.summaryDraft.body} approved={r.summaryDraft.status === 'approved'} approvedByName={r.summaryDraft.approvedByName} busy={busy === `rev-${r.id}`} onApprove={() => run(`rev-${r.id}`, () => hr.review.approveSummary(r.id, token!))} /></div>}
            </div>
          ))}
        </section>
      )}

      {/* Letters + leave summary */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className={`${CARD} p-4`}>
          <h3 className="mb-2 text-sm font-semibold text-dash-heading">Letters</h3>
          {letters.length === 0 ? <p className="text-[12px] text-dash-muted">None yet.</p> : letters.map((l) => (
            <div key={l.id} className="flex items-center justify-between border-b border-neutral-border py-1.5 last:border-0">
              <span className="text-[12px] text-dash-body">{l.kind.replace(/_/g, ' ')}</span>
              <Pill className={l.status === 'issued' ? 'bg-ok-bg text-ok' : 'bg-amber-50 text-amber-600'}>{l.status.replace(/_/g, ' ')}</Pill>
            </div>
          ))}
        </div>
        <div className={`${CARD} p-4`}>
          <h3 className="mb-2 text-sm font-semibold text-dash-heading">Recent leave</h3>
          {leave.length === 0 ? <p className="text-[12px] text-dash-muted">None yet.</p> : leave.slice(0, 5).map((l) => (
            <div key={l.id} className="flex items-center justify-between border-b border-neutral-border py-1.5 last:border-0">
              <span className="text-[12px] text-dash-body">{l.type} · {l.workingDays}d · {formatDate(l.from)}</span>
              <Pill className={l.status === 'approved' ? 'bg-ok-bg text-ok' : l.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-surface-hover text-dash-muted'}>{l.status}</Pill>
            </div>
          ))}
        </div>
      </section>

      {/* Extend modal */}
      {extend.open && (
        <Modal title="Extend probation" onClose={() => setExtend({ open: false, reason: '', date: '' })}>
          <label className="text-[12px] font-medium text-dash-heading">New end date</label>
          <input type="date" className={`${INPUT} mt-1`} value={extend.date} onChange={(e) => setExtend((s) => ({ ...s, date: e.target.value }))} />
          <label className="mt-3 block text-[12px] font-medium text-dash-heading">Reason</label>
          <textarea rows={3} className={`${INPUT} mt-1`} value={extend.reason} onChange={(e) => setExtend((s) => ({ ...s, reason: e.target.value }))} />
          <div className="mt-4 flex justify-end gap-2">
            <button className={BTN_GHOST} onClick={() => setExtend({ open: false, reason: '', date: '' })}>Cancel</button>
            <button className={BTN} disabled={!extend.date || !extend.reason.trim() || !!busy}
              onClick={() => run('extend', async () => { await hr.probation.extend(emp.id, { reason: extend.reason.trim(), newEndDate: extend.date }, token!); setExtend({ open: false, reason: '', date: '' }); })}>
              {busy === 'extend' ? <Loader2 size={15} className="animate-spin" /> : null} Extend
            </button>
          </div>
        </Modal>
      )}

      {/* Terminate modal */}
      {term.open && (
        <Modal title="Initiate probation termination" onClose={() => setTerm({ open: false, reason: '', ack: false })}>
          <p className="text-[12px] text-dash-muted">The letter is a static policy template — never AI-drafted, never auto-sent. Requires HR Director approval.</p>
          <label className="mt-3 block text-[12px] font-medium text-dash-heading">Documented reason</label>
          <textarea rows={3} className={`${INPUT} mt-1`} value={term.reason} onChange={(e) => setTerm((s) => ({ ...s, reason: e.target.value }))} />
          <label className="mt-3 flex items-start gap-2 text-[12px] text-dash-body">
            <input type="checkbox" checked={term.ack} onChange={(e) => setTerm((s) => ({ ...s, ack: e.target.checked }))} className="mt-0.5" />
            I confirm this has been reviewed with counsel.
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button className={BTN_GHOST} onClick={() => setTerm({ open: false, reason: '', ack: false })}>Cancel</button>
            <button className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              disabled={!term.reason.trim() || !term.ack || !!busy}
              onClick={() => run('term', async () => { await hr.probation.terminate(emp.id, { reason: term.reason.trim(), counselAck: term.ack }, token!); setTerm({ open: false, reason: '', ack: false }); })}>
              {busy === 'term' ? <Loader2 size={15} className="animate-spin" /> : null} Initiate
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${CARD} w-full max-w-md p-5`} onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-semibold text-dash-heading">{title}</h3>
        {children}
      </div>
    </div>
  );
}
