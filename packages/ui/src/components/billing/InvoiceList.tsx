'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Download, Loader2, AlertCircle } from 'lucide-react';
import {
  invoices as invoicesApi,
  formatMinor,
  TAX_TREATMENT_LABELS,
  type InvoiceSummary,
} from '../../lib/api';
import { cn } from '../../lib/utils';

/**
 * Invoice history with PDF download.
 *
 * Invoices are issued server-side when a payment is captured — there is no
 * "create invoice" action here by design, since a tax invoice must correspond
 * to money that actually moved.
 */

const STATUS_STYLES: Record<string, string> = {
  paid:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  issued: 'bg-blue-50 text-blue-700 border-blue-200',
  void:   'bg-neutral-100 text-text-muted border-neutral-200 line-through',
};

export function InvoiceList({ token, pageSize = 10 }: { token: string; pageSize?: number }) {
  const [rows, setRows]       = useState<InvoiceSummary[]>([]);
  const [total, setTotal]     = useState(0);
  const [offset, setOffset]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await invoicesApi.list(token, { limit: pageSize, offset });
        if (cancelled) return;
        setRows(res.data ?? []);
        setTotal(res.total ?? 0);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || 'Could not load invoices.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, offset, pageSize]);

  const handleDownload = useCallback(async (inv: InvoiceSummary) => {
    setDownloading(inv.id);
    setError('');
    try {
      await invoicesApi.download(token, inv.id, `${inv.invoice_number.replace(/[^\w.-]+/g, '-')}.pdf`);
    } catch (err) {
      setError((err as Error).message || 'Could not download that invoice.');
    } finally {
      setDownloading(null);
    }
  }, [token]);

  if (loading && !rows.length) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-muted">
        <Loader2 size={16} className="animate-spin" />
        Loading invoices…
      </div>
    );
  }

  if (!loading && !rows.length && !error) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-border bg-bg-secondary/50 py-12 text-center">
        <FileText size={28} className="mx-auto mb-3 text-text-muted" />
        <p className="text-sm font-medium text-text-primary">No invoices yet</p>
        <p className="mt-1 text-xs text-text-muted">
          Invoices appear here automatically after a payment is completed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div aria-live="polite">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-border bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">Your invoices</caption>
          <thead>
            <tr className="border-b border-neutral-border bg-bg-secondary/60 text-left">
              <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Invoice</th>
              <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Date</th>
              <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Tax</th>
              <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Total</th>
              <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">
                <span className="sr-only">Download</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => (
              <tr key={inv.id} className="border-b border-neutral-border last:border-0 hover:bg-bg-secondary/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-text-primary">{inv.invoice_number}</span>
                    <span className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase',
                      STATUS_STYLES[inv.status] ?? STATUS_STYLES.issued,
                    )}>
                      {inv.status}
                    </span>
                  </div>
                  {inv.user_name && (
                    <p className="mt-0.5 text-xs text-text-muted">{inv.user_name}</p>
                  )}
                </td>

                <td className="px-4 py-3 text-xs text-text-muted">
                  {new Date(inv.issued_at).toLocaleDateString(undefined, {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </td>

                <td className="px-4 py-3">
                  {inv.tax_total_minor > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-text-primary">
                        {formatMinor(inv.tax_total_minor, inv.currency)}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {TAX_TREATMENT_LABELS[inv.tax_treatment ?? ''] ?? inv.tax_treatment}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-text-muted">
                      {TAX_TREATMENT_LABELS[inv.tax_treatment ?? ''] ?? '—'}
                    </p>
                  )}
                </td>

                <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-text-primary">
                  {formatMinor(inv.total_minor, inv.currency)}
                </td>

                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDownload(inv)}
                    disabled={downloading === inv.id}
                    aria-label={`Download invoice ${inv.invoice_number} as PDF`}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-2.5 py-1.5',
                      'text-xs font-medium text-text-secondary transition-colors',
                      'hover:bg-bg-secondary hover:text-text-primary',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    {downloading === inv.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Download size={13} />}
                    PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            {offset + 1}–{Math.min(offset + pageSize, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOffset((o) => Math.max(0, o - pageSize))}
              disabled={offset === 0 || loading}
              className="rounded-lg border border-neutral-border px-2.5 py-1 font-medium transition-colors hover:bg-bg-secondary disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setOffset((o) => o + pageSize)}
              disabled={offset + pageSize >= total || loading}
              className="rounded-lg border border-neutral-border px-2.5 py-1 font-medium transition-colors hover:bg-bg-secondary disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceList;
