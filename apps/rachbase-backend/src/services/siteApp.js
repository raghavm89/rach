'use strict';

/**
 * App + Release mapping adapters (contract §5.2/§7). Authorized product aggregate →
 * the exact site DTO, committed to the outbox in the caller's transaction.
 */

const { newOperationId, appPutDTO, appRoute, releasePostDTO, releaseRoute, appDeleteDTO,
  tenantSuspendRoute, tenantResumeRoute, tenantSuspendDTO, tenantResumeDTO } = require('@rach/site-contracts');
const outbox = require('./siteOutbox');
const client = require('./siteClient');

async function enqueueAppUpsert(txClient, { tenantRef, appId, tenantId = null, siteId, image = null, runtime = null, port = 8080, resources = {}, owner = null, env = null, command = null, host = null, generation = 1 }) {
  const operationId = newOperationId();
  const route = appRoute(tenantRef, appId);
  // Resources come from the service's PAID compute size (server-side authority), so a
  // container can't request more CPU/RAM than was paid for. Empty → appPutDTO defaults (nano).
  // `env`/`command` are the user's runtime inputs (command null → image default runs).
  // `host` = the app's public hostname (default <slug>.rachbase.app or a user custom domain).
  const body = appPutDTO({ operationId, image, runtime, port, owner, env, command, host, ...resources });
  const delivery = client.buildDelivery({ operationId, method: 'PUT', route, tenantId: tenantRef, body });
  await outbox.enqueue(txClient, { operationId, tenantId, siteId, opType: 'app.upsert', resourceType: 'app', resourceId: appId, generation, delivery });
  return { operationId, siteId, resourceId: appId, state: 'ACCEPTED', statusUrl: `/v1/operations/${operationId}` };
}

async function enqueueRelease(txClient, { tenantRef, appId, tenantId = null, siteId, deploymentId, source = null, image = null, externalImage = null, applicationGeneration = 1 }) {
  const operationId = newOperationId();
  const route = releaseRoute(tenantRef, appId);
  const body = releasePostDTO({ operationId, deploymentId, applicationGeneration, source, image, externalImage });
  const delivery = client.buildDelivery({ operationId, method: 'POST', route, tenantId: tenantRef, body });
  await outbox.enqueue(txClient, { operationId, tenantId, siteId, opType: 'release.create', resourceType: 'release', resourceId: deploymentId || appId, generation: applicationGeneration, delivery });
  return { operationId, siteId, resourceId: appId, state: 'ACCEPTED', statusUrl: `/v1/operations/${operationId}` };
}

// Decommission an app on the site (DELETE /v1/tenants/{t}/apps/{a}). Enqueued in the
// caller's transaction; the site tears down the workload and reports the operation.
async function enqueueAppDelete(txClient, { tenantRef, appId, tenantId = null, siteId, reason = null, generation = 1 }) {
  const operationId = newOperationId();
  const route = appRoute(tenantRef, appId);
  const body = appDeleteDTO({ operationId, reason });
  const delivery = client.buildDelivery({ operationId, method: 'DELETE', route, tenantId: tenantRef, body });
  await outbox.enqueue(txClient, { operationId, tenantId, siteId, opType: 'app.delete', resourceType: 'app', resourceId: appId, generation, delivery });
  return { operationId, siteId, resourceId: appId, state: 'ACCEPTED', statusUrl: `/v1/operations/${operationId}` };
}

// Suspend a tenant on the site (POST /v1/tenants/{t}:suspend). Stops mutations; the mode
// drives routing/runtime. Never deletes data.
async function enqueueTenantSuspend(txClient, { tenantRef, tenantId = null, siteId, mode, reasonCode = null, generation = 1 }) {
  const operationId = newOperationId();
  const route = tenantSuspendRoute(tenantRef);
  const body = tenantSuspendDTO({ operationId, generation, mode, reasonCode });
  const delivery = client.buildDelivery({ operationId, method: 'POST', route, tenantId: tenantRef, body });
  await outbox.enqueue(txClient, { operationId, tenantId, siteId, opType: 'tenant.suspend', resourceType: 'tenant', resourceId: tenantRef, generation, delivery });
  return { operationId, siteId, resourceId: tenantRef, state: 'ACCEPTED', statusUrl: `/v1/operations/${operationId}` };
}

// Resume a suspended tenant (POST /v1/tenants/{t}:resume). Rebuilds runtime from retained state.
async function enqueueTenantResume(txClient, { tenantRef, tenantId = null, siteId, generation = 1 }) {
  const operationId = newOperationId();
  const route = tenantResumeRoute(tenantRef);
  const body = tenantResumeDTO({ operationId, generation });
  const delivery = client.buildDelivery({ operationId, method: 'POST', route, tenantId: tenantRef, body });
  await outbox.enqueue(txClient, { operationId, tenantId, siteId, opType: 'tenant.resume', resourceType: 'tenant', resourceId: tenantRef, generation, delivery });
  return { operationId, siteId, resourceId: tenantRef, state: 'ACCEPTED', statusUrl: `/v1/operations/${operationId}` };
}

module.exports = { enqueueAppUpsert, enqueueRelease, enqueueAppDelete, enqueueTenantSuspend, enqueueTenantResume };
