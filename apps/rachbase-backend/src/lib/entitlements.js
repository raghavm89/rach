'use strict';

/**
 * Billing entitlements — "did this tenant pay for feature X?".
 *
 * Purchased quantity is summed from paid expansion requests (the same source the
 * Observability quota uses), so a feature only unlocks once it's been ordered.
 */

const pool = require('@rach/core').pool;

/** Total purchased quantity of a catalog item for a tenant (excludes cancelled). */
async function purchasedQty(tenantId, itemId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM((item->>'qty')::int), 0)::int AS qty
       FROM vm_expansion_requests r,
            jsonb_array_elements(r.items_json::jsonb) item
      WHERE r.tenant_id = $1
        AND r.status NOT IN ('cancelled')
        AND item->>'id' = $2`,
    [tenantId, itemId]
  );
  return rows[0].qty;
}

/** VM Logs is per-VM and admin-assigned (mirrors Observability). */
async function hasLogsForVm(tenantId, vmId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM vm_logs_assignments WHERE tenant_id = $1 AND vm_id = $2 LIMIT 1',
    [tenantId, vmId]
  );
  return rows.length > 0;
}

module.exports = { purchasedQty, hasLogsForVm };
