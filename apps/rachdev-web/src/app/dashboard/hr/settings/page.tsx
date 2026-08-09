'use client';

import { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { hr, type HrConfig } from '@rach/ui/lib/api';
import { PageHeader } from '@/components/dashboard/PageHeader';

const AI_FEATURES: { id: string; label: string; hint: string }[] = [
  { id: 'jd.generate', label: 'JD drafting', hint: 'Draft job descriptions from a requisition.' },
  { id: 'jd.biasLint', label: 'Bias-language lint', hint: 'Flag exclusionary phrasing in a JD.' },
  { id: 'screening.score', label: 'Résumé screening score', hint: 'Score résumés against the requisition.' },
  { id: 'screening.rejectionEmail', label: 'Rejection email drafts', hint: 'Draft respectful rejection emails.' },
  { id: 'voice.scorecardSummary', label: 'Voice-screen scorecard', hint: 'Summarize a structured voice screen.' },
  { id: 'offer.letterDraft', label: 'Offer letter drafts', hint: 'Draft an offer letter from approved terms.' },
  { id: 'assist.candidateQA', label: 'Candidate Q&A assistant', hint: 'Answer candidate questions from policy.' },
];

const POLICY_GATES: { key: string; label: string; description: string }[] = [
  { key: 'comp_band', label: 'Comp-band check', description: 'Out-of-band offers escalate to HR Director — deterministic, no AI.' },
  { key: 'knockout', label: 'Knockout rules', description: 'Hard filters (work authorization, min experience) run before any AI score.' },
  { key: 'rejection_delay', label: 'Rejection hold window', description: 'Approved rejection emails are held 48h before sending so a human can catch errors.' },
];

function Toggle({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} role="switch" aria-checked={on}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-accent' : 'bg-surface-hover'}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''} left-0.5`} />
    </button>
  );
}

export default function HrSettingsPage() {
  const { token } = useAuth();
  const [config, setConfig] = useState<HrConfig | null>(null);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    hr.getConfig(token).then(setConfig).catch((e: unknown) => setError((e as Error).message));
  }, [token]);

  const toggleFeature = async (id: string) => {
    if (!token || !config) return;
    const next = !config.aiFeatures[id];
    setConfig({ ...config, aiFeatures: { ...config.aiFeatures, [id]: next } }); // optimistic
    setSavingKey(id); setError('');
    try {
      const saved = await hr.saveConfig({ aiFeatures: { [id]: next } }, token);
      setConfig(saved);
    } catch (e) {
      setError((e as Error).message);
      setConfig((c: HrConfig | null) => (c ? { ...c, aiFeatures: { ...c.aiFeatures, [id]: !next } } : c)); // revert
    } finally {
      setSavingKey(null);
    }
  };

  const toggleGate = async (key: string) => {
    if (!token || !config) return;
    const next = !config.policyGates[key];
    setConfig({ ...config, policyGates: { ...config.policyGates, [key]: next } });
    setSavingKey(key); setError('');
    try {
      const saved = await hr.saveConfig({ policyGates: { [key]: next } }, token);
      setConfig(saved);
    } catch (e) {
      setError((e as Error).message);
      setConfig((c: HrConfig | null) => (c ? { ...c, policyGates: { ...c.policyGates, [key]: !next } } : c));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" subtitle="Approval governance and AI configuration for this workspace. Changes save automatically." />

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      {!config ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-dash-muted"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
            <div className="mb-3 flex items-center gap-2"><Sparkles size={16} className="text-accent" /><h3 className="text-sm font-semibold text-dash-heading">AI features</h3></div>
            <div className="divide-y divide-neutral-border">
              {AI_FEATURES.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-dash-heading">{f.label}</div>
                    <div className="text-[11.5px] text-dash-muted">{f.hint}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {savingKey === f.id && <Loader2 size={12} className="animate-spin text-dash-muted" />}
                    <Toggle on={!!config.aiFeatures[f.id]} disabled={savingKey === f.id} onClick={() => toggleFeature(f.id)} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-dash-muted">Every AI output is a draft until a human approves it — turning a feature off removes the draft, never the human decision.</p>
          </div>

          <div className="rounded-2xl border border-neutral-border bg-surface-card p-5">
            <div className="mb-3 flex items-center gap-2"><ShieldCheck size={16} className="text-dash-muted" /><h3 className="text-sm font-semibold text-dash-heading">Policy gates</h3></div>
            <p className="mb-3 text-[11.5px] text-dash-muted">Deterministic rules — no AI involved.</p>
            <div className="space-y-2.5">
              {POLICY_GATES.map((r) => {
                const active = !!config.policyGates[r.key];
                return (
                  <div key={r.key} className="rounded-xl border border-neutral-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-dash-heading">{r.label}</span>
                      <div className="flex items-center gap-2">
                        {savingKey === r.key && <Loader2 size={12} className="animate-spin text-dash-muted" />}
                        <Toggle on={active} disabled={savingKey === r.key} onClick={() => toggleGate(r.key)} />
                      </div>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-dash-muted">{r.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
