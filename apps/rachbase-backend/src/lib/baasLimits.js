'use strict';

/**
 * Per-plan BaaS quotas (Phase 3). BaaS backends stay per-project (isolated); the PLAN grants
 * how many you get. Enforced control-plane side (enableBaas checks `projects`); functions /
 * storage limits are read by their slices as they land.
 */

const LIMITS = Object.freeze({
  starter: { projects: 1, functions: 2,  storage_gb: 1 },
  pro:     { projects: 3, functions: 10, storage_gb: 10 },
  // 'max' (unsubscribed sentinel) gets nothing until subscribed.
  max:     { projects: 0, functions: 0,  storage_gb: 0 },
});

const limitFor = (plan) => LIMITS[plan] || LIMITS.max;

/**
 * Would deploying `targetName` exceed the plan's per-backend function cap? Functions upsert by
 * name, so re-deploying an EXISTING name is a free update; only a NEW name counts against the
 * cap. Pure + control-plane enforced (the data-plane slice is not the trust boundary).
 */
function functionDeployBlocked({ existingNames = [], targetName, limit }) {
  const cap = Number(limit) || 0;
  const isNew = !existingNames.includes(targetName);
  return isNew && existingNames.length >= cap;
}

module.exports = { LIMITS, limitFor, functionDeployBlocked };
