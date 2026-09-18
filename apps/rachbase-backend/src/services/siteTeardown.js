'use strict';

/**
 * Billing-driven teardown (go-live audit P0 #5b).
 *
 * The reconciler continuously re-asserts each tenant's DESIRED state on the site, so merely
 * flipping `services.status` in the control-plane DB does not stop a workload — the App CRD still
 * says "run". When money stops (a permanent subscription cancellation, an unsubscribe, or a tenant
 * deletion) we must change desired state on the site too, or the customer keeps running for free
 * (and a deleted tenant keeps being billed with nothing left to stop it).
 *
 * These helpers enqueue the right site operation transactionally and are BEST-EFFORT: a teardown
 * must never break the webhook ack or the delete response. On any failure they log and return
 * false; the unsubscribe path and a later reconcile sweep are the backstops.
 *
 *   - `enqueueTenantStop`     → tenant.suspend(WORKLOADS_STOPPED): stops every workload, keeps
 *                               data. Reversible via tenant.resume on re-subscribe.
 *   - `enqueueServiceTeardown`→ app.delete for one shared service (a single container cancelled).
 */

const { pool } = require('@rach/core');
const { enqueueAppDelete, enqueueTenantSuspend, enqueueTenantResume } = require('./siteApp');

// service.id → App CRD id (mirrors the deploy/delete path in projectController).
function appIdForService(serviceId) {
  return `a-svc${String(serviceId).padStart(8, '0')}`;
}

async function tenantSiteRefs(client, tenantId) {
  const { rows } = await client.query(
    'SELECT site_id, site_tenant_ref FROM tenants WHERE id = $1 FOR UPDATE', [tenantId]);
  return rows[0] || null;
}

// Run `fn(client)` inside a transaction. FULLY best-effort — even acquiring the connection is
// guarded — so a teardown can never throw into a webhook ack or a delete response.
async function inTxn(label, fn) {
  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    console.error(`[teardown] ${label}: could not acquire a DB connection:`, e.message);
    return false;
  }
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    if (out === false) { await client.query('ROLLBACK'); return false; }
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`[teardown] ${label} failed:`, e.message);
    return false;
  } finally {
    client.release();
  }
}

// Stop all of a tenant's workloads on the site (payment lapsed / unsubscribed / tenant deleted).
async function enqueueTenantStop(tenantId, reasonCode = 'billing') {
  if (tenantId == null) return false;
  return inTxn(`enqueueTenantStop(${tenantId})`, async (client) => {
    const t = await tenantSiteRefs(client, tenantId);
    if (!t?.site_tenant_ref) return false;
    await enqueueTenantSuspend(client, {
      tenantRef: t.site_tenant_ref, tenantId, siteId: t.site_id,
      mode: 'WORKLOADS_STOPPED', reasonCode,
    });
  });
}

// Resume a tenant's workloads on the site — the reverse of enqueueTenantStop, for when a
// HALTED base subscription recovers (the retried charge succeeded). Same best-effort contract.
async function enqueueTenantResumeOp(tenantId, reasonCode = 'billing_recovered') {
  if (tenantId == null) return false;
  return inTxn(`enqueueTenantResume(${tenantId})`, async (client) => {
    const t = await tenantSiteRefs(client, tenantId);
    if (!t?.site_tenant_ref) return false;
    await enqueueTenantResume(client, {
      tenantRef: t.site_tenant_ref, tenantId, siteId: t.site_id,
    });
    void reasonCode; // reason is logged by the outbox row itself
  });
}

// Tear down a single shared service's App CRD (its container subscription was cancelled).
async function enqueueServiceTeardown(tenantId, serviceId, reason = 'subscription cancelled') {
  if (tenantId == null || !serviceId) return false;
  return inTxn(`enqueueServiceTeardown(${serviceId})`, async (client) => {
    const t = await tenantSiteRefs(client, tenantId);
    if (!t?.site_tenant_ref) return false;
    await enqueueAppDelete(client, {
      tenantRef: t.site_tenant_ref, appId: appIdForService(serviceId),
      tenantId, siteId: t.site_id, reason,
    });
  });
}

module.exports = { enqueueTenantStop, enqueueTenantResumeOp, enqueueServiceTeardown, appIdForService };
