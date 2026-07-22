'use strict';

/**
 * Invoice issuance.
 *
 * An invoice is a legal document. Two properties follow from that and shape
 * everything here:
 *
 *   1. **Immutable.** Seller and buyer details are snapshotted into the row at
 *      issue time. We never join to users/tenants when rendering, because a
 *      customer editing their address must not silently rewrite invoices we
 *      already issued to them.
 *   2. **Gapless.** Numbering happens inside the same transaction as the insert,
 *      so a failed issuance releases the number instead of burning it.
 *
 * Issuance is idempotent per Razorpay payment: a partial unique index on
 * `razorpay_payment_id` means webhook retries and double-clicked checkouts
 * return the existing invoice rather than creating a second one.
 */

const { pool } = require('@rach/core');
const { calculateTax } = require('../tax');
const { allocate } = require('./numbering');

/**
 * Build the buyer snapshot from a user row plus checkout billing details.
 * Checkout values win — they are what the customer typed for this purchase.
 */
function buildBuyer(user, billing = {}) {
  const addr = billing.address ?? user?.billing_address ?? null;

  return {
    name         : billing.name         || user?.business_name || user?.name || null,
    email        : billing.email        || user?.email || null,
    phone        : billing.phone        || user?.phone_number || null,
    gstin        : (billing.gstin       || user?.gstin || null)?.toUpperCase?.() ?? null,
    account_type : user?.account_type   || 'individual',
    business_name: billing.business_name || user?.business_name || null,
    country_code : normalizeCountry(billing.country || billing.country_code),
    region_code  : billing.state || billing.region_code || null,
    city         : billing.city || null,
    postal_code  : billing.pincode || billing.postal_code || null,
    address_line : typeof addr === 'string' ? addr : addr?.line1 ?? null,
    address      : addr,
  };
}

const COUNTRY_NAME_TO_ISO = {
  'India': 'IN', 'United States': 'US', 'United Kingdom': 'GB', 'Singapore': 'SG',
  'Australia': 'AU', 'Canada': 'CA', 'Germany': 'DE', 'UAE': 'AE',
};

function normalizeCountry(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (v.length === 2) return v.toUpperCase();
  return COUNTRY_NAME_TO_ISO[v] ?? v.toUpperCase();
}

/**
 * Issue an invoice.
 *
 * @param {object}  opts
 * @param {object}  opts.user       user row (id, tenant_id, name, email, gstin, …)
 * @param {Array}   opts.lines      [{ description, quantity, unit_price_minor }]
 * @param {string}  opts.currency
 * @param {object}  [opts.billing]  checkout billing details
 * @param {object}  [opts.payment]  { razorpay_order_id, razorpay_payment_id, razorpay_subscription_id }
 * @param {number}  [opts.expansionRequestId]
 * @param {string}  [opts.status]   'issued' | 'paid'
 * @returns {Promise<{invoice: object, lines: Array, created: boolean}>}
 */
