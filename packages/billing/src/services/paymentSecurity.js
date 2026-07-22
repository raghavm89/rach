'use strict';

/**
 * Razorpay signature verification.
 *
 * Consolidates four near-identical implementations that had drifted apart. The
 * audit found three of them wrapped in:
 *
 *     if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
 *       ...verify...
 *     }
 *     // ← fell through and provisioned when the block was skipped
 *
 * which made verification conditional on the attacker supplying the very fields
 * being verified. Omitting `razorpay_signature` skipped the check entirely and
 * went on to write an active subscription with no payment.
 *
 * Rules here:
 *   * Signature fields are REQUIRED. Absence is a failure, never a skip.
 *   * Comparison is constant-time.
 *   * The only bypass is an explicit server-side flag, which is refused
 *     outright when NODE_ENV=production.
 */

const crypto = require('crypto');

class PaymentVerificationError extends Error {
  constructor(message, code = 'signature_invalid') {
    super(message);
    this.name = 'PaymentVerificationError';
    this.code = code;
    this.status = 400;
  }
}

function timingSafeEqualHex(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so length isn't a timing oracle.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * True only when an operator has explicitly allowed unverified payments AND we
 * are not in production. Intended for local development without Razorpay keys.
 */
function unverifiedPaymentsAllowed() {
  const flag = process.env.ALLOW_UNVERIFIED_PAYMENTS === 'true';
  if (!flag) return false;

  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[payments] ALLOW_UNVERIFIED_PAYMENTS=true is set in production and is being IGNORED. ' +
      'Remove it — it would let anyone provision without paying.'
    );
    return false;
  }

  console.warn('[payments] ALLOW_UNVERIFIED_PAYMENTS=true — signature verification bypassed (non-production only)');
  return true;
}

function secret() {
  const s = process.env.RAZORPAY_KEY_SECRET;
  if (!s) throw new PaymentVerificationError('Payment gateway is not configured', 'not_configured');
  return s;
}

/**
 * Verify a one-time order payment. Razorpay signs `order_id|payment_id`.
 * @throws {PaymentVerificationError}
 */
function verifyOrderPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (unverifiedPaymentsAllowed()) return { verified: false, bypassed: true };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new PaymentVerificationError(
      'razorpay_order_id, razorpay_payment_id and razorpay_signature are all required',
      'signature_missing'
    );
  }

  const expected = crypto
    .createHmac('sha256', secret())
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (!timingSafeEqualHex(expected, razorpay_signature)) {
    throw new PaymentVerificationError('Payment signature verification failed');
  }

  return { verified: true, bypassed: false };
}

/**
 * Verify a subscription payment. Razorpay signs `payment_id|subscription_id`
 * for subscriptions — note the reversed order versus one-time orders.
 * @throws {PaymentVerificationError}
 */
function verifySubscriptionPayment({ razorpay_subscription_id, razorpay_payment_id, razorpay_signature }) {
  if (unverifiedPaymentsAllowed()) return { verified: false, bypassed: true };

  if (!razorpay_subscription_id || !razorpay_payment_id || !razorpay_signature) {
    throw new PaymentVerificationError(
      'razorpay_subscription_id, razorpay_payment_id and razorpay_signature are all required',
      'signature_missing'
    );
  }

  const expected = crypto
    .createHmac('sha256', secret())
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest('hex');

  if (!timingSafeEqualHex(expected, razorpay_signature)) {
    throw new PaymentVerificationError('Subscription payment signature verification failed');
  }

  return { verified: true, bypassed: false };
}

/**
 * Confirm with Razorpay that a payment is real, captured, and for the amount we
 * expect. The signature only proves the ids were issued together — it says
 * nothing about whether the money actually moved.
 *
 * The audit found `verifyPayment` fetching the payment and reading only
 * `.method`, so an `authorized` (uncaptured), `failed` or `refunded` payment
 * still marked the order paid.
 *
 * @param {object} rzPayment  the payment entity from razorpay.payments.fetch
 * @param {object} expected   { amount, currency, order_id }
 */
function assertPaymentMatches(rzPayment, expected) {
  if (!rzPayment || typeof rzPayment !== 'object') {
    throw new PaymentVerificationError('Could not retrieve the payment from Razorpay', 'fetch_failed');
  }

  if (rzPayment.status !== 'captured') {
    throw new PaymentVerificationError(
      `Payment is "${rzPayment.status}", not captured`,
      'not_captured'
    );
  }

  if (expected.order_id && rzPayment.order_id && rzPayment.order_id !== expected.order_id) {
    throw new PaymentVerificationError('Payment belongs to a different order', 'order_mismatch');
  }

  if (Number.isSafeInteger(expected.amount) && Number(rzPayment.amount) !== expected.amount) {
    throw new PaymentVerificationError(
      `Payment amount ${rzPayment.amount} does not match the order amount ${expected.amount}`,
      'amount_mismatch'
    );
  }

  if (expected.currency && rzPayment.currency &&
      String(rzPayment.currency).toUpperCase() !== String(expected.currency).toUpperCase()) {
    throw new PaymentVerificationError('Payment currency does not match the order', 'currency_mismatch');
  }

  return true;
}

module.exports = {
  PaymentVerificationError,
  verifyOrderPayment,
  verifySubscriptionPayment,
  assertPaymentMatches,
  unverifiedPaymentsAllowed,
  timingSafeEqualHex,
};
