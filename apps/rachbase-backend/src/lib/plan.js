'use strict';

/**
 * Tenant plan (tier) helpers for RachBase.
 *
 *   plan = 'starter' → shared-pool tier: $15 base, 1 nano container included.
 *   plan = 'pro'     → shared-pool tier: $30 base, 3 nano containers included.
 *   plan = 'max'     → the internal DEFAULT / unsubscribed sentinel. NOT a shown "plan";
 *                      dedicated VMs are plan-independent (bought à la carte via Individual
 *                      Services), so an unsubscribed tenant sits here.
 *
 * The shared tiers (starter/pro) are only assignable when the pro_tier feature flag is on —
 * with the flag off the platform behaves as the default (max). `tenants.plan` is a TIER,
 * distinct from the Razorpay `plans` table.
 */

const { pool, flags } = require('@rach/core');

const PLANS = Object.freeze({ STARTER: 'starter', PRO: 'pro', MAX: 'max' });
const VALID = new Set(Object.values(PLANS));
const SHARED = new Set([PLANS.STARTER, PLANS.PRO]);

const isPro       = (plan) => plan === PLANS.PRO;
const isStarter   = (plan) => plan === PLANS.STARTER;
const isMax       = (plan) => plan === PLANS.MAX;
/** A shared managed-container tier (starter OR pro) — the gate for deploying containers. */
const isShared    = (plan) => SHARED.has(plan);
const isValidPlan = (plan) => VALID.has(plan);

/** Is the shared (Pro/Starter) tier switched on for this deployment? */
const proEnabled = () => flags.isEnabled('pro_tier');

/** A tenant's plan, defaulting to the max sentinel for tenantless users or missing rows. */
async function getTenantPlan(tenantId) {
  if (tenantId == null) return PLANS.MAX;
  const { rows } = await pool.query('SELECT plan FROM tenants WHERE id = $1', [tenantId]);
  return rows[0]?.plan ?? PLANS.MAX;
}

/**
 * Set a tenant's plan. Rejects invalid values and refuses to assign a shared tier while the
 * feature flag is off (defence in depth — the DB CHECK only guards the value set).
 */
async function setTenantPlan(tenantId, plan) {
  if (!isValidPlan(plan)) throw new Error(`Invalid plan: ${plan}`);
  if (isShared(plan) && !proEnabled()) throw new Error('Shared (Pro/Starter) tier is not enabled');
  const { rows } = await pool.query(
    'UPDATE tenants SET plan = $1, updated_at = NOW() WHERE id = $2 RETURNING id, plan',
    [plan, tenantId]
  );
  return rows[0] || null;
}

module.exports = { PLANS, isPro, isStarter, isMax, isShared, isValidPlan, proEnabled, getTenantPlan, setTenantPlan };
