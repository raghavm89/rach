'use strict';

/**
 * Payment routes.
 *
 * ── What was removed and why ────────────────────────────────────────────────
 *
 * This router used to carry a second, complete billing implementation:
 * `POST /subscribe`, `POST /orders` and `POST /verify`. Nothing called them —
 * the web app has always used `/api/expansion` — and they were unreachable
 * anyway, because they were guarded with `authorize('customer', 'admin')` and
 * `customer` is the legacy role replaced by `tenant_user` in migration 007.
 *
 * Keeping two ways to take money meant every fix had to be applied twice, and
 * the two data models diverged badly enough that the webhook below could not
 * see subscriptions created by the other one.
 *
 * Money now moves through one place: `packages/billing/src/services/purchase.js`,
 * which `/api/expansion` delegates to. What remains here:
 *
 *   * the Razorpay webhook — the only lifecycle driver for every subscription,
 *     regardless of which surface created it;
 *   * read-only history endpoints, kept because they are the admin view over
 *     orders/subscriptions/payments and are not duplicated elsewhere.
 *
 * If a public billing API is wanted later, add it as a thin surface over the
 * purchase service — do not reintroduce a parallel implementation.
 */

const { Router } = require('express');
const authenticate = require('@rach/identity').authenticate;
const parseId = require('@rach/core').parseId;
const { paginate } = require('@rach/core').paginate;
const {
  listSubscriptions,
  getSubscription,
  cancelSubscription,
  listOrders,
  getOrder,
  paymentHistory,
  webhook,
} = require('../controllers/paymentController');

const router = Router();

// ── Webhook (no auth — Razorpay calls this directly) ─────────────────────────
// Signature-verified against RAZORPAY_WEBHOOK_SECRET over the raw body.
router.post('/webhook', webhook);

// ── All routes below require JWT ──────────────────────────────────────────────
router.use(authenticate);

// ── Read-only history ─────────────────────────────────────────────────────────
// Each scopes to the caller unless they are an admin.
router.get('/subscriptions',     paginate(), listSubscriptions);
router.get('/subscriptions/:id', parseId(),  getSubscription);
router.get('/orders',            paginate(), listOrders);
router.get('/orders/:id',        parseId(),  getOrder);
router.get('/history',           paginate(), paymentHistory);

// Cancellation is a lifecycle action rather than a purchase, so it stays.
router.post('/subscriptions/:id/cancel', parseId(), cancelSubscription);

module.exports = router;
