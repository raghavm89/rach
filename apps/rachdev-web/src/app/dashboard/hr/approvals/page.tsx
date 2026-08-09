'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, FileText, Megaphone, MailX, HandCoins, ShieldAlert, Check, MessageSquare, RefreshCw, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import {
  canActOn, currentStep,
  ROLE_LABELS, APPROVAL_TYPE_LABELS,
  type Role, type ApprovalType, type ApprovalTask, type ApprovalStep,
  formatDateTime,
} from '@/lib/hr/demo';

const TYPE_ICON: Record<ApprovalType, LucideIcon> = {
  jd_approval: FileText, posting: Megaphone, rejection_batch: MailX, offer: HandCoins, policy_override: ShieldAlert,
  leave_request: FileText, letter_request: FileText, probation_evaluation: FileText,
  confirmation_letter: FileText, probation_termination: ShieldAlert,
};

const FILTERS: { key: string; label: string; type?: ApprovalType }[] = [
  { key: 'all', label: 'All' },
  { key: 'jd_approval', label: 'Job descriptions', type: 'jd_approval' },
  { key: 'rejection_batch', label: 'Rejection batches', type: 'rejection_batch' },
  { key: 'offer', label: 'Offers', type: 'offer' },
  { key: 'posting', label: 'Postings', type: 'posting' },
];

const STEP_CLASS: Record<string, string> = {
  approved: 'bg-ok-bg text-ok', pending: 'bg-amber-50 text-amber-600',
  rejected: 'bg-red-50 text-red-600', changes_requested: 'bg-amber-50 text-amber-600',
};

function Chain({ chain }: { chain: ApprovalStep[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chain.map((s, i) => (
        <span key={i} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ${STEP_CLASS[s.state] ?? 'bg-surface-hover text-dash-muted'}`}>
          {ROLE_LABELS[s.role]}
        </span>
      ))}
    </div>
  );
}

function TaskCard({ task, actingRole, busy, onAct, onOpen }: {
  task: ApprovalTask; actingRole: Role; busy: boolean;
  onAct: (task: ApprovalTask, action: 'approve' | 'request_changes') => void;
  onOpen: (task: ApprovalTask) => void;
}) {
  const Icon = TYPE_ICON[task.type];
  const mine = canActOn(task, actingRole);
  const step = currentStep(task);
  const openable = task.type === 'jd_approval' && task.subjectId;
  return (
    <div className="rounded-xl border border-neutral-border bg-surface-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-weak text-accent"><Icon size={16} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {openable ? (
              <button onClick={() => onOpen(task)} className="truncate text-[14px] font-semibold text-dash-heading hover:text-accent">{task.title}</button>
            ) : (
              <h3 className="truncate text-[14px] font-semibold text-dash-heading">{task.title}</h3>
            )}
            <span className="shrink-0 rounded-full bg-surface-hover px-2 py-0.5 text-[10.5px] font-medium text-dash-muted">{APPROVAL_TYPE_LABELS[task.type]}</span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-dash-body">{task.summary}</p>
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <Chain chain={task.chain} />
            {step && <span className="shrink-0 text-[11px] text-dash-muted">Waiting on {ROLE_LABELS[step.role]}</span>}
          </div>
          {mine && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => onAct(task, 'approve')} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve
              </button>
              <button onClick={() => onAct(task, 'request_changes')} disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-medium text-dash-body hover:bg-surface-hover disabled:opacity-50">
                <MessageSquare size={13} /> Request changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HrApprovalsPage() {
  const { get, loading, error, reload, setLoading } = useHr(['approvals']);
  const approvals = get<ApprovalTask>('approvals');
  const { user, token } = useAuth();
  const router = useRouter();
  // Your queue is determined by your role — no demo persona switcher.
  const actingRole = ((user?.role as Role) || 'hr_executive');
  const [filterKey, setFilterKey] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const onOpen = (task: ApprovalTask) => {
    if (task.subjectId) router.push(`/dashboard/hr/requisitions/${task.subjectId}`);
  };
  const onAct = async (task: ApprovalTask, action: 'approve' | 'request_changes') => {
    if (!token) return;
    setBusyId(task.id);
    try {
      await hr.actApproval(task.id, action, token);
      toast.success(action === 'approve' ? 'Approved' : 'Changes requested');
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const all = approvals
    .filter((t) => !filter.type || t.type === filter.type)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const needsYou = all.filter((t) => canActOn(t, actingRole));
  const waiting = all.filter((t) => t.state === 'pending' && !canActOn(t, actingRole));
  const resolved = all.filter((t) => t.state !== 'pending');
  const pendingCount = (type?: ApprovalType) => approvals.filter((t) => t.state === 'pending' && (!type || t.type === type)).length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Approvals"
        subtitle="One queue for everything awaiting a human signature. AI drafts; named people decide."
        actions={
          <button onClick={() => { setLoading(true); reload(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilterKey(f.key)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${filterKey === f.key ? 'border-dash-heading bg-dash-heading text-surface-card' : 'border-neutral-border bg-surface-card text-dash-muted hover:text-dash-body'}`}>
              {f.label}
              <span className={filterKey === f.key ? 'text-surface-card/60' : 'text-dash-muted/60'}>{pendingCount(f.type)}</span>
            </button>
          ))}
        </div>
        <span className="text-[11px] text-dash-muted">Your queue · {ROLE_LABELS[actingRole] ?? actingRole}</span>
      </div>

      <div className="mt-5 space-y-6">
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-dash-body">
            Needs your action
            <span className="rounded-full bg-accent-weak px-2 py-0.5 text-[11px] text-accent">{needsYou.length}</span>
          </h2>
          {needsYou.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-border bg-surface-card px-4 py-8 text-center">
              <Inbox size={20} className="mx-auto mb-2 text-dash-muted" />
              <p className="text-sm font-medium text-dash-heading">{loading ? 'Loading…' : 'Nothing waiting on you'}</p>
              <p className="mt-1 text-xs text-dash-muted">No pending approvals for {ROLE_LABELS[actingRole] ?? actingRole} right now.</p>
            </div>
          ) : (
            <div className="space-y-3">{needsYou.map((t) => <TaskCard key={t.id} task={t} actingRole={actingRole} busy={busyId === t.id} onAct={onAct} onOpen={onOpen} />)}</div>
          )}
        </section>

        {waiting.length > 0 && (
          <section>
            <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-dash-body">Waiting on others <span className="ml-1 text-[11px] text-dash-muted">{waiting.length}</span></h2>
            <div className="space-y-3">{waiting.map((t) => <TaskCard key={t.id} task={t} actingRole={actingRole} busy={busyId === t.id} onAct={onAct} onOpen={onOpen} />)}</div>
          </section>
        )}

        {resolved.length > 0 && (
          <section>
            <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-dash-body">Resolved <span className="ml-1 text-[11px] text-dash-muted">{resolved.length}</span></h2>
            <div className="overflow-hidden rounded-xl border border-neutral-border bg-surface-card divide-y divide-neutral-border">
              {resolved.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-[10.5px] font-medium ${t.state === 'approved' ? 'bg-ok-bg text-ok' : 'bg-red-50 text-red-600'}`}>{t.state === 'approved' ? 'Approved' : 'Rejected'}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-dash-heading">{t.title}</span>
                  <span className="shrink-0 text-[11px] text-dash-muted">{APPROVAL_TYPE_LABELS[t.type]}</span>
                  <span className="shrink-0 text-[11px] text-dash-muted">{t.resolvedAt ? formatDateTime(t.resolvedAt) : ''}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
