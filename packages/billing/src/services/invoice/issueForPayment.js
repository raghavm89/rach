'use strict';

/**
 * Issue an invoice for a captured payment, render the PDF, and email it.
 *
 * This is the single hook every payment path should call after it has confirmed
 * a real, captured payment — `paymentController.verifyPayment`, the
 * `subscription.charged` webhook, and the expansion checkout.
 *
 * Deliberately **never throws**. An invoice is a downstream artifact of money
 * that has already moved; if PDF rendering or Brevo fails we must not fail the
 * caller and leave the customer thinking their payment didn't go through. All
 * failures are logged and returned in the result for the caller to surface or
 * retry.
 */

const { pool } = require('@rach/core');
const { sendTaxInvoiceEmail } = require('@rach/core').brevo;
const invoiceService = require('./index');
const { renderInvoicePdf, pdfFilename } = require('./pdf');

/**
 * @param {object}  opts
 * @param {number}  opts.userId
 * @param {Array}   opts.lines     [{ description, quantity, unit_price_minor }] — server-priced
 * @param {string}  opts.currency
 * @param {object}  [opts.billing] checkout billing snapshot
 * @param {object}  [opts.payment] { razorpay_order_id, razorpay_payment_id, razorpay_subscription_id }
 * @param {number}  [opts.expansionRequestId]
 * @param {boolean} [opts.sendEmail=true]
 * @returns {Promise<{ok:boolean, invoice?:object, emailed?:boolean, error?:string}>}
 */
async function issueInvoiceForPayment({
  userId,
  lines,
  currency = 'USD',
  billing = {},
  payment = {},
  expansionRequestId = null,
  sendEmail = true,
}) {
  try {
    const { rows } = await pool.query(
      `SELECT id, tenant_id, name, email, phone_number, gstin,
              account_type, business_name, billing_address
         FROM users WHERE id = $1`,
      [userId]
    );
    const user = rows[0];
    if (!user) {
      console.error(`[invoice] cannot issue: user ${userId} not found`);
      return { ok: false, error: 'user_not_found' };
    }

    const result = await invoiceService.issueInvoice({
      user, lines, currency, billing, payment, expansionRequestId, status: 'paid',
    });

    if (!result.created) {
      // Idempotent replay (webhook retry, double-clicked checkout).
      return { ok: true, invoice: result.invoice, emailed: false, duplicate: true };
    }

    console.log(`[invoice] issued ${result.invoice.invoice_number} for user ${userId}`);

    if (!sendEmail) return { ok: true, invoice: result.invoice, emailed: false };

    // PDF + email are best-effort from here on.
    try {
      const pdf = await renderInvoicePdf(result);
      const emailed = await sendTaxInvoiceEmail({
        invoice: result.invoice,
        lines: result.lines,
        pdfBuffer: pdf,
        filename: pdfFilename(result.invoice),
      });
      return { ok: true, invoice: result.invoice, emailed: Boolean(emailed) };
    } catch (mailErr) {
      console.error(`[invoice] ${result.invoice.invoice_number} issued but delivery failed:`, mailErr.message);
      // The invoice exists and is downloadable from the dashboard.
      return { ok: true, invoice: result.invoice, emailed: false, error: 'delivery_failed' };
    }
  } catch (err) {
    console.error('[invoice] issuance failed:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = issueInvoiceForPayment;
