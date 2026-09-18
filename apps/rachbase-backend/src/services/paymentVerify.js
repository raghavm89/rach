'use strict';

/**
 * Captured-amount verification for one-time Razorpay orders (go-live audit P0 #4).
 *
 * The Razorpay signature only proves that (order_id, payment_id) were issued together — it says
 * nothing about how much money moved or whether it was captured. Several verify handlers checked
 * only the signature and then provisioned, so an attacker could pay for the cheapest order and
 * replay that (order, payment, signature) triple against an expensive package/cart, having the
 * expensive thing fulfilled while paying the cheap amount.
 *
 * `assertOrderPaid` closes that: it verifies the signature with the REAL gateway secret (a missing
 * secret is a hard failure, never an empty-key match), fetches the payment from Razorpay, and
 * asserts it is captured, belongs to this order, and is for the amount we expect. When the caller
 * knows the price it must equal (packages/custom carts), it passes `expectedAmount`; otherwise the
 * authoritative amount is read from the Razorpay order we created (resize flows, where the order id
 * is already bound to our own record).
 *
 * Throws `PaymentVerificationError` (status 400) on any failure — the same type the existing
 * signature check already throws, so callers' error handling is unchanged.
 */

const billing = require('@rach/billing');
const { verifyOrderPayment, assertPaymentMatches, PaymentVerificationError } = billing.paymentSecurity;

/**
 * @param {object}  opts
 * @param {string}  opts.razorpay_order_id
 * @param {string}  opts.razorpay_payment_id
 * @param {string}  opts.razorpay_signature
 * @param {number}  [opts.expectedAmount]    minor units the buyer MUST have paid (server price).
 * @param {string}  [opts.expectedCurrency]  required when expectedAmount is given.
 * @returns {Promise<{verified:boolean, bypassed?:boolean, amount?:number, currency?:string}>}
 */
async function assertOrderPaid({ razorpay_order_id, razorpay_payment_id, razorpay_signature, expectedAmount, expectedCurrency }, deps = {}) {
  const razorpay = deps.razorpay || billing.razorpay;

  // 1) Signature (unconditional, real secret). Dev bypass returns { bypassed:true } and only
  //    outside production — in which case there is no real payment to confirm.
  const sig = verifyOrderPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  if (sig.bypassed) return { verified: false, bypassed: true };

  // 2) Determine the amount the payment must match.
  let amount = expectedAmount;
  let currency = expectedCurrency;
  if (!Number.isSafeInteger(amount)) {
    // No caller-supplied price → trust the order we created (its id is already bound to our record).
    let rzOrder;
    try { rzOrder = await razorpay.orders.fetch(razorpay_order_id); }
    catch (e) { throw new PaymentVerificationError(`Could not retrieve the order from Razorpay: ${e.message}`, 'order_fetch_failed'); }
    amount = Number(rzOrder.amount);
    currency = rzOrder.currency;
  }

  // 3) Confirm the payment is real, captured, for this order, and for that amount.
  let rzPayment;
  try { rzPayment = await razorpay.payments.fetch(razorpay_payment_id); }
  catch (e) { throw new PaymentVerificationError(`Could not retrieve the payment from Razorpay: ${e.message}`, 'fetch_failed'); }

  assertPaymentMatches(rzPayment, { amount, currency, order_id: razorpay_order_id });
  return { verified: true, amount, currency };
}

module.exports = { assertOrderPaid };
