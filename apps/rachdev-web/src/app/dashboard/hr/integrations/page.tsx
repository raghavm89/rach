'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr, type HrConfig } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';

type Category = 'job_board' | 'ats' | 'hris' | 'bgv';
interface Connector { id: string; name: string; category: Category; partnerGated?: boolean; detail: string }

const CONNECTORS: Connector[] = [
  { id: 'naukri', name: 'Naukri', category: 'job_board', detail: 'Direct posting API — postings and applies sync automatically.' },
  { id: 'careers', name: 'Careers Page', category: 'job_board', detail: 'Hosted careers page with branded application flow and consent capture.' },
  { id: 'linkedin', name: 'LinkedIn Jobs', category: 'job_board', partnerGated: true, detail: 'Job postings via aggregator partnership. Postings only — no profile data flows in.' },
  { id: 'indeed', name: 'Indeed', category: 'job_board', partnerGated: true, detail: 'Sponsored and organic postings via aggregator partnership.' },
  { id: 'greenhouse', name: 'Greenhouse', category: 'ats', detail: 'Import requisitions and candidates from an existing Greenhouse instance.' },
  { id: 'keka', name: 'Keka', category: 'hris', detail: 'Employee records sync on hire — offer-accepted candidates flow into onboarding.' },
  { id: 'darwinbox', name: 'Darwinbox', category: 'hris', detail: 'HRIS sync for enterprise tenants.' },
  { id: 'greythr', name: 'greytHR', category: 'hris', detail: 'HRIS sync for SMB tenants.' },
  { id: 'springverify', name: 'SpringVerify', category: 'bgv', detail: 'Background verification partner — runs employment and education checks with candidate consent.' },
];

const CATEGORY_LABELS: Record<Category, string> = { job_board: 'Job boards', ats: 'ATS', hris: 'HRIS', bgv: 'Background verification' };

export default function HrIntegrationsPage() {
  const { token } = useAuth();
  const [config, setConfig] = useState<HrConfig | null>(null);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    hr.getConfig(token).then(setConfig).catch((e: unknown) => setError((e as Error).message));
  }, [token]);

  const toggleConnector = async (id: string) => {
    if (!token || !config) return;
    const next = config.integrations[id] === 'connected' ? 'available' : 'connected';
    setConfig({ ...config, integrations: { ...config.integrations, [id]: next } }); // optimistic
    setSavingId(id); setError('');
    try {
      const saved = await hr.saveConfig({ integrations: { [id]: next } }, token);
      setConfig(saved);
    } catch (e) {
      setError((e as Error).message);
      hr.getConfig(token).then(setConfig).catch(() => {}); // resync
    } finally {
      setSavingId(null);
    }
  };

  const categories: Category[] = ['job_board', 'ats', 'hris', 'bgv'];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Integrations"
        subtitle="ATS, HRIS, job boards, and the BGV partner. No CRMs by design. Candidate data only ever arrives with consent."
      />

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      {!config ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="mt-6 space-y-6">
          {categories.map((cat) => (
            <section key={cat}>
              <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-dash-body">{CATEGORY_LABELS[cat]}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CONNECTORS.filter((c) => c.category === cat).map((c) => {
                  const connected = config.integrations[c.id] === 'connected';
                  return (
                    <div key={c.id} className={`rounded-2xl border bg-surface-card p-4 ${connected ? 'border-accent/30' : 'border-neutral-border'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13.5px] font-semibold text-dash-heading">{c.name}</span>
                            {c.partnerGated && <span className="rounded-full border border-neutral-border px-1.5 py-0.5 text-[10px] font-normal text-dash-muted">Partner-gated</span>}
                          </div>
                          <p className="mt-1 text-[12px] leading-relaxed text-dash-muted">{c.detail}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${connected ? 'bg-ok-bg text-ok' : 'bg-surface-hover text-dash-muted'}`}>
                          {connected ? 'Connected' : 'Available'}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleConnector(c.id)}
                        disabled={savingId === c.id}
                        className={`mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${connected ? 'border-neutral-border text-dash-body hover:bg-surface-hover' : 'border-accent/40 text-accent hover:bg-accent-weak'}`}
                      >
                        {savingId === c.id && <Loader2 size={12} className="animate-spin" />}
                        {connected ? 'Disconnect' : 'Connect'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
