'use client';

import { Loader2, Info } from 'lucide-react';
import { formatMinor, formatRateBps, type TaxQuote } from '../../lib/api';

/**
 * Order total with tax breakdown, for the checkout review step.
 *
 * The quote comes from the server (`POST /api/invoices/quote`) — the client
 * never computes tax, and never computes the total it sends for payment.
 */
export function TaxSummary({
  quote,
  loading,
  currency = 'USD',
  fallbackSubtotalMinor,
}: {
  quote: TaxQuote | null;
  loading?: boolean;
  currency?: string;
  /** Shown while the quote is in flight so the total doesn't flash empty. */
  fallbackSubtotalMinor?: number;
}) {
  const cur = quote?.currency ?? currency;

  if (loading && !quote) {
    return (
      <div className="space-y-2">
        <Row label="Subtotal" value={formatMinor(fallbackSubtotalMinor ?? 0, cur)} />
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <Loader2 size={12} className="animate-spin" />
          Calculating tax…
        </div>
      </div>
    );
  }

  if (!quote) {
    return <Row label="Total" value={formatMinor(fallbackSubtotalMinor ?? 0, cur)} bold />;
  }

  const zeroTax = quote.tax_total_minor === 0;

  return (
    <div className="space-y-2">
      <Row label="Subtotal" value={formatMinor(quote.subtotal_minor, cur)} />

      {quote.components.map((c) => (
        <Row
          key={`${c.name}-${c.rate_bps}`}
          label={`${c.name} @ ${formatRateBps(c.rate_bps)}`}
          value={formatMinor(c.amount_minor, cur)}
        />
      ))}

      {zeroTax && quote.notes && (
        <div className="flex items-start gap-1.5 rounded-lg bg-bg-secondary px-3 py-2 text-xs text-text-muted">
          <Info size={12} className="mt-0.5 shrink-0" />
          <span>{quote.notes}</span>
        </div>
      )}

      <div className="border-t border-neutral-border pt-2">
        <Row label="Total" value={formatMinor(quote.total_minor, cur)} bold />
      </div>

      {quote.place_of_supply && (
        <p className="text-[11px] text-text-muted">
          Place of supply: {quote.place_of_supply}
        </p>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? 'text-sm font-semibold text-text-primary' : 'text-sm text-text-muted'}>
        {label}
      </span>
      <span className={
        bold
          ? 'font-mono text-base font-bold text-text-primary'
          : 'font-mono text-sm text-text-secondary'
      }>
        {value}
      </span>
    </div>
  );
}

export default TaxSummary;
