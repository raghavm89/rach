'use strict';

/**
 * Pro-tier configuration — config-driven so quotas and prices change without code.
 *
 * Path A (docs/PRO_TIER_shared_pool_mapping.md): the brief's Kubernetes
 * ResourceQuota / LimitRange numbers are enforced as cgroup limits on the tenant's
 * systemd unit on a shared-pool VM. Same numbers, honest Path-A mechanism — no k8s.
 *
 * All values are overridable via environment variables; the defaults match the brief.
 */

const num = (v, d) => (v != null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

const proTier = {
  // cgroup quotas — brief defaults: request 0.25 vCPU / 512 MB, limit 0.5 vCPU / 1 GB.
  requestVcpu:  num(process.env.PRO_REQUEST_VCPU,   0.25),
  limitVcpu:    num(process.env.PRO_LIMIT_VCPU,     0.5),
  requestMemMb: num(process.env.PRO_REQUEST_MEM_MB, 512),
  limitMemMb:   num(process.env.PRO_LIMIT_MEM_MB,   1024),

  // Shared-pool placement target (a Proxmox pool / VM group flagged shared).
  sharedPool: process.env.PRO_SHARED_POOL || 'pro-shared',

  // Region-based pricing (doc §8): explicit per-currency amounts, NOT live FX.
  // INR figure is a placeholder round number — CONFIRM before launch.
  priceUsdCents: num(process.env.PRO_PRICE_USD_CENTS, 2900),   // $29.00
  priceInrPaise: num(process.env.PRO_PRICE_INR_PAISE, 249900), // ₹2,499.00 (placeholder)
};

/**
 * Translate the tier's vCPU/RAM into systemd unit directives. This is the Path-A
 * equivalent of the brief's LimitRange: `CPUQuota` caps burst, `MemoryMax` is the
 * hard RAM ceiling (RAM is never oversubscribed), `CPUWeight` reflects the request
 * share for fair scheduling under contention.
 */
function cgroupLimits() {
  return {
    CPUQuota:  `${Math.round(proTier.limitVcpu * 100)}%`, // 0.5 vCPU -> "50%"
    MemoryMax: `${proTier.limitMemMb}M`,                  // 1024     -> "1024M"
    CPUWeight: Math.max(1, Math.round(proTier.requestVcpu * 100)),
  };
}

/** Included Pro subscription price for a billing currency (see doc §8). */
function priceFor(currency) {
  return currency === 'INR' ? proTier.priceInrPaise : proTier.priceUsdCents;
}

module.exports = { proTier, cgroupLimits, priceFor };
