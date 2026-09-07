'use strict';

/**
 * Pro-tier container pricing — the single authority for what a Pro subscription and
 * its containers cost. Reads `catalog.json` and NEVER trusts an amount from the client.
 *
 * GEO-BASED pricing (2026-09): prices are NATIVE per region, not a currency-pegged
 * conversion. `catalog.pro.regions` holds one block per billing currency:
 *   - USD (Rest-of-World): Starter $10, Pro $30, +container $10, micro +$10, small +$20.
 *   - INR (India, ex-GST): Starter ₹500, Pro ₹1,500, +container ₹500, micro +₹400, small +₹800.
 * Currency is resolved server-side from the tenant's billing address (India/GST → INR,
 * else USD); the client never picks it. Amounts are minor units (cents / paise). India
 * amounts are ex-GST — the 18% GST is added by the tax layer at checkout.
 *
 * Model:
 *   - Base tier INCLUDES base_includes_containers (starter 1, pro 3) nano containers.
 *   - Each additional container = region.container_cents/mo.
 *   - Compute size is a per-container ADD-ON delta on top of the container fee (nano +0).
 *     The included allowance waives the container fee but a compute upgrade is still charged.
 *   - Billing is PER SERVICE — replica count does not change price.
 */

const catalog = require('../catalog.json');

const PRO = catalog.pro;
const REGIONS = PRO.regions;
const INR_PER_USD = PRO.inr_per_usd;
const COMPUTE_SIZES = PRO.compute_sizes;         // physical specs (region-independent)
const DEFAULT_COMPUTE_SIZE = PRO.default_compute_size;
const DEFAULT_REGION = PRO.default_region || 'USD';

// Subscription tiers (region-independent: label + included allowance).
const TIERS = PRO.tiers;
const DEFAULT_TIER = PRO.default_tier || 'starter';
function isValidTier(tier) { return Object.prototype.hasOwnProperty.call(TIERS, String(tier || '')); }
function tierName(tier) { return isValidTier(tier) ? tier : DEFAULT_TIER; }
function baseIncludes(tier) { return TIERS[tierName(tier)].base_includes_containers; }

const SUPPORTED = new Set(Object.keys(REGIONS)); // currency codes with a native price block

// Resolve a currency → its region price block (falls back to the default region).
function region(currency) {
  const c = String(currency || DEFAULT_REGION).toUpperCase();
  if (!SUPPORTED.has(c)) throw new Error(`unsupported currency: ${currency}`);
  return REGIONS[c];
}

// ── Region-native price lookups (minor units in the region's own currency) ──────
function baseCents(tier, currency = DEFAULT_REGION) { return region(currency).tiers[tierName(tier)].base_cents; }
function containerCents(currency = DEFAULT_REGION) { return region(currency).container_cents; }
function computeDeltaCents(size = DEFAULT_COMPUTE_SIZE, currency = DEFAULT_REGION) {
  return region(currency).compute_delta_cents[sizeSpec(size).size];
}

// Back-compat top-level (USD region).
const BASE_CENTS = baseCents(DEFAULT_TIER, DEFAULT_REGION);
const BASE_INCLUDES = baseIncludes(DEFAULT_TIER);
const CONTAINER_CENTS = containerCents(DEFAULT_REGION);

function isValidSize(size) { return Object.prototype.hasOwnProperty.call(COMPUTE_SIZES, String(size || '')); }

// Resolve a compute size (falling back to the default) → its spec { size, delta_cents, memory_mb, cpu, specs }.
// Note: spec.delta_cents is the USD/display default; use computeDeltaCents(size, currency) for the charge.
function sizeSpec(size = DEFAULT_COMPUTE_SIZE) {
  const s = isValidSize(size) ? size : DEFAULT_COMPUTE_SIZE;
  return { size: s, ...COMPUTE_SIZES[s] };
}

// The k8s resource request/limit for a compute size (requests == limits, per the
// hardening baseline). Region-independent — a size buys the same hardware everywhere.
function resourcesForSize(size = DEFAULT_COMPUTE_SIZE) {
  const s = sizeSpec(size);
  return { cpuRequestM: s.cpu_millicores, cpuLimitM: s.cpu_millicores, memRequestMiB: s.memory_mb, memLimitMiB: s.memory_mb };
}

// ── Recurring subscription decomposition (base + add-on model) ──────────────────
// Monthly bill = ONE base subscription (tier base + the included container's compute
// upgrade) + one add-on subscription per ADDITIONAL container. Each is a real monthly
// Razorpay subscription, charged in the region's native currency.