async function issueInvoice({
  user,
  lines,
  currency = 'USD',
  billing = {},
  payment = {},
  expansionRequestId = null,
  status = 'paid',
  notes = null,
}) {
  if (!user?.id) throw new TypeError('issueInvoice requires a user with an id');
  if (!Array.isArray(lines) || !lines.length) throw new TypeError('issueInvoice requires lines');

  // Idempotency: one invoice per captured payment.
  if (payment.razorpay_payment_id) {
    const existing = await findByPaymentId(payment.razorpay_payment_id);
    if (existing) return { ...existing, created: false };
  }

  const buyer = buildBuyer(user, billing);

  // Normalise lines to integer minor units and compute subtotals server-side.
  const priced = lines.map((l) => {
    const qty = Number.isInteger(l.quantity) && l.quantity > 0 ? l.quantity : 1;
    const unit = l.unit_price_minor;
    if (!Number.isSafeInteger(unit)) {
      throw new TypeError(`Line "${l.description}" unit_price_minor must be an integer in minor units`);
    }
    return {
      description: l.description,
      quantity: qty,
      unit_price_minor: unit,
      subtotal_minor: unit * qty,
    };
  });

  const tax = await calculateTax({ lines: priced, currency, buyer });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { invoice_number, fiscal_year } = await allocate(client);

    const { rows: invRows } = await client.query(
      `INSERT INTO invoices (
         invoice_number, fiscal_year, tenant_id, user_id, status, currency,
         subtotal_minor, tax_total_minor, total_minor,
         seller_json, buyer_json, tax_json, place_of_supply, tax_treatment,
         razorpay_order_id, razorpay_payment_id, razorpay_subscription_id,
         expansion_request_id, notes
       ) VALUES (
         $1,$2,$3,$4,$5,$6,
         $7,$8,$9,
         $10,$11,$12,$13,$14,
         $15,$16,$17,
         $18,$19
       )
       RETURNING *`,
      [
        invoice_number, fiscal_year, user.tenant_id ?? null, user.id, status, currency,
        tax.subtotal_minor, tax.tax_total_minor, tax.total_minor,
        JSON.stringify(tax.seller),
        JSON.stringify(buyer),
        JSON.stringify({
          provider: tax.provider,
          treatment: tax.treatment,
          place_of_supply: tax.place_of_supply,
          notes: tax.notes,
        }),
        tax.place_of_supply, tax.treatment,
        payment.razorpay_order_id ?? null,
        payment.razorpay_payment_id ?? null,
        payment.razorpay_subscription_id ?? null,
        expansionRequestId,
        notes ?? tax.notes ?? null,
      ]
    );
    const invoice = invRows[0];

    const lineRows = [];
    for (const [i, l] of tax.lines.entries()) {
      const { rows } = await client.query(
        `INSERT INTO invoice_line_items (
           invoice_id, line_no, description, sac_code, quantity,
           unit_price_minor, subtotal_minor, tax_rate_bps, tax_amount_minor,
           tax_breakdown, total_minor
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          invoice.id, i + 1, l.description, l.sac_code ?? null, l.quantity,
          l.unit_price_minor, l.subtotal_minor, l.tax_rate_bps, l.tax_amount_minor,
          JSON.stringify(l.tax_breakdown ?? []), l.total_minor,
        ]
      );
      lineRows.push(rows[0]);
    }

    await client.query('COMMIT');
    return { invoice, lines: lineRows, created: true };
  } catch (err) {
    await client.query('ROLLBACK');
    // Lost an idempotency race — return the winner instead of failing checkout.
    if (err.code === '23505' && payment.razorpay_payment_id) {
      const existing = await findByPaymentId(payment.razorpay_payment_id);
      if (existing) return { ...existing, created: false };
    }
    throw err;
  } finally {
    client.release();
  }
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
  if (!rows.length) return null;
  const { rows: lines } = await pool.query(
    'SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY line_no',
    [id]
  );
  return { invoice: rows[0], lines };
}

async function findByPaymentId(paymentId) {
  const { rows } = await pool.query(
    'SELECT * FROM invoices WHERE razorpay_payment_id = $1',
    [paymentId]
  );
  if (!rows.length) return null;
  const { rows: lines } = await pool.query(
    'SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY line_no',
    [rows[0].id]
  );
  return { invoice: rows[0], lines };
}

async function listForUser(userId, { limit = 20, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT id, invoice_number, status, currency, subtotal_minor, tax_total_minor,
            total_minor, tax_treatment, place_of_supply, issued_at
       FROM invoices
      WHERE user_id = $1
      ORDER BY issued_at DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  const { rows: c } = await pool.query(
    'SELECT COUNT(*)::int AS total FROM invoices WHERE user_id = $1',
    [userId]
  );
  return { rows, total: c[0].total };
}

async function listAll({ limit = 20, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT i.id, i.invoice_number, i.status, i.currency, i.subtotal_minor,
            i.tax_total_minor, i.total_minor, i.tax_treatment, i.issued_at,
            u.name AS user_name, u.email
       FROM invoices i
       JOIN users u ON u.id = i.user_id
      ORDER BY i.issued_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: c } = await pool.query('SELECT COUNT(*)::int AS total FROM invoices');
  return { rows, total: c[0].total };
}

/** Invoices are never edited. Void + reissue is the correction path. */
async function voidInvoice(id, reason) {
  const { rows } = await pool.query(
    `UPDATE invoices
        SET status = 'void',
            notes = COALESCE(notes || E'\\n', '') || $2,
            updated_at = NOW()
      WHERE id = $1 AND status <> 'void'
      RETURNING *`,
    [id, `Voided: ${reason || 'no reason given'}`]
  );
  return rows[0] ?? null;
}

module.exports = {
  issueInvoice,
  findById,
  findByPaymentId,
  listForUser,
  listAll,
  voidInvoice,
  buildBuyer,
  normalizeCountry,
};
