'use strict';

/**
 * Status-poll worker (site → product status sync). For each in-flight operation it
 * reads the site's normalized status (GET /v1/operations/:id), writes state + url
 * back onto the BFF `site_operations` row, and reflects app operations onto the
 * product `services.status` so the dashboard shows Online/Deploying/Crashed.
 *
 * Read-only against the site; idempotent; safe to run alongside the outbox worker.
 * Deps (`fetch`, `reflect`) are injected so the loop is unit-testable without a site.
 */

const { pool } = require('@rach/core');
const outbox = require('./siteOutbox');
const client = require('./siteClient');
const { Deployment } = require('../models/project');

// Contract operation states (§4.3). Anything else is treated as still-reconciling.
const CONTRACT_STATES = new Set(['ACCEPTED', 'RECONCILING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED', 'DELETED']);
const normalizeState = (s) => (CONTRACT_STATES.has(s) ? s : 'RECONCILING');

// Operation state → product service.status (services.status enum, migration 024).
const SERVICE_STATUS = {
  ACCEPTED: 'deploying',
  RECONCILING: 'deploying',
  SUCCEEDED: 'online',
  FAILED: 'crashed',
  CANCELLED: 'stopped',
  BLOCKED: 'crashed',
  DELETED: 'stopped',   // app torn down on the site → not online anymore
};

// The dashboard names apps `a-svc<serviceId>` (zero-padded). Recover the service id.
function serviceIdFromAppId(appId) {
  const m = /^a-svc0*(\d+)$/.exec(String(appId || ''));
  return m ? Number(m[1]) : null;
}

// A TERMINAL op state → the deploy-history status. Non-terminal states return null (leave
// history alone). Pure. Prevents a deploy row showing "success" when the apply actually failed.
const DEPLOYMENT_STATUS = { SUCCEEDED: 'success', FAILED: 'failed', BLOCKED: 'failed' };
const deploymentStatusFor = (opState) => DEPLOYMENT_STATUS[opState] || null;

// Reflect an app operation onto the product service row (best-effort; no-op if the app id
// isn't a service-backed one or the row is gone). Deploy-history is reflected separately,
// keyed by operation_id (see Deployment.setStatusByOperation), so concurrent deploys resolve
// to the RIGHT row instead of guessing "latest".
async function reflectToService(op) {
  if (op.resource?.type !== 'app') return;
  const serviceId = serviceIdFromAppId(op.resource.id);
  if (!serviceId) return;
  const status = SERVICE_STATUS[op.state];
  if (!status) return;
  await pool.query('UPDATE services SET status = $2, updated_at = NOW() WHERE id = $1', [serviceId, status]);
}

// Crash a service ONLY when the failing op is its CURRENT app op (not one superseded by a
// newer deploy) and it's presently online/deploying. Fixes a new app that was optimistically
// marked online at "bring online" but whose first deploy actually failed.
async function crashServiceIfLatest(appId, operationId) {
  const serviceId = serviceIdFromAppId(appId);
  if (!serviceId) return false;
  const { rowCount } = await pool.query(
    `UPDATE services SET status = 'crashed', updated_at = NOW()
       WHERE id = $1 AND status IN ('online', 'deploying')
         AND $2 = (SELECT operation_id FROM site_operations
                     WHERE resource_type = 'app' AND resource_id = $3
                     ORDER BY updated_at DESC LIMIT 1)`,
    [serviceId, operationId, appId],
  );
  return rowCount > 0;
}

// Refresh one operation from the site. Returns 'updated' | 'unchanged' | 'skipped'.
// `setState`/`reflect` are injectable so this is unit-testable without a DB.
// Grace before we give up on an op the site 404s: a freshly-created op can briefly 404
// before its CRD is visible, so only terminalize once it's older than this.
const STALE_MS = Number(process.env.SITE_OP_STALE_MS) || 60_000;

async function refreshOne(row, { fetch, reflect = reflectToService, setState = outbox.setOperationState, reflectDeployment = Deployment.setStatusByOperation, crashIfLatest = crashServiceIfLatest }) {
  const remote = await fetch(row.operation_id, { siteId: row.site_id });
  if (remote && remote.__notFound) {
    // The site doesn't know this operationId — its CRD was superseded by a newer apply, or was
    // never created (a rejected apply). Terminalize once past the grace window. We fail THIS op's
    // own deploy row, and crash the service ONLY if this is still its current op (so a genuinely
    // failed deploy flips off "online", but a superseded-by-newer-deploy op does not).
    const ageMs = Date.now() - new Date(row.updated_at).getTime();
    if (ageMs > STALE_MS) {
      await setState(row.operation_id, 'SUPERSEDED', { reason: 'not found on site (superseded)' });
      if (row.resource_type === 'app') {
        await reflectDeployment(row.operation_id, 'failed');
        await crashIfLatest(row.resource_id, row.operation_id);
      }
      return 'updated';
    }
    return 'skipped';
  }
  if (!remote) return 'skipped'; // dry-run or not yet visible on the site
  const state = normalizeState(remote.state);
  await setState(row.operation_id, state, {
    reason: remote.reason ?? null,
    message: remote.message ?? null,
    url: remote.url ?? undefined,
  });
  await reflect({ state, resource: remote.resource || { type: row.resource_type, id: row.resource_id } });
  const dep = deploymentStatusFor(state);           // terminal outcome → this op's deploy row
  if (dep && row.resource_type === 'app') await reflectDeployment(row.operation_id, dep); // deployments are app-only
  return state === row.state ? 'unchanged' : 'updated';
}

