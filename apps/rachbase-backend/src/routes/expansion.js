'use strict';

const { Router }   = require('express');
const authenticate = require('@rach/identity').authenticate;
const authorize    = require('@rach/identity').authorize;
const parseId      = require('@rach/core').parseId;
const {
  listPackages,
  createPackage,
  updatePackage,
  createExpansionOrder,
  verifyExpansionPayment,
  listExpansionRequests,
  fulfilRequest,
  cancelRequest,
  myExpansionRequests,
  createCustomOrder,
  verifyCustomPayment,
  createSubscriptionOrder,
  activateSubscription,
  cancelMySubscription,
  hasObservability,
  listObsAssignments,
  getObsQuota,
  assignObs,
  unassignObs,
} = require('../controllers/expansionController');

const router = Router();

router.use(authenticate);

// ── Observability entitlement check ──────────────────────────────────────────
router.get('/has-observability',           hasObservability);              // any authed user

// ── Per-VM Observability Assignment (admin only) ──────────────────────────────
router.get('/observability/assignments',   authorize('admin'), listObsAssignments);
router.get('/observability/quota',         authorize('admin'), getObsQuota);
router.post('/observability/assign',       authorize('admin'), assignObs);
router.delete('/observability/assign',     authorize('admin'), unassignObs);

// ── VM Packages ───────────────────────────────────────────────────────────────
router.get('/packages',        listPackages);                              // all authed
router.post('/packages',       authorize('admin'), createPackage);
router.patch('/packages/:id',  authorize('admin'), parseId(), updatePackage);

// ── Expansion orders + payment ────────────────────────────────────────────────
router.post('/orders',  authorize('tenant_admin', 'tenant_user'), createExpansionOrder);
router.post('/verify',  authorize('tenant_admin', 'tenant_user'), verifyExpansionPayment);

// ── Custom line-item orders ───────────────────────────────────────────────────
router.post('/custom/orders', authorize('tenant_admin', 'tenant_user'), createCustomOrder);
router.post('/custom/verify', authorize('tenant_admin', 'tenant_user'), verifyCustomPayment);

// ── Subscription orders ───────────────────────────────────────────────────────
router.post('/subscriptions',          authorize('tenant_admin', 'tenant_user'), createSubscriptionOrder);
router.post('/subscriptions/activate', authorize('tenant_admin', 'tenant_user'), activateSubscription);

// ── Expansion requests ────────────────────────────────────────────────────────
router.get('/requests/my',                authorize('tenant_admin', 'tenant_user'), myExpansionRequests);
router.patch('/requests/:id/cancel-my',   authorize('tenant_admin', 'tenant_user'), parseId(), cancelMySubscription);
router.get('/requests',                   authorize('admin'),         listExpansionRequests);
router.patch('/requests/:id/fulfil',      authorize('admin'), parseId(), fulfilRequest);
router.patch('/requests/:id/cancel',      authorize('admin'), parseId(), cancelRequest);

module.exports = router;
