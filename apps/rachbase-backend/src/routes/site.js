'use strict';

/**
 * BFF site routes (SpaceArk integration). All authenticated; the site integration
 * is Pro-only and gated by the `pro_tier` flag inside the controller.
 */

const { Router } = require('express');
const { authenticate, authorize } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/siteController');

const router = Router();
router.use(authenticate);

// Reconcile a tenant to its SpaceArk site (async; returns 202 + operation).
router.post('/tenants/:tenantId/reconcile',
  authorize('admin', 'tenant_admin'), parseId('tenantId'), asyncHandler(ctrl.reconcileTenant));

// Suspend / resume a tenant (§9.10 — blocks mutations; mode drives routing/runtime).
router.post('/tenants/:tenantId/suspend',
  authorize('admin', 'tenant_admin'), parseId('tenantId'), asyncHandler(ctrl.suspendTenant));
router.post('/tenants/:tenantId/resume',
  authorize('admin', 'tenant_admin'), parseId('tenantId'), asyncHandler(ctrl.resumeTenant));

// App upsert + release (async; 202). Tenant must be placed on a site first.
router.put('/tenants/:tenantId/apps/:appId',
  authorize('admin', 'tenant_admin'), parseId('tenantId'), asyncHandler(ctrl.upsertApp));
router.post('/tenants/:tenantId/apps/:appId/releases',
  authorize('admin', 'tenant_admin'), parseId('tenantId'), asyncHandler(ctrl.createRelease));
// In-house build from the service's GitHub repo (pins an exact commit; records history).
router.post('/tenants/:tenantId/apps/:appId/deploy-repo',
  authorize('admin', 'tenant_admin'), parseId('tenantId'), asyncHandler(ctrl.deployRepo));

// Tenant's approved registry images (for the "Browse registry" picker).
router.get('/tenants/:tenantId/registry/images',
  authorize('admin', 'tenant_admin'), parseId('tenantId'), asyncHandler(ctrl.listRegistryImages));

// Site registry admin (platform-level multi-site config; admin role only). Replaces the
// old global SITE_API_URL — register which site-controllers the BFF can address.
router.get('/sites', authorize('admin'), asyncHandler(ctrl.listSites));
router.put('/sites/:siteId', authorize('admin'), asyncHandler(ctrl.upsertSite));
router.post('/sites/:siteId/disable', authorize('admin'), asyncHandler(ctrl.disableSite));

// Normalized operation status.
router.get('/operations/:operationId', asyncHandler(ctrl.getOperationStatus));

// No-side-effect quotes for the checkout page (amount + currency, for tax preview).
router.get('/pro/quote', authorize('admin', 'tenant_admin'), asyncHandler(ctrl.proBaseQuote));
router.get('/tenants/:tenantId/deploy-quote',
  authorize('admin', 'tenant_admin'), parseId('tenantId'), asyncHandler(ctrl.deployQuote));

// Subscribe to Pro (create the $15/mo base) → verify → tenant plan flips to 'pro'.
router.post('/pro/subscribe', authorize('admin', 'tenant_admin'), asyncHandler(ctrl.subscribePro));
router.post('/pro/verify',    authorize('admin', 'tenant_admin'), asyncHandler(ctrl.verifyProSubscription));

// Cancel Pro: stop all shared containers + cancel active subscriptions for the tenant.
router.post('/unsubscribe', authorize('admin', 'tenant_admin'), asyncHandler(ctrl.unsubscribePro));

module.exports = router;
