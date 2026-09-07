'use strict';

/**
 * Periodic central→site inventory reconcile (contract §7: "repair missed callbacks +
 * detect drift — don't rely on a single webhook"). On a slow timer it scans placed
 * tenants, finds those whose desired state was never confirmed or went stale/failed,
 * and re-asserts it through the same idempotent outbox path (the site's idempotency
 * key dedupes, so re-assertion is safe and a no-op when nothing drifted).
 *
 * The status-poll worker handles fast, per-operation updates; this is the slow safety
 * net for callbacks that never arrived. Deps are injected so it's unit-testable.
 */

const { pool } = require('@rach/core');
const outbox = require('./siteOutbox');
const { enqueueTenantReconcile, productToSitePlan } = require('./siteTenant');

const SITE_ID = process.env.SITE_ID || 'site1';
const STALE_MS = Number(process.env.SITE_INVENTORY_STALE_MS) || 15 * 60 * 1000; // 15 min

// Pure drift decision for one tenant + its latest operation. Drifted when the site
// never confirmed success: no operation at all, the last one FAILED, or an in-flight
// one has been stuck past the stale window. A SUCCEEDED terminal op is healthy.
function isDrifted(row, { now = Date.now(), staleMs = STALE_MS } = {}) {
  if (!row.site_tenant_ref) return false;      // not placed → nothing to reconcile
  const state = row.op_state;
  if (!state) return true;                     // missed callback / never reconciled
  if (state === 'SUCCEEDED') return false;     // healthy
  if (state === 'FAILED') return true;         // re-assert to retry
  if (state === 'ACCEPTED' || state === 'RECONCILING') {
    const age = now - new Date(row.op_updated_at || 0).getTime();
    return age > staleMs;                      // stuck past the window
  }
  return false;                                // CANCELLED/BLOCKED: leave for a human
}

// Placed tenants + their most-recent tenant operation (one row per tenant).
async function listPlacedTenants() {
  const { rows } = await pool.query(
    `SELECT t.id, t.plan, t.site_id, t.site_tenant_ref,
            o.state AS op_state, o.updated_at AS op_updated_at
       FROM tenants t
       LEFT JOIN LATERAL (
         SELECT state, updated_at FROM site_operations
          WHERE resource_type = 'tenant' AND resource_id = t.site_tenant_ref
          ORDER BY updated_at DESC LIMIT 1
       ) o ON TRUE
      WHERE t.site_tenant_ref IS NOT NULL`,
  );
  return rows;
}

// Re-assert one tenant's desired state (operation + outbox in one txn), like the
// controller's reconcile path but driven by the drift sweep.
async function reassertTenant(row) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const envelope = await enqueueTenantReconcile(client, {
      tenantRef: row.site_tenant_ref,
      tenantId: row.id,
      siteId: row.site_id || SITE_ID,
      customerRef: `c-${row.id}`,
      plan: productToSitePlan(row.plan),
    });
    await client.query('COMMIT');
    return envelope;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function reconcileOnce({ list = listPlacedTenants, reassert = reassertTenant, now = Date.now(), staleMs = STALE_MS } = {}) {
  const rows = await list();
  let repaired = 0;
  for (const row of rows) {
    if (!isDrifted(row, { now, staleMs })) continue;
    try { await reassert(row); repaired += 1; }
    catch (e) { console.error(`[site-inventory] tenant ${row.id} re-assert failed:`, e.message); }
  }
  return { scanned: rows.length, repaired };
}

function startInventoryReconcile({ intervalMs = 5 * 60 * 1000, staleMs = STALE_MS } = {}) {
  let stopped = false;
  (async function loop() {
    while (!stopped) {
      try { await reconcileOnce({ staleMs }); }
      catch (e) { console.error('[site-inventory] sweep failed:', e.message); }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  })();
  return () => { stopped = true; };
}

module.exports = { isDrifted, listPlacedTenants, reassertTenant, reconcileOnce, startInventoryReconcile, STALE_MS };
