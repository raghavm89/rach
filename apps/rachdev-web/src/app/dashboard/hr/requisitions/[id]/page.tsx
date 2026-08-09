'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Check, MessageSquare, Megaphone, ScanSearch, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr } from '@rach/ui/lib/api';
import {
  currentStep, formatBand, formatDateTime,
  type Requisition, type ApprovalTask, type BiasFlag,
} from '@/lib/hr/demo';

const CHAIN = [
  { role: 'project_manager', short: 'PM' },
  { role: 'hr_executive', short: 'HR Exec' },
  { role: 'hr_director', short: 'Director' },
];

const POSTINGS = [
  { name: 'Naukri' }, { name: 'LinkedIn Jobs', via: 'via aggregator' },
  { name: 'Indeed', via: 'via aggregator' }, { name: 'Careers Page' },
];

// Minimal Markdown renderer for the AI JD (#, ##, - bullets, **bold**, paragraphs).
function MarkdownLite({ text }: { text: string }) {
  const lines = (text || '').split('\n');
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => {
    if (list.length) {
      out.push(<ul key={`ul-${k}`} className="my-2 list-disc space-y-1 pl-5 text-[13.5px] text-dash-body">{list.map((li, i) => <li key={i}>{bold(li)}</li>)}</ul>);
      list = [];
    }
  };
  const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((seg, i) => seg.startsWith('**') ? <strong key={i} className="font-semibold text-dash-heading">{seg.slice(2, -2)}</strong> : <span key={i}>{seg}</span>);
  lines.forEach((raw, i) => {
    const l = raw.trimEnd();
    if (l.startsWith('## ')) { flush(i); out.push(<h4 key={i} className="mt-4 text-[13px] font-semibold text-dash-heading">{l.slice(3)}</h4>); }
    else if (l.startsWith('# ')) { flush(i); out.push(<h3 key={i} className="mt-1 text-lg font-semibold text-dash-heading">{l.slice(2)}</h3>); }
    else if (l.startsWith('- ') || l.startsWith('* ')) { list.push(l.slice(2)); }
    else if (l.trim() === '') { flush(i); }
    else { flush(i); out.push(<p key={i} className="my-1.5 text-[13.5px] leading-relaxed text-dash-body">{bold(l)}</p>); }
  });
  flush(lines.length);
  return <div>{out}</div>;
}

