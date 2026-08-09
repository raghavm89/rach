'use client';

import { CalendarClock, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import {
  ROUND_LABELS, INTERVIEW_STATUS_LABELS, formatTime, dayKey,
  type Interview, type InterviewStatus, type Application, type Candidate, type Requisition,
} from '@/lib/hr/demo';

const STATUS_CLASS: Record<InterviewStatus, string> = {
  scheduled: 'bg-accent-weak text-accent',
  rescheduled: 'bg-amber-50 text-amber-600',
  completed: 'bg-ok-bg text-ok',
  no_show: 'bg-red-50 text-red-600',
  cancelled: 'bg-surface-hover text-dash-muted',
};

export default function HrInterviewsPage() {
  const { get, loading, error, reload, setLoading } = useHr(['interviews', 'applications', 'candidates', 'requisitions']);
  const interviews = get<Interview>('interviews');
  const appMap = new Map(get<Application>('applications').map((a) => [a.id, a]));
  const candMap = new Map(get<Candidate>('candidates').map((c) => [c.id, c]));
  const reqMap = new Map(get<Requisition>('requisitions').map((r) => [r.id, r]));

  function Row({ i }: { i: Interview }) {
    const app = appMap.get(i.applicationId);
    const cand = app ? candMap.get(app.candidateId) : undefined;
    const req = app ? reqMap.get(app.requisitionId) : undefined;
    return (
      <div className="flex items-center gap-4 px-4 py-3">
        <span className="w-20 shrink-0 text-[12px] text-dash-body">{formatTime(i.scheduledAt)}</span>
        <div className="w-52 min-w-0">
          <div className="truncate text-[13px] font-medium text-dash-heading">{cand?.name ?? 'Candidate'}</div>
          <div className="truncate text-[11px] text-dash-muted">{req?.title}</div>
        </div>
        <span className="w-44 shrink-0 text-[12.5px] text-dash-body">{ROUND_LABELS[i.round]}</span>
        <span className="w-32 shrink-0 text-[12px] text-dash-muted">{i.interviewerName}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${STATUS_CLASS[i.status]}`}>{INTERVIEW_STATUS_LABELS[i.status]}</span>
        {i.note && <span className="min-w-0 flex-1 truncate text-[11.5px] text-dash-muted">{i.note}</span>}
      </div>
    );
  }

  const upcoming = interviews
    .filter((i) => i.status === 'scheduled' || i.status === 'rescheduled')
    .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
  const past = interviews
    .filter((i) => i.status === 'completed' || i.status === 'no_show' || i.status === 'cancelled')
    .sort((a, b) => (a.scheduledAt < b.scheduledAt ? 1 : -1));

  const byDay = new Map<string, Interview[]>();
  for (const i of upcoming) {
    const k = dayKey(i.scheduledAt);
    byDay.set(k, [...(byDay.get(k) ?? []), i]);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Interviews"
        subtitle="HR and PM rounds across all requisitions. Reschedules and no-shows are recorded in the audit log."
        actions={
          <button onClick={() => { setLoading(true); reload(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      {upcoming.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-neutral-border bg-surface-card px-6 py-10 text-center">
          <CalendarClock size={20} className="mx-auto mb-2 text-dash-muted" />
          <p className="text-sm font-medium text-dash-heading">{loading ? 'Loading…' : 'No upcoming interviews'}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {Array.from(byDay.entries()).map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-dash-body">{day}</h2>
              <div className="divide-y divide-neutral-border rounded-2xl border border-neutral-border bg-surface-card">
                {items.map((i) => <Row key={i.id} i={i} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-dash-body">Recent <span className="ml-1 text-[11px] text-dash-muted">{past.length}</span></h2>
          <div className="divide-y divide-neutral-border rounded-2xl border border-neutral-border bg-surface-card">
            {past.map((i) => <Row key={i.id} i={i} />)}
          </div>
        </section>
      )}
    </div>
  );
}
