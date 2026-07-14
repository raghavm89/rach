'use strict';

/**
 * Service-unit billing helpers.
 *
 * A Service Unit is the atom of RachBase compute: 0.5 vCPU / 0.5 GB RAM / 0.5 GB disk
 * for $15/month. Buying the first unit brings a draft service online; buying more
 * (Step 4, "Add power") scales it live. Both flows go through this module.
 *
 * Isolated from the controller so tests can stub `createUnitOrder` without touching
 * the Razorpay SDK, while `verifyPayment` stays pure (HMAC) and fully testable.
 */

const crypto = require('crypto');
const { razorpay } = require('@rach/billing');

const UNIT_PRICE_CENTS = parseInt(process.env.SERVICE_UNIT_PRICE_CENTS || '1500', 10); // $15
const UNIT_CURRENCY = process.env.SERVICE_UNIT_CURRENCY || 'USD';

// Create a Razorpay order for one Service Unit. Overridable in tests.
async function createUnitOrder({ tenantId, serviceId }) {
  const receipt = `unit_${serviceId}_${Date.now()}`;
  return razorpay.orders.create({
    amount: UNIT_PRICE_CENTS,
    currency: UNIT_CURRENCY,
    receipt,
    notes: { kind: 'service_unit', tenant_id: String(tenantId), service_id: String(serviceId) },
  });
}

// Verify a Razorpay checkout callback signature. Pure — same scheme as paymentController.
function verifyPayment({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  // constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { createUnitOrder, verifyPayment, UNIT_PRICE_CENTS, UNIT_CURRENCY };