export default function RequisitionDetailPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const [req, setReq] = useState<Requisition | null>(null);
  const [task, setTask] = useState<ApprovalTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError('');
      const [reqs, approvals] = await Promise.all([
        hr.list<Requisition>('requisitions', token),
        hr.list<ApprovalTask>('approvals', token),
      ]);
      setReq(reqs.find((r: Requisition) => r.id === id) ?? null);
      setTask(approvals.find((a: ApprovalTask) => a.type === 'jd_approval' && a.subjectId === id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  const step = task ? currentStep(task) : undefined;
  const canAct = !!task && task.state === 'pending' && !!step &&
    (step.role === user?.role || user?.role === 'admin' || user?.role === 'tenant_admin');

  const act = async (action: 'approve' | 'request_changes') => {
    if (!token || !task) return;
    setActing(action); setError('');
    try {
      await hr.actApproval(task.id, action, token);
      toast.success(action === 'approve' ? 'Approved' : 'Changes requested');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActing('');
    }
  };

  if (loading) return <div className="mx-auto max-w-6xl px-1 py-8 text-sm text-dash-muted"><Loader2 size={16} className="mr-2 inline animate-spin" /> Loading…</div>;
  if (!req) return (
    <div className="mx-auto max-w-6xl">
      <button onClick={() => router.push('/dashboard/hr/requisitions')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-dash-muted hover:text-dash-heading"><ArrowLeft size={15} /> Requisitions</button>
      <p className="text-sm text-dash-muted">Requisition not found.</p>
    </div>
  );

  const facts = [req.dept, req.location ? `${req.location}${req.workMode ? ` (${req.workMode})` : ''}` : null, formatBand(req.compBandINR), `headcount ${req.headcount}`, req.hiringManager ? `HM: ${req.hiringManager}` : null].filter(Boolean).join('  ·  ');
  const flags: BiasFlag[] = task?.biasFlags ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <button onClick={() => router.push('/dashboard/hr/requisitions')} className="mb-3 inline-flex items-center gap-1.5 text-sm text-dash-muted hover:text-dash-heading"><ArrowLeft size={15} /> Requisitions</button>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-dash-heading">{req.title}</h2>
            <span className="text-sm text-dash-muted">{req.id}</span>
          </div>
          <p className="mt-1 text-sm text-dash-muted">{facts}</p>
        </div>
        <button onClick={() => toast('Posting to boards lands with GA (demo)')} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Megaphone size={15} /> Post to boards
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* JD */}
        <div className="rounded-2xl border border-neutral-border bg-surface-card p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-weak px-2.5 py-0.5 text-xs font-semibold text-accent"><Sparkles size={12} /> {task?.state === 'approved' ? 'Approved' : 'AI draft — awaiting review'}</span>
            {task && step && task.state === 'pending' && <span className="rounded-full bg-surface-hover px-2.5 py-0.5 text-xs text-dash-muted">Waiting on {CHAIN.find((c) => c.role === step.role)?.short}</span>}
          </div>
          {task?.jd ? <MarkdownLite text={task.jd} /> : <p className="text-sm text-dash-muted">No JD drafted yet.</p>}
          <p className="mt-4 border-t border-neutral-border pt-3 text-xs text-dash-muted">In review — request changes regenerates a revision; nothing publishes until the chain signs off.</p>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          {/* Bias flags */}
          <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
            <div className="mb-1 flex items-center gap-2"><ScanSearch size={16} className="text-dash-muted" /><h3 className="text-sm font-semibold text-dash-heading">Bias-language flags</h3></div>
            <p className="mb-3 text-[11.5px] text-dash-muted">Lint runs on every AI draft.</p>
            {flags.length === 0 ? (
              <p className="rounded-lg bg-ok-bg px-3 py-2 text-[12px] text-ok">No bias-language flags — good to go.</p>
            ) : (
              <div className="space-y-2.5">
                {flags.map((f, i) => (
                  <div key={i} className="rounded-lg bg-amber-50 p-3">
                    <div className="text-[13px] font-semibold text-amber-700">“{f.phrase}”</div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-amber-700/90">{f.reason}</p>
                    <div className="mt-1.5 text-[11px] text-amber-700/80">Suggested rewrite: <span className="rounded-full border border-amber-300 bg-white px-1.5 py-0.5 text-amber-700">{f.rewrite}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approval chain */}
          <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
            <h3 className="text-sm font-semibold text-dash-heading">Approval chain</h3>
            <p className="mb-3 text-[11.5px] text-dash-muted">{task?.state === 'approved' ? 'Signed off.' : step ? `Waiting on ${CHAIN.find((c) => c.role === step.role)?.short}` : '—'}</p>
            <div className="flex items-center justify-between">
              {CHAIN.map((c, i) => {
                const s = task?.chain.find((x) => x.role === c.role);
                const done = s?.state === 'approved';
                const active = step?.role === c.role;
                const changes = s?.state === 'changes_requested';
                return (
                  <div key={c.role} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${done ? 'bg-ok text-white' : active ? 'border-2 border-accent text-accent' : changes ? 'bg-amber-100 text-amber-700' : 'border border-neutral-border text-dash-muted'}`}>
                        {done ? <Check size={13} /> : active ? '●' : ''}
                      </span>
                      <span className={`mt-1 text-[10.5px] ${active ? 'font-semibold text-accent' : 'text-dash-muted'}`}>{c.short}</span>
                    </div>
                    {i < CHAIN.length - 1 && <span className={`mx-1 h-px flex-1 ${done ? 'bg-ok' : 'bg-neutral-border'}`} />}
                  </div>
                );
              })}
            </div>

            {canAct && (
              <div className="mt-4 flex gap-2">
                <button onClick={() => act('approve')} disabled={!!acting} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {acting === 'approve' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve
                </button>
                <button onClick={() => act('request_changes')} disabled={!!acting} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-border px-3 py-2 text-xs font-medium text-dash-body hover:bg-surface-hover disabled:opacity-50">
                  {acting === 'request_changes' ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />} Request changes
                </button>
              </div>
            )}
          </div>

          {/* Postings */}
          <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-dash-heading">Postings</h3>
            <div className="space-y-2">
              {POSTINGS.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-[13px]">
                  <span className="text-dash-body">{p.name}{p.via && <span className="ml-1.5 text-[11px] text-dash-muted">{p.via}</span>}</span>
                  <span className="rounded-full border border-neutral-border px-2 py-0.5 text-[10.5px] text-dash-muted">Not posted</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
