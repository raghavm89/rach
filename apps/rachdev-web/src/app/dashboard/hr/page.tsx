'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, CalendarClock, HandCoins, Inbox, Users, RefreshCw, Megaphone, Plus, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import {
  PIPELINE_STAGES, STAGE_LABELS, ROUND_LABELS,
  daysBetween, formatDay, formatTime, formatDateTime,
  type Requisition, type Application, type Candidate, type ApprovalTask, type Interview, type Offer,
  type Announcement,
} from '@/lib/hr/demo';

function StatTile({
  icon: Icon, label, value, sub, href, accent,
}: { icon: LucideIcon; label: string; value: number | string; sub?: string; href?: string; accent?: boolean }) {
  const inner = (
    <div className={`group h-full rounded-xl border bg-surface-card p-4 transition-colors ${accent ? 'border-accent/40' : 'border-neutral-border'} ${href ? 'hover:border-accent/50' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-dash-muted"><Icon size={14} /> {label}</span>
        {href && <ArrowUpRight size={14} className="text-transparent transition-colors group-hover:text-accent" />}
      </div>
      <div className={`mt-2 text-[28px] font-semibold leading-none ${accent ? 'text-accent' : 'text-dash-heading'}`}>{value}</div>
      {sub && <div className="mt-1.5 text-[11.5px] text-dash-muted">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-24 shrink-0 text-[12px] text-dash-body">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(pct, value > 0 ? 6 : 0)}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-[12px] font-medium text-dash-heading">{value}</span>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-dash-heading">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-dash-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function HrDashboardPage() {
  const { token } = useAuth();
  const { get, loading, error, reload, setLoading } = useHr(['requisitions', 'applications', 'candidates', 'approvals', 'interviews', 'offers', 'announcements']);
  const announcements = [...get<Announcement>('announcements')].sort((a, b) => (a.at < b.at ? 1 : -1));
  const [composing, setComposing] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [posting, setPosting] = useState(false);

  async function postAnnouncement() {
    if (!token || !annTitle.trim() || !annBody.trim()) return;
    setPosting(true);
    try {
      await hr.createAnnouncement({ title: annTitle.trim(), body: annBody.trim() }, token);
      setAnnTitle(''); setAnnBody(''); setComposing(false); await reload();
      toast.success('Announcement published');
    } catch (e) { toast.error((e as Error).message); }
    finally { setPosting(false); }
  }

  const requisitions = get<Requisition>('requisitions');
  const applications = get<Application>('applications');
  const candidates = get<Candidate>('candidates');
  const approvals = get<ApprovalTask>('approvals');
  const interviews = get<Interview>('interviews');
  const offers = get<Offer>('offers');

  const candMap = new Map(candidates.map((c) => [c.id, c]));
  const appMap = new Map(applications.map((a) => [a.id, a]));
  const focusReq = requisitions.find((r) => r.id === 'REQ-1024') ?? requisitions[0];
  const focusApps = focusReq ? applications.filter((a) => a.requisitionId === focusReq.id) : [];

  const funnel = PIPELINE_STAGES.map((s) => ({ label: STAGE_LABELS[s], count: focusApps.filter((a) => a.stage === s).length }));
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));
  const timeInStage = PIPELINE_STAGES.map((s) => {
    const inS = focusApps.filter((a) => a.stage === s);
    const avg = inS.length ? Math.round(inS.reduce((sum, a) => sum + daysBetween(a.stageChangedAt), 0) / inS.length) : 0;
    return { label: STAGE_LABELS[s], days: avg };
  });
  const timeMax = Math.max(1, ...timeInStage.map((t) => t.days));

  const activeCandidates = applications.filter((a) => a.stage !== 'rejected').length;
  const newThisWeek = applications.filter((a) => daysBetween(a.appliedAt) <= 7).length;
  const pending = approvals.filter((t) => t.state === 'pending');
  const upcoming = interviews
    .filter((i) => (i.status === 'scheduled' || i.status === 'rescheduled') && new Date(i.scheduledAt).getTime() > Date.now() - 86_400_000)
    .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1))
    .slice(0, 6);
  const awaitingSign = offers.filter((o) => o.status === 'sent_for_esign').length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Human Resources"
        subtitle="Layer 1 · Hire — every AI output below is a draft until a human approves it."
        actions={
          <button onClick={() => { setLoading(true); reload(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
      {!error && !loading && requisitions.length === 0 && (
        <p className="mt-4 rounded-lg border border-neutral-border bg-surface-card px-4 py-3 text-sm text-dash-muted">No HR data yet — seed this tenant with the HR demo dataset.</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Users} label="Active candidates" value={activeCandidates} sub={`${newThisWeek} new this week`} href="/dashboard/hr/pipeline" />
        <StatTile icon={Inbox} label="Pending approvals" value={pending.length} sub={pending.length ? 'Awaiting a signature' : 'Queue is clear'} href="/dashboard/hr/approvals" accent={pending.length > 0} />
        <StatTile icon={CalendarClock} label="Upcoming interviews" value={upcoming.length} sub="Next 7 days" href="/dashboard/hr/interviews" />
        <StatTile icon={HandCoins} label="Offers in flight" value={offers.length} sub={awaitingSign ? `${awaitingSign} awaiting e-sign` : 'None awaiting e-sign'} href="/dashboard/hr/offers" />
      </div>

      {/* Announcements */}
      <div className="mt-4 rounded-2xl border border-neutral-border bg-surface-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-dash-heading"><Megaphone size={15} className="text-accent" /> Announcements</h3>
          <button onClick={() => setComposing((v) => !v)} className="flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-[12px] font-medium text-dash-muted hover:bg-surface-hover">
            <Plus size={13} /> New
          </button>
        </div>
        {composing && (
          <div className="mb-3 rounded-xl border border-neutral-border p-3">
            <input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-body focus:border-accent focus:outline-none" />
            <textarea value={annBody} onChange={(e) => setAnnBody(e.target.value)} rows={3} placeholder="Message…" className="mt-2 w-full rounded-lg border border-neutral-border bg-surface-app px-3 py-2 text-sm text-dash-body focus:border-accent focus:outline-none" />
            <button onClick={postAnnouncement} disabled={!annTitle.trim() || !annBody.trim() || posting} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {posting ? <Loader2 size={13} className="animate-spin" /> : null} Publish
            </button>
          </div>
        )}
        {announcements.length === 0 ? (
          <p className="py-2 text-[12.5px] text-dash-muted">{loading ? 'Loading…' : 'No announcements yet.'}</p>
        ) : (
          <div className="space-y-3">
            {announcements.slice(0, 4).map((a) => (
              <div key={a.id} className="border-b border-neutral-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-dash-heading">{a.title}</span>
                  <span className="shrink-0 text-[11px] text-dash-muted">{formatDateTime(a.at)}</span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-dash-body">{a.body}</p>
                <p className="mt-0.5 text-[11px] text-dash-muted">— {a.authorName}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Hiring funnel" subtitle={`${focusReq?.title ?? ''} · applied → offer`}>
          {funnel.map((f) => <BarRow key={f.label} label={f.label} value={f.count} max={funnelMax} />)}
        </Card>
        <Card title="Time in stage" subtitle={`${focusReq?.title ?? ''} · avg days in current stage`}>
          {timeInStage.map((t) => <BarRow key={t.label} label={t.label} value={t.days} max={timeMax} />)}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Pending approvals" subtitle="Awaiting a human signature">
          {pending.length === 0 ? (
            <p className="py-4 text-center text-[12.5px] text-dash-muted">{loading ? 'Loading…' : 'Nothing waiting right now.'}</p>
          ) : (
            <div className="divide-y divide-neutral-border">
              {pending.slice(0, 4).map((t) => (
                <Link key={t.id} href="/dashboard/hr/approvals" className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-dash-heading group-hover:text-accent">{t.title}</span>
                  <span className="shrink-0 text-[11px] text-dash-muted">{t.summary.slice(0, 38)}…</span>
                  <ArrowUpRight size={14} className="shrink-0 text-dash-muted/40 group-hover:text-accent" />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card title="Upcoming interviews" subtitle="Across all requisitions">
          {upcoming.length === 0 ? (
            <p className="py-4 text-center text-[12.5px] text-dash-muted">{loading ? 'Loading…' : 'No interviews scheduled.'}</p>
          ) : (
            <div className="divide-y divide-neutral-border">
              {upcoming.map((i) => {
                const app = appMap.get(i.applicationId);
                const cand = app ? candMap.get(app.candidateId) : undefined;
                return (
                  <div key={i.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="w-24 shrink-0 text-[11px] text-dash-muted">{formatDay(i.scheduledAt)}</span>
                    <span className="w-16 shrink-0 text-[11px] text-dash-muted">{formatTime(i.scheduledAt)}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-dash-heading">{cand?.name ?? 'Candidate'}</span>
                    <span className="shrink-0 text-[11px] text-dash-muted">{ROUND_LABELS[i.round]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
