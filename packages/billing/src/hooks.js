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

// Generic per-event subscription hook (multi-listener), fired UNCONDITIONALLY for
// every subscription webhook — including subscriptions the billing package doesn't
// own a row for (e.g. RachBase's Pro `pro_subscriptions`). ctx:
//   { razorpaySubId, event: 'charged'|'halted'|'cancelled'|'completed'|'expired',
//     status, paymentId?, amountMinor?, currency? }
const subscriptionEventHandlers = [];

/** Add a listener for any subscription lifecycle event. Returns an unsubscribe fn. */
function onSubscriptionEvent(fn) {
  if (typeof fn !== 'function') return () => {};
  subscriptionEventHandlers.push(fn);
  return () => {
    const i = subscriptionEventHandlers.indexOf(fn);
    if (i >= 0) subscriptionEventHandlers.splice(i, 1);
  };
}

/**
 * Fire all subscription-event listeners. EVERY listener runs (one failure doesn't block the
 * others), but if ANY failed this THROWS afterwards — these listeners are the Pro
 * subscription state machine (halt cascades, teardown enqueues, container stops), and the
 * webhook's claim-release retry only works if the failure reaches it. The old
 * swallow-and-continue version made the webhook ack 200 with the cascade half-applied and
 * told Razorpay's retry `duplicate` — the event was dropped permanently, exempting the
 * biggest handler from the very retry mechanism built for it (audit #3, F4). Listeners must
 * be idempotent (they are — keyed on payment/subscription ids), so a full retry after a
 * partial first attempt is safe.
 */
async function fireSubscriptionEvent(ctx) {
  const failures = [];
  for (const fn of subscriptionEventHandlers) {
    try { await fn(ctx); }
    catch (err) {
      console.error(`[billing/hooks] subscription.event(${ctx?.event}) handler failed:`, err.message);
      failures.push(err);
    }
  }
  if (failures.length) {
    const e = new Error(`subscription.event(${ctx?.event}): ${failures.length} listener(s) failed — ${failures.map((f) => f.message).join('; ')}`);
    e.failures = failures;
    throw e;
  }
}

module.exports = { onSubscriptionCharged, fireSubscriptionCharged, onSubscriptionEvent, fireSubscriptionEvent };
