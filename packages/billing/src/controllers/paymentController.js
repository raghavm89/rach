/**
 * Payment reads + the Razorpay webhook.
 *
 * Purchasing lives in services/purchase.js — see routes/payments.js for why the
 * subscribe/order/verify handlers that used to be here were removed.
 *
 * The webhook is the single lifecycle driver for every subscription, whichever
 * surface created it. It also fans state changes out to the fulfilment records
 * in vm_expansion_requests, which previously had no writer after activation.
 */

const crypto = require('crypto');
const razorpay = require('../services/razorpay');
const Order = require('../models/order');
const Subscription = require('../models/subscription');
const Payment = require('../models/payment');
const WebhookEvent = require('@rach/core').WebhookEvent;
const asyncHandler = require('@rach/core').asyncHandler;
const { paginated } = require('@rach/core').paginate;
const issueInvoiceForPayment = require('../services/invoice/issueForPayment');
const { syncFulfilmentForSubscription, fulfilCreditPaymentCaptured } = require('../services/purchase');
const hooks = require('../hooks');

// ─── Subscriptions (read + cancel) ───────────────────────────────────────────

// GET /api/payments/subscriptions  — caller sees own; admin sees all
async function listSubscriptions(req, res) {
  const { rows, total } =
    req.user.role === 'admin'
      ? await Subscription.findAll(req.pagination)
      : await Subscription.findByUser(req.user.id, req.pagination);
  return res.json(paginated(rows, total, req.pagination));
}