async function pollOnce({ limit = 50, fetch = client.fetchOperation, reflect = reflectToService, setState = outbox.setOperationState } = {}) {
  const rows = await outbox.listInFlight(limit);
  let updated = 0;
  for (const row of rows) {
    try { if ((await refreshOne(row, { fetch, reflect, setState })) === 'updated') updated += 1; }
    catch (e) { console.error(`[site-status] ${row.operation_id} refresh failed:`, e.message); }
  }
  return { polled: rows.length, updated };
}

function startStatusWorker({ intervalMs = 4000, limit = 50 } = {}) {
  let stopped = false;
  (async function loop() {
    while (!stopped) {
      try { await pollOnce({ limit }); }
      catch (e) { console.error('[site-status] poll failed:', e.message); }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  })();
  return () => { stopped = true; };
}

// ── App-status drift sweep ──────────────────────────────────────────────────────
// The fast poller above only follows IN-FLIGHT ops (ACCEPTED/RECONCILING). A service
// sitting at 'online' (its op already SUCCEEDED) is never re-checked — so if its desired
// state later disappears on the site (App CR deleted/superseded), or a manual delete is
// not self-healed, the dashboard stays a stale 'online'. This slow sweep re-checks every
// live service's latest app op against the site and reflects reality back to services.status.
//
// It sees only what the site reports for the operation: a site that self-heals a manual
// `kubectl delete` correctly keeps the service online; catching a silent, un-healed delete
// with certainty needs a site inventory endpoint (GET /v1/tenants/:t/apps) — this sweep
// consumes that the moment it exists, and until then acts on op not-found/failed/superseded.
const LIVE_STATUSES = ['online', 'deploying'];

// The dashboard's app id for a service (zero-padded), the inverse of serviceIdFromAppId.
const appIdForService = (id) => `a-svc${String(id).padStart(8, '0')}`;

// Live services + their most-recent app operation (one row per service).
async function listLiveServiceOps() {
  const { rows } = await pool.query(
    `SELECT s.id AS service_id, o.operation_id, o.site_id, o.state, o.updated_at
       FROM services s
       JOIN LATERAL (
         SELECT operation_id, site_id, state, updated_at FROM site_operations
          WHERE resource_type = 'app' AND resource_id = $2 || lpad(s.id::text, 8, '0')
          ORDER BY updated_at DESC LIMIT 1
       ) o ON TRUE
      WHERE s.status = ANY($1)`,
    [LIVE_STATUSES, 'a-svc'],
  );
  return rows;
}

// Pure: given the site's response for a live service's app op, what should the product
// status become? null = leave as-is (dry-run / not visible / still within grace / healthy).
function appDriftState(remote, { ageMs, staleMs = STALE_MS } = {}) {
  if (!remote) return null;                                     // dry-run / not visible
  if (remote.__notFound) return ageMs > staleMs ? 'crashed' : null; // desired state gone (past grace)
  return SERVICE_STATUS[normalizeState(remote.state)] || null;  // reflect the site's state
}

async function setServiceStatus(serviceId, status) {
  const { rowCount } = await pool.query(
    'UPDATE services SET status = $2, updated_at = NOW() WHERE id = $1 AND status <> $2',
    [serviceId, status],
  );
  return rowCount > 0;
}

// A drift outcome → the deploy-history status. A vanished/failed app op means the deploy that
// created it did not succeed; a healthy one confirms success. null = leave history alone.
function appDriftDeploymentStatus(remote, { ageMs, staleMs = STALE_MS } = {}) {
  if (!remote) return null;
  if (remote.__notFound) return ageMs > staleMs ? 'failed' : null;
  return deploymentStatusFor(normalizeState(remote.state));
}

async function reconcileAppStatusOnce({ list = listLiveServiceOps, fetch = client.fetchOperation, setStatus = setServiceStatus, reflectDeployment = Deployment.setStatusByOperation, now = Date.now(), staleMs = STALE_MS } = {}) {
  const rows = await list();
  let corrected = 0;
  for (const row of rows) {
    try {
      const remote = await fetch(row.operation_id, { siteId: row.site_id });
      const ageMs = now - new Date(row.updated_at || 0).getTime();
      const state = appDriftState(remote, { ageMs, staleMs });
      if (state && (await setStatus(row.service_id, state))) corrected += 1;
      const dep = appDriftDeploymentStatus(remote, { ageMs, staleMs }); // keep the deploy row honest too
      if (dep) await reflectDeployment(row.operation_id, dep);
    } catch (e) { console.error(`[site-appstatus] service ${row.service_id} check failed:`, e.message); }
  }
  return { scanned: rows.length, corrected };
}

function startAppStatusReconcile({ intervalMs = 5 * 60 * 1000, staleMs = STALE_MS } = {}) {
  let stopped = false;
  (async function loop() {
    while (!stopped) {
      try { await reconcileAppStatusOnce({ staleMs }); }
      catch (e) { console.error('[site-appstatus] sweep failed:', e.message); }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  })();
  return () => { stopped = true; };
}

module.exports = {
  pollOnce, refreshOne, startStatusWorker, normalizeState, serviceIdFromAppId, appIdForService,
  reflectToService, crashServiceIfLatest, SERVICE_STATUS, deploymentStatusFor, appDriftDeploymentStatus,
  appDriftState, listLiveServiceOps, setServiceStatus, reconcileAppStatusOnce, startAppStatusReconcile,
};
