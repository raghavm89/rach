'use strict';

/**
 * Dev helper: undo any "went live without a completed payment" state.
 *   - Cancels UNPAID base subscriptions ('created') and reverts those tenants to 'max'.
 *   - Cancels UNPAID container subscriptions ('created') and resets their services back
 *     to 'draft' (so you can bring them online again — payment now enforced).
 * Run: `node scripts/reset-pro.js` from apps/rachbase-backend.
 */

require('dotenv').config();
const { pool } = require('@rach/core');

(async () => {
  // 1) Unpaid base subs → cancel + revert tenant plan.
  const base = await pool.query(
    "UPDATE pro_subscriptions SET status = 'cancelled', updated_at = NOW() " +
    "WHERE kind = 'base' AND status = 'created' RETURNING tenant_id",
  );
  const tenantIds = [...new Set(base.rows.map((r) => r.tenant_id))];
  if (tenantIds.length) {
    await pool.query('UPDATE tenants SET plan = $1, updated_at = NOW() WHERE id = ANY($2)', ['max', tenantIds]);
  }

  // 2) Unpaid container subs → the services they were "brought online" for, reset to draft.
  const cont = await pool.query(
    "SELECT service_id FROM pro_subscriptions WHERE kind = 'container' AND status = 'created' AND service_id IS NOT NULL",
  );
  const serviceIds = [...new Set(cont.rows.map((r) => r.service_id))];
  await pool.query("UPDATE pro_subscriptions SET status = 'cancelled', updated_at = NOW() WHERE kind = 'container' AND status = 'created'");
  if (serviceIds.length) {
    await pool.query(
      "UPDATE services SET status = 'draft', pending_order_id = NULL, units = 0, updated_at = NOW() WHERE id = ANY($1)",
      [serviceIds],
    );
  }

  console.log('Reverted tenants to max:', tenantIds.length ? tenantIds : '(none)');
  console.log('Reset unpaid containers to draft (service ids):', serviceIds.length ? serviceIds : '(none)');
  await pool.end();
})().catch((e) => { console.error('reset-pro failed:', e.message); process.exit(1); });