// Recurring amount of the tenant base subscription: tier base + the included container's compute delta.
function baseSubscriptionCents(tier = DEFAULT_TIER, includedSize = DEFAULT_COMPUTE_SIZE, currency = DEFAULT_REGION) {
  return baseCents(tier, currency) + computeDeltaCents(includedSize, currency);
}

// Recurring amount of one additional-container subscription: container fee + compute delta.
function containerSubscriptionCents(size = DEFAULT_COMPUTE_SIZE, currency = DEFAULT_REGION) {
  return containerCents(currency) + computeDeltaCents(size, currency);
}

// India/GST → INR, everyone else → USD. Billing address (country) is authoritative.
function currencyForCountry(country) {
  return String(country || '').trim().toUpperCase() === 'IN' ? 'INR' : 'USD';
}

// Generic USD→currency conversion (fixed ×inr_per_usd). NOT used for Pro pricing anymore
// (that is region-native); kept for any non-Pro amounts that still peg off USD.
function toCurrency(cents, currency) {
  const c = String(currency || 'USD').toUpperCase();
  if (c === 'USD') return cents;
  if (c === 'INR') return cents * INR_PER_USD;
  throw new Error(`unsupported currency: ${currency}`);
}

// How many of `count` containers are billed as add-ons (beyond the tier's allowance).
function billableExtras(tier, count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return Math.max(0, n - baseIncludes(tier));
}

// Full monthly subscription amount for a tenant running `containerCount` containers,
// all at the DEFAULT (nano) compute size. For mixed sizes use monthlyChargeForContainers.
function monthlyChargeCents(tier, containerCount, currency = DEFAULT_REGION) {
  const extras = billableExtras(tier, containerCount);
  return baseCents(tier, currency) + extras * containerCents(currency);
}

/**
 * Full monthly amount for a tenant's actual containers (each with a compute size):
 *   base + (extras beyond the tier's allowance) × container_cents + Σ compute deltas.
 * @param containers array of { size } (order-independent; replicas are irrelevant).
 */
function monthlyChargeForContainers(tier, containers = [], currency = DEFAULT_REGION) {
  const list = Array.isArray(containers) ? containers : [];
  const extras = billableExtras(tier, list.length);
  const compute = list.reduce((sum, c) => sum + computeDeltaCents(c && c.size, currency), 0);
  return baseCents(tier, currency) + extras * containerCents(currency) + compute;
}

/**
 * Marginal charge to bring ONE more container online — the pay-to-online amount:
 * the container fee (0 if the included allowance still covers it, else container_cents)
 * PLUS the compute-size add-on for the chosen size.
 * @param existingCount containers already active/billed BEFORE this deploy.
 * @param size          compute size of the container being deployed (default nano).
 */
function deployChargeCents(tier, existingCount, size = DEFAULT_COMPUTE_SIZE, currency = DEFAULT_REGION) {
  const n = Math.max(0, Math.floor(Number(existingCount) || 0));
  const containerFee = n < baseIncludes(tier) ? 0 : containerCents(currency); // allowance waives the fee, not the compute delta
  return containerFee + computeDeltaCents(size, currency);
}

// A full, display-ready quote for the tenant's containers (each { size }).
function quote(tier, containers = [], currency = DEFAULT_REGION) {
  const c = String(currency || DEFAULT_REGION).toUpperCase();
  const list = Array.isArray(containers) ? containers : [];
  const extras = billableExtras(tier, list.length);
  return {
    currency: region(c).currency,
    tier: tierName(tier),
    base_cents: baseCents(tier, c),
    base_includes_containers: baseIncludes(tier),
    container_cents: containerCents(c),
    container_count: list.length,
    billable_extras: extras,
    compute_cents: list.reduce((s, x) => s + computeDeltaCents(x && x.size, c), 0),
    lines: list.map((x) => { const sp = sizeSpec(x && x.size); return { size: sp.size, specs: sp.specs, compute_delta_cents: computeDeltaCents(sp.size, c) }; }),
    total_cents: monthlyChargeForContainers(tier, list, c),
  };
}

module.exports = {
  BASE_CENTS, BASE_INCLUDES, CONTAINER_CENTS, INR_PER_USD,
  TIERS, DEFAULT_TIER, DEFAULT_REGION, isValidTier, baseCents, baseIncludes, containerCents,
  REGIONS, region,
  COMPUTE_SIZES, DEFAULT_COMPUTE_SIZE, isValidSize, sizeSpec, computeDeltaCents, resourcesForSize,
  baseSubscriptionCents, containerSubscriptionCents,
  currencyForCountry, toCurrency, billableExtras,
  monthlyChargeCents, monthlyChargeForContainers, deployChargeCents, quote,
};
