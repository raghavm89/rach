'use strict';

/**
 * BaaS backend compute-resize billing — the pay-first money path for bumping a project's
 * backend (gateway + services + rest) from nano → micro → small.
 *
 * Unlike a regular Pro *service* (which is one billable container with its own recurring
 * subscription), the BaaS backend is a fixed bundle of N containers included in the plan.
 * Resizing it charges a ONE-TIME delta = (perContainerDelta(to) − perContainerDelta(from))
 * × containers, collected up front; the size is applied only after the payment verifies.
 *
 * The delta amount is computed here from the pricing authority (`@rach/billing`) — the
 * client never sends a price. Currency + signature verification reuse `containerBilling`
 * so there is exactly one HMAC scheme across the money paths.
 */

const { razorpay, proPricing } = require('@rach/billing');
const containerBilling = require('./containerBilling');

// One-time upgrade delta (minor units) for moving the whole bundle from `fromSize` to
// `toSize`. Negative or zero when the target is the same or cheaper (a downsize is free).
function resizeDeltaCents({ fromSize, toSize, containers, currency = 'USD' }) {
  const from = proPricing.computeDeltaCents(fromSize, currency);
  const to = proPricing.computeDeltaCents(toSize, currency);
  return (to - from) * containers;
}

// Create a Razorpay order for a backend resize's one-time delta charge. Amount computed
// server-side; caller must have already confirmed amountCents > 0.
async function createResizeOrder({ tenantId, projectId, amountCents, currency }) {
  return razorpay.orders.create({
    amount: amountCents,
    currency,
    receipt: `baas_${projectId}_${Date.now()}`,
    notes: { kind: 'baas_resize', tenant_id: String(tenantId), project_id: String(projectId) },
  });
}

module.exports = {
  resizeDeltaCents,
  createResizeOrder,
  // reuse the shared implementations so there's a single scheme
  verifyPayment: containerBilling.verifyPayment,
  billingCurrencyFor: containerBilling.billingCurrencyFor,
};