// GET /api/payments/subscriptions/:id
async function getSubscription(req, res) {
  const sub = await Subscription.findById(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  if (req.user.role !== 'admin' && sub.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json(sub);
}

// POST /api/payments/subscriptions/:id/cancel  — customer (own) or admin
async function cancelSubscription(req, res) {
  const sub = await Subscription.findById(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  if (req.user.role !== 'admin' && sub.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await razorpay.subscriptions.cancel(sub.razorpay_sub_id);
  const updated = await Subscription.updateStatus(sub.razorpay_sub_id, 'cancelled');

  return res.json({ message: 'Subscription cancelled', subscription: updated });
}


// ─── Orders (read) ───────────────────────────────────────────────────────────

// GET /api/payments/orders  — caller sees own; admin sees all
async function listOrders(req, res) {
  const { rows, total } =
    req.user.role === 'admin'
      ? await Order.findAll(req.pagination)
      : await Order.findByUser(req.user.id, req.pagination);
  return res.json(paginated(rows, total, req.pagination));
}

// GET /api/payments/orders/:id
async function getOrder(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json(order);
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

// POST /api/payments/webhook  — public, called by Razorpay
async function webhook(req, res) {
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing webhook signature' });
  }
  if (!Buffer.isBuffer(req.rawBody)) {
    return res.status(400).json({ error: 'Malformed webhook body' });
  }

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  let expectedBuf, sigBuf;
  try {
    expectedBuf = Buffer.from(expected, 'hex');
    sigBuf = Buffer.from(signature, 'hex');
  } catch {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }
  if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Malformed webhook body' });
  }
  const { event, payload } = req.body;

  // Razorpay retries on non-2xx — de-dupe by signature (unique per event).
  const fresh = await WebhookEvent.claim(signature, event);
  if (!fresh) {
    return res.json({ received: true, duplicate: true });
  }

  switch (event) {
    case 'subscription.activated':
    case 'subscription.authenticated': {
      const sub = payload.subscription.entity;
      const currentEnd = sub.current_end ? new Date(sub.current_end * 1000) : null;

      await Subscription.updateStatus(sub.id, sub.status, {
        current_start: sub.current_start ? new Date(sub.current_start * 1000) : null,
        current_end:   currentEnd,
      });

      // Fan out to the fulfilment record. Before consolidation nothing ever
      // updated vm_expansion_requests.subscription_status after activation.
      await syncFulfilmentForSubscription(sub.id, {
        status: sub.status,
        nextChargeAt: currentEnd,
      });
      break;
    }

    case 'subscription.charged': {
      const sub = payload.subscription.entity;
      const pmt = payload.payment.entity;
      const currentEnd = sub.current_end ? new Date(sub.current_end * 1000) : null;

      await Subscription.updateStatus(sub.id, 'active', {
        current_start: sub.current_start ? new Date(sub.current_start * 1000) : null,
        current_end:   currentEnd,
        paid_count:    sub.paid_count,
      });

      // Keeps the fulfilment record's status and next_charge_at current.
      // `next_charge_at` previously had no writer at all.
      await syncFulfilmentForSubscription(sub.id, { status: 'active', nextChargeAt: currentEnd });

      const dbSub = await Subscription.findByRazorpayId(sub.id);
      if (dbSub) {
        // Each billing cycle produces a Razorpay order — track it so the user
        // can see the full order history linked to their subscription.
        let order = await Order.findByRazorpayId(pmt.order_id);
        if (!order) {
          order = await Order.create({
            user_id:        dbSub.user_id,
            subscription_id: dbSub.id,
            razorpay_order_id: pmt.order_id,
            amount:   pmt.amount,
            currency: pmt.currency,
            description: 'Monthly subscription billing cycle',
          });
        }
        await Order.updateStatus(pmt.order_id, 'paid');

        const existingPmt = await Payment.findByOrderId(pmt.order_id);
        if (!existingPmt) {
          await Payment.create({
            user_id:          dbSub.user_id,
            order_id:         order.id,
            subscription_id:  dbSub.id,
            razorpay_order_id: pmt.order_id,
            amount:   pmt.amount,
            currency: pmt.currency,
            description: 'Monthly subscription billing cycle',
          });
        }
        await Payment.capture(pmt.order_id, pmt.id, pmt.method);

        // Each billing cycle gets its own invoice. Keyed on the payment id, so
        // Razorpay's webhook retries can't produce duplicates.
        //
        // Prefer the billing snapshot captured at activation: pre-tax line
        // inputs + the buyer's jurisdiction, so the tax engine reproduces the
        // GST breakdown and place of supply and the invoice reconciles to the
        // charge. Older subscriptions with no snapshot fall back to the legacy
        // single tax-inclusive line.
        const snap = parseJson(dbSub.billing_json);
        const invoicePayload = (snap && Array.isArray(snap.lines) && snap.lines.length)
          ? {
              userId  : dbSub.user_id,
              currency: snap.currency || pmt.currency,
              lines   : snap.lines,
              billing : snap.billing || {},
            }
          : {
              userId  : dbSub.user_id,
              currency: pmt.currency,
              lines   : [{
                description     : 'Monthly subscription billing cycle',
                quantity        : 1,
                unit_price_minor: Number(pmt.amount),
              }],
            };

        await issueInvoiceForPayment({
          ...invoicePayload,
          payment: {
            razorpay_order_id       : pmt.order_id,
            razorpay_payment_id     : pmt.id,
            razorpay_subscription_id: sub.id,
          },
        });

        // Fulfilment (VM provisioning + order-notification email) lives in the
        // host app. Fire its idempotent handler so a subscription is fulfilled
        // even when the synchronous activation call never ran. Safe on renewals:
        // the handler no-ops once a fulfilment record exists.
        await hooks.fireSubscriptionCharged({
          razorpaySubId: sub.id,
          paymentId:     pmt.id,
          amountMinor:   Number(pmt.amount),
          currency:      pmt.currency,
        });
      }
      break;
    }

    case 'subscription.halted':
    case 'subscription.cancelled':
    case 'subscription.completed':
    case 'subscription.expired': {
      const sub = payload.subscription.entity;
      await Subscription.updateStatus(sub.id, sub.status);

      // The reason a customer whose card failed on renewal used to keep
      // reading 'active' in Rachbase indefinitely.
      await syncFulfilmentForSubscription(sub.id, { status: sub.status });
      break;
    }

    case 'payment.captured': {
      // Backstop for one-time AGENT-CREDIT purchases whose synchronous /verify
      // never ran (tab closed mid-checkout). No-ops for subscription/other
      // payments — it only acts on orders with notes.kind === 'agent_credits',
      // and every write is idempotent (safe alongside /verify and webhook retries).
      const pmt = payload.payment && payload.payment.entity;
      if (pmt) await fulfilCreditPaymentCaptured(pmt);
      break;
    }

    case 'payment.failed': {
      const pmt = payload.payment.entity;
      // `paid` is terminal — Order.updateStatus refuses to regress a paid order.
      await Order.updateStatus(pmt.order_id, 'attempted');
      // If a payment row already exists (e.g. from a subscription cycle), mark it failed too.
      await Payment.fail(pmt.order_id);
      break;
    }

    default:
      break;
  }

  return res.json({ received: true });
}

// jsonb columns arrive already parsed from pg, but tolerate a string too.
function parseJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}

// ─── Payment history ──────────────────────────────────────────────────────────

// GET /api/payments/history  — caller sees own; admin sees all
async function paymentHistory(req, res) {
  const { rows, total } =
    req.user.role === 'admin'
      ? await Payment.findAll(req.pagination)
      : await Payment.findByUser(req.user.id, req.pagination);
  return res.json(paginated(rows, total, req.pagination));
}

// `subscribe`, `createOrder` and `verifyPayment` were removed here — they were
// a second implementation of purchasing that nothing called. Money now moves
// through services/purchase.js. See routes/payments.js for the full rationale.
module.exports = {
  listSubscriptions:  asyncHandler(listSubscriptions),
  getSubscription:    asyncHandler(getSubscription),
  cancelSubscription: asyncHandler(cancelSubscription),
  listOrders:         asyncHandler(listOrders),
  getOrder:           asyncHandler(getOrder),
  paymentHistory:     asyncHandler(paymentHistory),
  webhook:            asyncHandler(webhook),
};
