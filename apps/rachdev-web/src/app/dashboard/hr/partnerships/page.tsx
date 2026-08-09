'use client';

import { useState } from 'react';
import { RefreshCw, Loader2, Sparkles, Check, X, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import { Pill, DraftCard, CARD, INPUT, BTN, BTN_GHOST } from '@/components/dashboard/hr/bits';
import { PARTNERSHIP_STATUS_LABELS, type PartnershipOpportunity, type PartnershipStatus } from '@/lib/hr/demo';

const STATUS_CLASS: Record<PartnershipStatus, string> = {
  new: 'bg-accent-weak text-accent', exploring: 'bg-ok-bg text-ok',
  declined: 'bg-red-50 text-red-600', archived: 'bg-surface-hover text-dash-muted',
};

export default function HrPartnershipsPage() {
  const { token } = useAuth();
  const { get, loading, error, reload, setLoading } = useHr(['partnerships']);
  const opps = get<PartnershipOpportunity>('partnerships');
  const [busy, setBusy] = useState('');
  const [decline, setDecline] = useState<{ id: string; reason: string } | null>(null);

  async function run(key: string, fn: () => Promise<unknown>) {
    if (!token) return; setBusy(key);
    try { await fn(); await reload(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Partnerships"
        subtitle="Inbound vendor and benefit opportunities surfaced by the scout agent (simulated). Decide, or draft an internal brief for discussion — advisory only."
        actions={<button onClick={() => { setLoading(true); reload(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>}
      />
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      {loading ? <p className="mt-6 text-sm text-dash-muted">Loading…</p> : (
        <div className="mt-6 space-y-4">
          {opps.map((o) => (
            <div key={o.id} className={`${CARD} p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-dash-heading">{o.partner}</h3>
                    <Pill>{o.category}</Pill>
                  </div>
                  <p className="mt-1 text-[13px] text-dash-body">{o.pitch}</p>
                  <p className="mt-1 text-[12px] text-dash-muted">Indicative cost: {o.estCostBand}</p>
                </div>
                <Pill className={STATUS_CLASS[o.status]}>{PARTNERSHIP_STATUS_LABELS[o.status]}</Pill>
              </div>

              {o.declineReason && o.status === 'declined' && <p className="mt-2 text-[12px] text-red-600">Declined: {o.declineReason}</p>}

              {(o.status === 'new' || o.status === 'exploring') && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {o.status === 'new' && (
                    <button className={BTN} disabled={!!busy} onClick={() => run(`acc-${o.id}`, () => hr.partnership.decide(o.id, { decision: 'accept' }, token!))}>
                      {busy === `acc-${o.id}` ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Start exploring
                    </button>
                  )}
                  <button className={BTN_GHOST} disabled={!!busy} onClick={() => setDecline({ id: o.id, reason: '' })}><X size={14} /> Decline</button>
                  <button className={BTN_GHOST} disabled={!!busy} onClick={() => run(`arc-${o.id}`, () => hr.partnership.decide(o.id, { decision: 'archive' }, token!))}><Archive size={14} /> Archive</button>
                  {!o.brief && (
                    <button className={BTN_GHOST} disabled={!!busy} onClick={() => run(`br-${o.id}`, () => hr.partnership.draftBrief(o.id, token!))}>
                      {busy === `br-${o.id}` ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Draft brief
                    </button>
                  )}
                </div>
              )}

              {o.brief && <div className="mt-3"><DraftCard title="Internal brief" body={o.brief.body} footnote="AI draft for internal discussion, not a decision." /></div>}

              {decline?.id === o.id && (
                <div className="mt-3 rounded-lg border border-neutral-border p-3">
                  <textarea rows={2} className={INPUT} placeholder="Reason for declining…" value={decline.reason} onChange={(e) => setDecline({ id: o.id, reason: e.target.value })} />
                  <div className="mt-2 flex gap-2">
                    <button className={BTN} disabled={!decline.reason.trim() || !!busy} onClick={() => run(`dec-${o.id}`, async () => { await hr.partnership.decide(o.id, { decision: 'decline', reason: decline.reason.trim() }, token!); setDecline(null); })}>Confirm decline</button>
                    <button className={BTN_GHOST} onClick={() => setDecline(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
