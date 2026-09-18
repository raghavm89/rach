'use strict';

/**
 * Shared managed-container pricing — the authoritative charge model. Pure; no Razorpay, no DB.
 * GEO-NATIVE (2026-09): prices differ by region, not a currency peg.
 *   USD (RoW):  Starter $10, Pro $30, +container $10, micro +$10, small +$20.
 *   INR (India): Starter ₹500, Pro ₹1,500, +container ₹500, micro +₹400, small +₹800 (all ex-GST).
 * Two tiers: STARTER (1 nano incl.) and PRO (3 nano incl.); per service (not per replica).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const P = require('../src/proPricing');

test('tier constants: USD starter $10/1, pro $30/3; native INR bases; $10/container', () => {
  assert.equal(P.baseCents('starter'), 1000);        // USD default
  assert.equal(P.baseCents('pro'), 3000);
  assert.equal(P.baseCents('starter', 'INR'), 50000); // native ₹500
  assert.equal(P.baseCents('pro', 'INR'), 150000);    // native ₹1,500
  assert.equal(P.baseIncludes('starter'), 1);
  assert.equal(P.baseIncludes('pro'), 3);
  assert.equal(P.containerCents('USD'), 1000);
  assert.equal(P.containerCents('INR'), 50000);       // native ₹500
  assert.equal(P.CONTAINER_CENTS, 1000);
  assert.equal(P.BASE_CENTS, 1000);      // back-compat = USD starter
  assert.equal(P.BASE_INCLUDES, 1);
  assert.ok(P.isValidTier('starter') && P.isValidTier('pro') && !P.isValidTier('bogus'));
});

test('billableExtras: starter frees 1, pro frees 3', () => {
  assert.equal(P.billableExtras('starter', 1), 0);
  assert.equal(P.billableExtras('starter', 2), 1);
  assert.equal(P.billableExtras('pro', 3), 0); // 3 included
  assert.equal(P.billableExtras('pro', 4), 1); // 4th billed
  assert.equal(P.billableExtras('pro', 6), 3);
});

test('monthlyChargeCents USD: starter app=$10 / app+db=$20; pro 3 incl=$30 / 4th=$40', () => {
  assert.equal(P.monthlyChargeCents('starter', 1), 1000);
  assert.equal(P.monthlyChargeCents('starter', 2), 2000);
  assert.equal(P.monthlyChargeCents('pro', 3), 3000);   // 3 nano included in $30
  assert.equal(P.monthlyChargeCents('pro', 4), 4000);   // +$10
  assert.equal(P.monthlyChargeCents('pro', 0), 3000);   // base still applies
});

test('monthlyChargeCents INR uses NATIVE India prices (not a peg)', () => {
  assert.equal(P.monthlyChargeCents('starter', 2, 'INR'), 100000); // ₹500 + ₹500 = ₹1,000
  assert.equal(P.monthlyChargeCents('pro', 3, 'INR'), 150000);     // ₹1,500 base, 3 incl
  assert.equal(P.monthlyChargeCents('pro', 4, 'INR'), 200000);     // + ₹500 container = ₹2,000
});

test('deployChargeCents (nano): starter frees 1st, pro frees first 3', () => {
  assert.equal(P.deployChargeCents('starter', 0), 0);
  assert.equal(P.deployChargeCents('starter', 1), 1000);          // 2nd → $10
  assert.equal(P.deployChargeCents('pro', 0), 0);
  assert.equal(P.deployChargeCents('pro', 1), 0);                 // within 3 → free
  assert.equal(P.deployChargeCents('pro', 2), 0);                 // within 3 → free
  assert.equal(P.deployChargeCents('pro', 3), 1000);             // 4th → $10
  assert.equal(P.deployChargeCents('pro', 1, 'nano', 'INR'), 0);
  assert.equal(P.deployChargeCents('pro', 3, 'nano', 'INR'), 50000); // native ₹500 container
});

test('deployChargeCents adds compute delta; an included slot still pays the upgrade', () => {
  assert.equal(P.deployChargeCents('starter', 0, 'micro'), 1000); // free slot upsized to micro → $10 compute only
  assert.equal(P.deployChargeCents('pro', 2, 'small'), 2000);     // 3rd (free) small → $20 compute only
  assert.equal(P.deployChargeCents('pro', 3, 'micro'), 2000);     // 4th micro → $10 + $10
  assert.equal(P.deployChargeCents('starter', 1, 'small', 'INR'), 130000); // native: ₹500 container + ₹800 small = ₹1,300
});

test('baseSubscriptionCents per tier (+ included compute)', () => {
  assert.equal(P.baseSubscriptionCents('starter', 'nano'), 1000);
  assert.equal(P.baseSubscriptionCents('starter', 'micro'), 2000);
  assert.equal(P.baseSubscriptionCents('pro', 'nano'), 3000);
  assert.equal(P.baseSubscriptionCents('pro', 'small'), 5000);
  assert.equal(P.baseSubscriptionCents('pro', 'nano', 'INR'), 150000); // native ₹1,500
});

test('containerSubscriptionCents is tier-independent (container fee + compute)', () => {
  assert.equal(P.containerSubscriptionCents('nano'), 1000);
  assert.equal(P.containerSubscriptionCents('micro'), 2000);
  assert.equal(P.containerSubscriptionCents('small', 'INR'), 130000); // native ₹500 + ₹800 = ₹1,300
});

test('quote reconciles to the monthly total per tier', () => {
  const q = P.quote('pro', [{ size: 'nano' }, { size: 'nano' }, { size: 'nano' }, { size: 'micro' }], 'USD');
  assert.equal(q.tier, 'pro');
  assert.equal(q.base_cents, 3000);
  assert.equal(q.billable_extras, 1);          // 4 containers, 3 included
  assert.equal(q.compute_cents, 1000);         // one micro
  assert.equal(q.total_cents, 5000);           // 3000 + 1000 + 1000
  assert.equal(q.base_cents + q.billable_extras * q.container_cents + q.compute_cents, q.total_cents);
});

test('quote is region-native for INR', () => {
  const q = P.quote('pro', [{ size: 'nano' }, { size: 'nano' }, { size: 'nano' }, { size: 'micro' }], 'INR');
  assert.equal(q.currency, 'INR');
  assert.equal(q.base_cents, 150000);          // ₹1,500
  assert.equal(q.container_cents, 50000);      // ₹500
  assert.equal(q.compute_cents, 40000);        // one micro = ₹400
  assert.equal(q.total_cents, 240000);         // 150000 + 50000 + 40000 = ₹2,400
});

test('monthlyChargeForContainers sums base + extras + compute across mixed sizes', () => {
  assert.equal(P.monthlyChargeForContainers('starter', [{ size: 'nano' }, { size: 'micro' }]), 3000); // 1000 + 1000 + 1000
  assert.equal(P.monthlyChargeForContainers('pro', [{ size: 'nano' }, { size: 'nano' }, { size: 'nano' }]), 3000);
  assert.equal(P.monthlyChargeForContainers('pro', []), 3000);
  assert.equal(P.monthlyChargeForContainers('starter', [{ size: 'nano' }, { size: 'micro' }], 'INR'), 140000); // ₹500 + ₹500 + ₹400
});

test('currencyForCountry: India → INR, else USD', () => {
  assert.equal(P.currencyForCountry('IN'), 'INR');
  assert.equal(P.currencyForCountry('US'), 'USD');
  assert.equal(P.currencyForCountry(''), 'USD');
});

test('region() rejects unsupported currencies', () => {
  assert.throws(() => P.region('EUR'));
  assert.throws(() => P.baseCents('starter', 'EUR'));
});

test('computeDeltaCents / sizeSpec / resourcesForSize', () => {
  assert.equal(P.computeDeltaCents('micro'), 1000);          // USD
  assert.equal(P.computeDeltaCents('small', 'INR'), 80000);  // native ₹800
  assert.equal(P.sizeSpec('micro').memory_mb, 1024);
  assert.deepEqual(P.resourcesForSize('small'), { cpuRequestM: 2000, cpuLimitM: 2000, memRequestMiB: 2048, memLimitMiB: 2048 });
});
