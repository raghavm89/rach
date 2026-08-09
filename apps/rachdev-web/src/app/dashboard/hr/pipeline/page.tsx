'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid, ListFilter, Info } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import {
  PIPELINE_STAGES, STAGE_LABELS, daysBetween,
  type Stage, type Requisition, type Application, type Candidate,
} from '@/lib/hr/demo';

export default function HrPipelinePage() {
  const { get, loading, error } = useHr(['requisitions', 'applications', 'candidates']);
  const requisitions = get<Requisition>('requisitions');
  const applications = get<Application>('applications');
  const candidates = get<Candidate>('candidates');
  const candMap = new Map(candidates.map((c) => [c.id, c]));

  const openReqs = requisitions.filter((r) => r.status !== 'draft');
  const [reqId, setReqId] = useState<string | undefined>();
  const [view, setView] = useState<'board' | 'screening'>('board');
  useEffect(() => {
    if (!reqId && openReqs.length) setReqId(openReqs.some((r) => r.id === 'REQ-1024') ? 'REQ-1024' : openReqs[0].id);
  }, [reqId, openReqs]);

  const req = requisitions.find((r) => r.id === reqId);
  const apps = reqId ? applications.filter((a) => a.requisitionId === reqId) : [];
  const active = apps.filter((a) => a.stage !== 'rejected');
  const rejected = apps.length - active.length;
  const threshold = req?.screening?.scoreThreshold;

  const tabBtn = (v: 'board' | 'screening', label: string, Icon: typeof LayoutGrid) => (
    <button
      onClick={() => setView(v)}
      className={'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ' + (view === v ? 'bg-surface-hover text-dash-heading' : 'text-dash-muted hover:text-dash-body')}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Pipeline"
        subtitle="Candidates by stage. Deterministic knockouts and AI scores produce recommendations — humans approve every rejection."
        actions={
          <select
            value={reqId ?? ''}
            onChange={(e) => setReqId(e.target.value)}
            className="rounded-lg border border-neutral-border bg-surface-card px-3 py-2 text-sm text-dash-heading outline-none focus:border-accent"
          >
            {openReqs.map((r) => <option key={r.id} value={r.id}>{r.title} · {r.id}</option>)}
          </select>
        }
      />

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-neutral-border bg-surface-card p-0.5">
          {tabBtn('board', 'Board', LayoutGrid)}
          {tabBtn('screening', 'Screening queue', ListFilter)}
        </div>
        <span className="text-[11px] text-dash-muted">{loading ? 'Loading…' : `${active.length} active · ${rejected} rejected`}</span>
      </div>

      {view === 'board' ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(PIPELINE_STAGES as Stage[]).map((stage) => {
            const inStage = active.filter((a) => a.stage === stage);
            return (
              <div key={stage} className="rounded-xl border border-neutral-border bg-surface-app p-2">
                <div className="flex items-center justify-between px-1 pb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-dash-muted">{STAGE_LABELS[stage]}</span>
                  <span className="text-[11px] text-dash-muted">{inStage.length}</span>
                </div>
                <div className="space-y-2">
                  {inStage.map((a) => {
                    const c = candMap.get(a.candidateId);
                    const score = a.aiScore?.value;
                    const below = typeof score === 'number' && typeof threshold === 'number' && score < threshold;
                    return (
                      <div key={a.id} className="rounded-lg border border-neutral-border bg-surface-card p-2.5">
                        <div className="truncate text-[12.5px] font-medium text-dash-heading">{c?.name ?? 'Candidate'}</div>
                        <div className="mt-0.5 truncate text-[10.5px] text-dash-muted">
                          {a.resumeParsed?.currentTitle}{a.resumeParsed?.currentCompany ? ` · ${a.resumeParsed.currentCompany}` : ''}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          {typeof score === 'number' && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${below ? 'bg-red-50 text-red-600' : 'bg-ok-bg text-ok'}`}>{score}</span>
                          )}
                          <span className="text-[10px] text-dash-muted">{daysBetween(a.stageChangedAt)}d in stage</span>
                        </div>
                      </div>
                    );
                  })}
                  {inStage.length === 0 && <p className="px-1 py-2 text-[10.5px] text-dash-muted">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ScreeningQueue apps={apps} candMap={candMap} threshold={threshold} />
      )}
    </div>
  );
}

function ScreeningQueue({
  apps, candMap, threshold,
}: { apps: Application[]; candMap: Map<string, Candidate>; threshold?: number }) {
  // Candidates currently in the screening stage, ranked by AI score.
  const queue = apps
    .filter((a) => a.stage === 'screening')
    .sort((a, b) => (b.aiScore?.value ?? 0) - (a.aiScore?.value ?? 0));

  const recommendation = (a: Application): { label: string; cls: string } => {
    const openFlag = (a.policyFlags ?? []).some((f) => !f.overriddenAt);
    if (openFlag) return { label: 'Needs human decision', cls: 'bg-amber-50 text-amber-600' };
    const score = a.aiScore?.value;
    if (typeof score === 'number' && typeof threshold === 'number' && score < threshold) {
      return { label: 'Recommend reject', cls: 'bg-red-50 text-red-600' };
    }
    return { label: 'Keep', cls: 'bg-ok-bg text-ok' };
  };

  return (
    <div className="mt-3">
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-neutral-border bg-surface-card p-3 text-[11.5px] leading-relaxed text-dash-muted">
        <Info size={14} className="mt-0.5 shrink-0" />
        Candidates with open policy flags are never auto-recommended — they always need a human decision first. No candidate is rejected without a signed approval.
      </div>

      {queue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-border bg-surface-card px-6 py-10 text-center text-sm text-dash-muted">No candidates in screening for this requisition.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-border text-left text-xs text-dash-muted">
                <th className="px-5 py-2.5 font-medium">Candidate</th>
                <th className="px-3 py-2.5 font-medium">Score</th>
                <th className="px-3 py-2.5 font-medium">Recommendation</th>
                <th className="px-5 py-2.5 text-right font-medium">In stage</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((a) => {
                const c = candMap.get(a.candidateId);
                const score = a.aiScore?.value;
                const below = typeof score === 'number' && typeof threshold === 'number' && score < threshold;
                const rec = recommendation(a);
                return (
                  <tr key={a.id} className="border-b border-neutral-border last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-medium text-dash-heading">{c?.name ?? 'Candidate'}</div>
                      <div className="text-[11px] text-dash-muted">{a.resumeParsed?.currentTitle}{a.resumeParsed?.currentCompany ? ` · ${a.resumeParsed.currentCompany}` : ''}</div>
                    </td>
                    <td className="px-3 py-3">
                      {typeof score === 'number' ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${below ? 'bg-red-50 text-red-600' : 'bg-ok-bg text-ok'}`}>{score}{typeof threshold === 'number' ? ` / ${threshold}` : ''}</span>
                      ) : <span className="text-dash-muted">—</span>}
                    </td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${rec.cls}`}>{rec.label}</span></td>
                    <td className="px-5 py-3 text-right text-[12px] text-dash-body">{daysBetween(a.stageChangedAt)}d</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
