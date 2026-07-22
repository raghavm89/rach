'use strict';

/**
 * Invoice number allocation.
 *
 * Indian GST (Rule 46, CGST Rules) requires invoice numbers to be a
 * consecutive serial, unique within a financial year, not exceeding 16
 * characters. That rules out a plain Postgres SEQUENCE: sequences deliberately
 * leak values on rollback, which would leave gaps in the series.
 *
 * Instead we take a row lock on (series, fiscal_year) and increment inside the
 * caller's transaction. Concurrent issuance serialises on that row; if the
 * transaction rolls back, the number is released and reused.
 *
 * Format: RB/2026-27/000123   (15 chars)
 */

const SERIES = () => process.env.INVOICE_SERIES || 'RB';

/**
 * Indian financial year: 1 April → 31 March.
 * 2026-07-21 → '2026-27';  2026-02-10 → '2025-26'
 */
function fiscalYearFor(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0-indexed; March = 2
  const startYear = m >= 3 ? y : y - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endShort}`;
}

/**
 * Allocate the next number. MUST be called inside a transaction — the row lock
 * is what makes this safe, and it is only held until the caller commits.
 *
 * @param {import('pg').PoolClient} client  a client with an open transaction
 */
async function allocate(client, { series = SERIES(), date = new Date() } = {}) {
  const fiscalYear = fiscalYearFor(date);

  // Upsert-then-lock in one statement. ON CONFLICT DO UPDATE takes the row lock
  // even when the row already exists, so two concurrent callers serialise here.
  const { rows } = await client.query(
    `INSERT INTO invoice_sequences (series, fiscal_year, last_number)
     VALUES ($1, $2, 1)
     ON CONFLICT (series, fiscal_year) DO UPDATE
       SET last_number = invoice_sequences.last_number + 1,
           updated_at  = NOW()
     RETURNING last_number`,
    [series, fiscalYear]
  );

  const n = rows[0].last_number;
  const padded = String(n).padStart(6, '0');

  return {
    invoice_number: `${series}/${fiscalYear}/${padded}`,
    fiscal_year: fiscalYear,
    sequence: n,
  };
}

module.exports = { allocate, fiscalYearFor, SERIES };
