'use strict';

/**
 * Optional fulfilment hooks.
 *
 * Billing lives in a shared package and must not import an app's fulfilment code
 * (VM provisioning, order-notification emails). Instead the host app registers a
 * handler at startup and the Razorpay webhook fires it when money moves, so a
 * subscription is fulfilled even when the synchronous activation call never
 * runs (browser closed after payment, network dropped mid-request).
 *
 * The handler MUST be idempotent — the webhook and the synchronous activate
 * handler can both fire for the same first charge.
 */

let subscriptionChargedHandler = null;

/** Register the host app's fulfilment handler. Pass null to clear. */
function onSubscriptionCharged(fn) {
  subscriptionChargedHandler = typeof fn === 'function' ? fn : null;
}

/** Invoke the handler if registered. Never throws — fulfilment is best-effort. */
async function fireSubscriptionCharged(ctx) {
  if (!subscriptionChargedHandler) return;
  try {
    await subscriptionChargedHandler(ctx);
  } catch (err) {
    console.error('[billing/hooks] subscription.charged handler failed:', err.message);
  }
}

module.exports = { onSubscriptionCharged, fireSubscriptionCharged };
