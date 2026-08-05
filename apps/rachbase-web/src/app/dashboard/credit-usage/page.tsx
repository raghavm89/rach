'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { agent } from '@rach/ui/lib/api';
import { Coins, Bot, CreditCard, Activity, Receipt, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@rach/ui/lib/utils';

export default function CreditUsagePage() {
  const { token, user } = useAuth();
  const router = useRouter();

  // Credit usage is a tenant-admin view.
  useEffect(() => {
    if (user && user.role !== 'tenant_admin' && user.role !== 'admin') router.replace('/dashboard');
  }, [user, router]);

  const [summary, setSummary]         = useState<{ balance: number; total_purchased: number; total_used: number; total_tokens: number } | null>(null);
  const [history, setHistory]         = useState<{ id: number; type: string; amount: number; description: string; created_at: string; user_name?: string | null }[]>([]);
  const [sessions, setSessions]       = useState<{ id: number; title: string; message_count: number; total_tokens: number; total_credits: number; updated_at: string }[]>([]);
  const [loading, setLoading]         = useState(true);
  const [histPage, setHistPage]       = useState(1);
  const [histTotal, setHistTotal]     = useState(0);

  const loadPage = useCallback(async (page = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const [sumData, histData, sessData] = await Promise.all([
        agent.getUsageSummary(token),
        agent.getCreditHistory(token, page),
        agent.getSessionUsage(token),
      ]);
      setSummary(sumData);
      setHistory(histData.transactions);
      setHistTotal(histData.total);
      setHistPage(page);
      setSessions(sessData.sessions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadPage(); }, [loadPage]);

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display text-text-primary">Credit Usage</h2>
          <p className="mt-1 text-sm text-text-muted">Track your agent credit consumption and history.</p>
        </div>
        <Link
          href="/dashboard/billing?tab=credits"
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Coins size={14} /> Buy Credits
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Current Balance',  value: `${summary.balance} cr`,           icon: <Coins size={16} />,      accent: true },
                { label: 'Total Purchased',  value: `${summary.total_purchased} cr`,   icon: <CreditCard size={16} />, accent: false },
                { label: 'Total Used',       value: `${summary.total_used} cr`,        icon: <Activity size={16} />,   accent: false },
                { label: 'Total Tokens',     value: summary.total_tokens.toLocaleString(), icon: <Bot size={16} />,    accent: false },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-neutral-border bg-surface-card p-5">
                  <div className={cn('mb-3 flex h-8 w-8 items-center justify-center rounded-lg',
                    stat.accent ? 'bg-gradient-to-br from-primary-blue to-primary-purple text-white' : 'bg-bg-secondary text-text-muted'
                  )}>
                    {stat.icon}
                  </div>
                  <p className="text-2xl font-bold font-mono text-text-primary">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Session usage */}
          {sessions.length > 0 && (
            <div className="rounded-xl border border-neutral-border bg-surface-card overflow-hidden">
              <div className="border-b border-neutral-border px-6 py-4 flex items-center gap-2">
                <Bot size={15} className="text-text-muted" />
                <h3 className="text-sm font-semibold text-text-primary">Agent Session Usage</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-border bg-bg-secondary">
                      {['Session', 'Messages', 'Tokens Used', 'Credits Used', 'Last Active'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-border">
                    {sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-bg-secondary transition-colors">
                        <td className="px-6 py-3 text-sm font-medium text-text-primary max-w-[200px] truncate">{s.title}</td>
                        <td className="px-6 py-3 text-sm font-mono text-text-secondary">{s.message_count}</td>
                        <td className="px-6 py-3 text-sm font-mono text-text-secondary">{s.total_tokens.toLocaleString()}</td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary-blue/10 px-2.5 py-0.5 text-xs font-semibold text-primary-blue">
                            <Coins size={10} />{s.total_credits}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-xs text-text-muted">
                          {new Date(s.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Credit history */}
          {history.length > 0 && (
            <div className="rounded-xl border border-neutral-border bg-surface-card overflow-hidden">
              <div className="border-b border-neutral-border px-6 py-4 flex items-center gap-2">
                <Receipt size={15} className="text-text-muted" />
                <h3 className="text-sm font-semibold text-text-primary">Credit History</h3>
                <span className="ml-auto text-xs text-text-muted">{histTotal} total</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-border bg-bg-secondary">
                      {['Date', 'Type', 'Amount', 'Description', 'By'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-border">
                    {history.map((tx) => (
                      <tr key={tx.id} className="hover:bg-bg-secondary transition-colors">
                        <td className="px-6 py-3 text-xs text-text-muted whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-3">
                          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                            tx.type === 'purchase' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                          )}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={cn('font-mono font-semibold', tx.amount > 0 ? 'text-emerald-600' : 'text-text-primary')}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount} cr
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-text-secondary max-w-[240px] truncate">{tx.description}</td>
                        <td className="px-6 py-3 text-xs text-text-muted">{tx.user_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {histTotal > 20 && (
                <div className="border-t border-neutral-border px-6 py-3 flex items-center justify-between">
                  <p className="text-xs text-text-muted">
                    Page {histPage} of {Math.ceil(histTotal / 20)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadPage(histPage - 1)}
                      disabled={histPage === 1}
                      className="rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary disabled:opacity-40 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => loadPage(histPage + 1)}
                      disabled={histPage >= Math.ceil(histTotal / 20)}
                      className="rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary disabled:opacity-40 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!summary && (
            <div className="text-center py-20 text-text-muted text-sm">
              No credit activity yet.{' '}
              <Link href="/dashboard/billing?tab=credits" className="text-primary-blue hover:underline">Buy credits</Link> to get started.
            </div>
          )}
        </>
      )}
    </div>
  );
}
