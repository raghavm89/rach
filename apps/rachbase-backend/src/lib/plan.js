'use strict';

/**
 * Tenant plan (tier) helpers for RachBase.
 *
 *   plan = 'max' → dedicated infrastructure (existing product; the default)
 *   plan = 'pro' → shared-pool, scale-to-zero tier (new; behind the pro_tier flag)
 *
 * This `tenants.plan` is a TIER, distinct from the Razorpay `plans` table. Pro is
 * only ever assignable when the pro_tier feature flag is on — with the flag off the
 * whole platform behaves exactly as Max, satisfying "nothing user-visible until
 * flipped". See docs/PRO_TIER_shared_pool_mapping.md.
 */

const { pool, flags } = require('@rach/core');

const PLANS = Object.freeze({ PRO: 'pro', MAX: 'max' });
const VALID = new Set(Object.values(PLANS));

const isPro       = (plan) => plan === PLANS.PRO;
const isMax       = (plan) => plan === PLANS.MAX;
const isValidPlan = (plan) => VALID.has(plan);

/** Is the Pro tier switched on for this deployment? */
const proEnabled = () => flags.isEnabled('pro_tier');

/** A tenant's plan, defaulting to Max for tenantless users or missing rows. */
async function getTenantPlan(tenantId) {
  if (tenantId == null) return PLANS.MAX;
  const { rows } = await pool.query('SELECT plan FROM tenants WHERE id = $1', [tenantId]);
  return rows[0]?.plan ?? PLANS.MAX;
}

/**
 * Set a tenant's plan. Rejects invalid values and refuses to assign Pro while the
 * feature flag is off (defence in depth — the DB CHECK only guards the value set).
 */
async function setTenantPlan(tenantId, plan) {
  if (!isValidPlan(plan)) throw new Error(`Invalid plan: ${plan}`);
  if (isPro(plan) && !proEnabled()) throw new Error('Pro tier is not enabled');
  const { rows } = await pool.query(
    'UPDATE tenants SET plan = $1, updated_at = NOW() WHERE id = $2 RETURNING id, plan',
    [plan, tenantId]
  );
  return rows[0] || null;
}

module.exports = { PLANS, isPro, isMax, isValidPlan, proEnabled, getTenantPlan, setTenantPlan };
