'use strict';

/**
 * Tenant mapping adapter (contract §5.2): authorized product tenant → the exact
 * `PUT /v1/tenants/{id}` DTO, committed to the outbox. One compiled function per
 * site operation; no generic site-request method reachable from a route handler.
 */

const crypto = require('crypto');
const { newOperationId, tenantPutDTO, tenantRoute } = require('@rach/site-contracts');
const outbox = require('./siteOutbox');
const client = require('./siteClient');

// A stable SpaceArk tenant ref (matches ^t-[a-z0-9]{8,32}$). Generated once per
// tenant on first placement and persisted, so reconciles stay idempotent.
const newTenantRef = () => `t-${crypto.randomBytes(8).toString('hex')}`;

// Product tier → SpaceArk plan. Shared tiers (starter/pro) and the unset default land on
// SpaceArk sites as 'pro'; only the 'max' sentinel (dedicated/à-la-carte) maps to 'enterprise'.
const productToSitePlan = (plan) => (plan === 'max' ? 'enterprise' : 'pro');

/**
 * Enqueue a tenant reconcile to the site. Runs inside the caller's transaction so
 * product state + operation + outbox commit atomically. Returns the 202 envelope.
 * @param tenantRef SpaceArk tenant ref (t-...); @param tenantId internal tenants.id
 */
async function enqueueTenantReconcile(txClient, { tenantRef, tenantId = null, siteId, customerRef, plan, generation = 1 }) {
  const operationId = newOperationId();
  const route = tenantRoute(tenantRef);
  const body = tenantPutDTO({ operationId, customerRef, plan, generation });
  const delivery = client.buildDelivery({ operationId, method: 'PUT', route, tenantId: tenantRef, body });

  await outbox.enqueue(txClient, {
    operationId, tenantId, siteId,
    opType: 'tenant.reconcile', resourceType: 'tenant', resourceId: tenantRef,
    generation, delivery,
  });

  return { operationId, siteId, resourceId: tenantRef, state: 'ACCEPTED', statusUrl: `/v1/operations/${operationId}` };
}

module.exports = { enqueueTenantReconcile, newTenantRef, productToSitePlan };
