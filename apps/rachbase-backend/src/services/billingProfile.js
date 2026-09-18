'use strict';

/**
 * Billing-profile persistence + the "GST for every Indian buyer" guarantee.
 *
 * THE RULE (founder decision, 6 Sep 2026): an India-billed customer is charged 18% GST
 * whether or not they provide a GSTIN. A GSTIN is optional B2B detail — it refines the
 * place of supply (CGST/SGST vs IGST) and lets the buyer claim input credit; it is NEVER
 * what decides that GST applies. The tax engine already behaves this way (an IN buyer
 * with no GSTIN and unknown state gets IGST 18% — the safe, cannot-under-collect default;
 * see packages/billing/src/services/tax/providers/indiaGst.js).
 *
 * What used to break the rule in practice: the checkout page COLLECTED a billing address
 * but never SAVED it, and the server prices/taxes from the `users` row (proTax.buyerForUser
 * → billing_address/gstin). A brand-new Indian user therefore looked like "buyer country
 * unknown → no tax charged" (tax/index.js), was quoted a GST-inclusive preview, and got a
 * recurring plan created ex-GST in the wrong currency. This module closes that:
 *
 *   1. `persistForUser` writes the billing details the checkout submits onto the caller's
 *      users row (merge — absent keys don't wipe saved ones) BEFORE any quote or charge,
 *      so currency resolution, gross-up and invoices all see the same, fresh jurisdiction.
 *   2. `assertBillableCountry` refuses to create a charge for a buyer whose country cannot
 *      be resolved at all — "unknown" must never be a discount. (billing_country_required,
 *      400 — the checkout form always sends a country, so a real customer never sees it.)
 *
 * GSTIN, when supplied, is format-validated and stored uppercase; when absent, nothing is
 * cleared and GST is still charged off the address. Charging correctly also requires the
 * IN row in `tax_registrations` in production — scripts/setup-tax-registration.js.
 */

const { pool } = require('@rach/core');
const proTax = require('./proTax');

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// billing_address keys we accept from a checkout payload (proTax.buyerForUser reads
// country/state/pincode/city; the rest ride along for the invoice header).
const ADDRESS_KEYS = ['line1', 'line2', 'city', 'state', 'pincode', 'country', 'company'];

function err(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

/** Trim a submitted billing payload down to known string fields. Returns null when the
 * payload carries nothing usable (caller then just relies on the saved profile). */
function normalizeBilling(billing) {
  if (!billing || typeof billing !== 'object') return null;
  const out = {};
  for (const k of ADDRESS_KEYS) {
    if (typeof billing[k] === 'string' && billing[k].trim()) out[k] = billing[k].trim().slice(0, 200);
  }
  const gstin = typeof billing.gstin === 'string' ? billing.gstin.trim().toUpperCase() : '';
  return Object.keys(out).length || gstin ? { address: out, gstin } : null;
}

/**
 * Persist the billing details submitted with a checkout onto the caller's users row,
 * BEFORE any charge is quoted or created. Merge semantics: keys the payload doesn't send
 * keep their saved values; GSTIN is only ever set (validated, uppercase), never cleared
 * from a checkout. No-op when the payload carries nothing.
 */
async function persistForUser(userId, billing, deps = {}) {
  const db = deps.pool || pool;
  const norm = normalizeBilling(billing);
  if (!userId || !norm) return { updated: false };

  if (norm.gstin && !GSTIN_RE.test(norm.gstin)) {
    throw err(400, 'invalid_gstin', 'That GSTIN does not look valid. Check the 15-character number, or leave it blank — GST applies either way.');
  }

  const { rows } = await db.query(`SELECT billing_address FROM users WHERE id = $1`, [userId]);
  if (!rows[0]) return { updated: false };
  const merged = { ...(rows[0].billing_address || {}), ...norm.address };

  if (norm.gstin) {
    await db.query(
      `UPDATE users SET billing_address = $2, gstin = $3, updated_at = NOW() WHERE id = $1`,
      [userId, JSON.stringify(merged), norm.gstin]);
  } else {
    await db.query(
      `UPDATE users SET billing_address = $2, updated_at = NOW() WHERE id = $1`,
      [userId, JSON.stringify(merged)]);
  }
  return { updated: true, address: merged, gstin: norm.gstin || null };
}

/**
 * Refuse to create a charge when the buyer's country cannot be resolved from their saved
 * profile (address country, or GSTIN implying India). An unknown jurisdiction previously
 * fell through to "no tax charged" — i.e. skipping the billing form was an accidental
 * 18% discount for Indian customers. Call AFTER persistForUser.
 */
async function assertBillableCountry(userId, deps = {}) {
  const buyer = await proTax.buyerForUser(userId, deps);
  if (!buyer.country_code) {
    throw err(400, 'billing_country_required',
      'A billing country is required before we can price your subscription (it determines currency and GST). Add your billing address and try again.');
  }
  return buyer;
}

module.exports = { normalizeBilling, persistForUser, assertBillableCountry, GSTIN_RE };
