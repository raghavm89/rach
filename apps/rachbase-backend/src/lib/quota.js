'use strict';

/**
 * Per-plan container quota (safety/abuse cap on billable shared containers).
 *
 *   Shared tiers (starter/pro) → PRO_CONTAINER_QUOTA (default 50). Others → unlimited.
 *
 * A cap of 0 means "no limit". Enforced when a NEW container is brought online, not on
 * free drafts and not on resizing an already-online one. Pure + config-driven so the
 * limit is tunable via env without a code change.
 */

const DEFAULT_PRO_QUOTA = 50;
const SHARED_PLANS = new Set(['starter', 'pro']);

function proQuota() {
  const n = parseInt(process.env.PRO_CONTAINER_QUOTA ?? String(DEFAULT_PRO_QUOTA), 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_PRO_QUOTA;
}

// Billable-container cap for a plan; 0 = unlimited.
function containerCapForPlan(plan) {
  return SHARED_PLANS.has(plan) ? proQuota() : 0; // non-shared: unlimited
}

// Would bringing one more container online exceed the plan's cap?
function exceedsCap({ plan, currentCount }) {
  const cap = containerCapForPlan(plan);
  return cap > 0 && Number(currentCount) >= cap;
}

module.exports = { DEFAULT_PRO_QUOTA, proQuota, containerCapForPlan, exceedsCap };
