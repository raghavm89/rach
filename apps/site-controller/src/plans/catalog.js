'use strict';

/**
 * Versioned plan catalog (SpaceArk contract §7.1). The site API clamps requested
 * resources against this and rejects unsupported combinations — it never trusts
 * the BFF to enforce Kubernetes security or plan limits. Mirrors the product
 * plans (free | pro | enterprise). Skeleton values — align with billing later.
 */

const PLANS = {
  free: { cpuLimit: '250m', memLimitMiB: 256, maxApps: 1, maxReplicas: 1 },
  pro: { cpuLimit: '1', memLimitMiB: 1024, maxApps: 10, maxReplicas: 3 },
  enterprise: { cpuLimit: '4', memLimitMiB: 8192, maxApps: 100, maxReplicas: 10 },
};

function planOrThrow(name) {
  const p = PLANS[name];
  if (!p) throw new Error(`unknown plan: ${name}`);
  return p;
}

module.exports = { PLANS, planOrThrow };
