'use client';

import { RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import {
  OFFER_STATUS_LABELS, formatLPA, formatBand, formatDate,
  type OfferStatus, type Offer, type Application, type Candidate, type Requisition,
} from '@/lib/hr/demo';

const STATUS_CLASS: Record<OfferStatus, string> = {
  draft: 'bg-surface-hover text-dash-muted',
  pending_approval: 'bg-amber-50 text-amber-600',
  approved: 'bg-accent-weak text-accent',
  sent_for_esign: 'bg-ok-bg text-ok',
};

export default function HrOffersPage() {
  const { get, loading, error, reload, setLoading } = useHr(['offers', 'applications', 'candidates', 'requisitions']);
  const offers = get<Offer>('offers');
  const appMap = new Map(get<Application>('applications').map((a) => [a.id, a]));
  const candMap = new Map(get<Candidate>('candidates').map((c) => [c.id, c]));
  const reqMap = new Map(get<Requisition>('requisitions').map((r) => [r.id, r]));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Offers"
        subtitle="Comp checks against the band are deterministic policy. Out-of-band offers escalate; every letter is an AI draft a human approves."
        actions={
          <button onClick={() => { setLoading(true); reload(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-border bg-surface-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-border text-left text-xs text-dash-muted">
              <th className="px-5 py-2.5 font-medium">Candidate</th>
              <th className="px-3 py-2.5 font-medium">Role</th>
              <th className="px-3 py-2.5 font-medium">Offered CTC</th>
              <th className="px-3 py-2.5 font-medium">Band</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 text-right font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-dash-muted">Loading…</td></tr>
            ) : offers.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-dash-muted">No offers yet.</td></tr>
            ) : offers.map((o) => {
              const app = appMap.get(o.applicationId);
              const cand = app ? candMap.get(app.candidateId) : undefined;
              const req = app ? reqMap.get(app.requisitionId) : undefined;
              return (
                <tr key={o.id} className="border-b border-neutral-border last:border-0">
                  <td className="px-5 py-3 font-medium text-dash-heading">{cand?.name ?? 'Candidate'}</td>
                  <td className="px-3 py-3 text-dash-body">{req?.title ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className="text-dash-heading">{formatLPA(o.ctcINR)}</span>
                    {o.inBand === false && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">out of band</span>}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-dash-muted">{req ? formatBand(req.compBandINR) : '—'}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[o.status]}`}>{OFFER_STATUS_LABELS[o.status]}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-[11px] text-dash-muted">{formatDate(o.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
