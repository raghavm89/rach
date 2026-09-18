'use strict';

/**
 * Tax gross-up for the Pro (shared-tier) billing path.
 *
 * proPricing amounts are EX-GST (see packages/billing/src/proPricing.js). The legacy
 * purchase path (VM subscriptions, credit packs) already grosses the charge up with GST
 * via the shared tax engine and issues a reconciling tax invoice; the Pro container path
 * did neither — it charged the ex-GST amount through Razorpay while checkout displayed a
 * GST-inclusive total, and produced no invoice (go-live audit P0 #3).
 *
 * This module adds the SAME gross-up the invoice will reverse: given an ex-GST subtotal and
 * the subscriber's user id, it returns the tax to add so the Razorpay charge equals the
 * invoice total. Buyer jurisdiction is read from the SAME users row the invoice service uses
 * (`issueInvoiceForPayment`), so the charge and the later invoice always reconcile.
 *
 * Tax is zero unless an active `tax_registrations` row covers the buyer — identical to the
 * legacy path — so this is a no-op for Rest-of-World and for India until the GST registration
 * is inserted.
 *
 * FAIL-CLOSED (re-audit 6 Sep): a tax-engine or profile-lookup FAILURE throws
 * `TaxUnavailableError` (status 503) instead of silently returning zero. The old fallback
 * meant a transient tax outage at plan-creation time minted a *recurring* Razorpay plan at
 * the ex-GST amount — undercharging every cycle forever while later invoices re-added GST
 * (permanent charge/invoice mismatch). A checkout that fails with "try again in a moment"
 * is recoverable; a mispriced 120-cycle subscription is not. Zero tax as a *result* (RoW
 * buyer, no active registration) is still a success, not an error.
 */

const { pool } = require('@rach/core');
const { tax } = require('@rach/billing');

/** Thrown when the tax amount cannot be COMPUTED (engine/profile failure) — never when the
 * computed tax is legitimately zero. Carries status 503 so the central error handler turns
 * it into a clean retryable response instead of a generic 500. */
class TaxUnavailableError extends Error {
  constructor(cause) {
    super('Tax calculation is temporarily unavailable. Please try again in a moment — you have not been charged.');
    this.name = 'TaxUnavailableError';
    this.code = 'tax_unavailable';
    this.status = 503;
    if (cause) this.cause = cause;
  }
}

// Resolve the buyer jurisdiction from the subscriber's profile — the exact fields the tax
// engine keys on, from the same source the invoice service reads.
async function buyerForUser(userId, deps = {}) {
  const db = deps.pool || pool;
  if (!userId) return {};
  const { rows } = await db.query(
    `SELECT gstin, billing_address FROM users WHERE id = $1`,
    [userId],
  );
  const u = rows[0];
  if (!u) return {};
  const addr = u.billing_address || {};
  const country = String(addr.country || '').trim();
  const countryCode = country.length === 2 ? country.toUpperCase()
    : /^india$/i.test(country) ? 'IN'
    : country ? country.toUpperCase() : (u.gstin ? 'IN' : '');
  return {
    country_code: countryCode || null,
    region_code: addr.state || addr.region_code || null,
    postal_code: addr.pincode || addr.postal_code || null,
    city: addr.city || null,
    gstin: u.gstin || addr.gstin || null,
  };
}

/**
 * GST (or other registered tax) on an ex-GST subtotal, in the same minor units/currency.
 * Returns 0 when no active registration covers the buyer (a computed zero).
 * THROWS TaxUnavailableError when the amount cannot be computed at all — callers create
 * recurring plans/orders from this number, so a guess is worse than a retryable failure.
 *
 * @param {object} opts
 * @param {number} opts.userId        subscriber (buyer jurisdiction + invoice recipient)
 * @param {number} opts.subtotalCents ex-GST amount (minor units)
 * @param {string} opts.currency
 * @param {string} opts.description   line description (for place-of-supply/SAC context)
 */
async function taxCentsFor({ userId, subtotalCents, currency = 'USD', description = 'RachBase Pro' }, deps = {}) {
  const amount = Math.max(0, Math.round(Number(subtotalCents) || 0));
  if (amount === 0) return 0;
  try {
    const buyer = await buyerForUser(userId, deps);
    const calc = deps.calculateTax || tax.calculateTax;
    const result = await calc({
      lines: [{ description, quantity: 1, unit_price_minor: amount, subtotal_minor: amount }],
      currency,
      buyer,
    });
    return Math.max(0, Number(result.tax_total_minor) || 0);
  } catch (err) {
    console.error('[pro-tax] gross-up FAILED — refusing to price ex-GST:', err.message);
    throw new TaxUnavailableError(err);
  }
}

/**
 * Gross an ex-GST subtotal up to the tax-inclusive amount Razorpay should charge.
 * Throws TaxUnavailableError (503) when tax cannot be computed — fail the checkout,
 * never mint a mispriced recurring plan.
 * @returns {Promise<{ subtotalCents:number, taxCents:number, grossCents:number }>}
 */
async function grossUpFor({ userId, subtotalCents, currency = 'USD', description }, deps = {}) {
  const subtotal = Math.max(0, Math.round(Number(subtotalCents) || 0));
  const taxCents = await taxCentsFor({ userId, subtotalCents: subtotal, currency, description }, deps);
  return { subtotalCents: subtotal, taxCents, grossCents: subtotal + taxCents };
}

module.exports = { buyerForUser, taxCentsFor, grossUpFor, TaxUnavailableError };
