'use strict';

/**
 * Phase 1 — Pro tier: flag gating, plan helpers, quota config, and the migration.
 * Pure-logic tests only (no DB): they assert the guarantees that keep Max safe and
 * the brief's quota numbers honoured. DB-backed helpers (getTenantPlan/setTenantPlan)
 * are exercised in integration tests once a test DB is wired.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const flags = require('@rach/core').flags;
const plan = require('../src/lib/plan');
const { proTier, cgroupLimits, priceFor } = require('../src/config/proTier');

const MIGRATIONS = path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations');

test('pro_tier flag defaults OFF and reads truthy env values', () => {
  delete process.env.FEATURE_PRO_TIER;
  assert.equal(flags.isEnabled('pro_tier'), false, 'must default off');
  for (const v of ['1', 'true', 'TRUE', 'on', 'yes']) {
    process.env.FEATURE_PRO_TIER = v;
    assert.equal(flags.isEnabled('pro_tier'), true, `"${v}" should enable`);
  }
  for (const v of ['0', 'false', '', 'nope']) {
    process.env.FEATURE_PRO_TIER = v;
    assert.equal(flags.isEnabled('pro_tier'), false, `"${v}" should not enable`);
  }
  delete process.env.FEATURE_PRO_TIER;
});

test('unknown flags are always false', () => {
  assert.equal(flags.isEnabled('does_not_exist'), false);
});

test('plan helpers classify tiers and validate', () => {
  assert.equal(plan.PLANS.PRO, 'pro');
  assert.equal(plan.PLANS.MAX, 'max');
  assert.ok(plan.isPro('pro') && !plan.isPro('max'));
  assert.ok(plan.isMax('max') && !plan.isMax('pro'));
  assert.ok(plan.isValidPlan('pro') && plan.isValidPlan('max'));
  assert.ok(!plan.isValidPlan('enterprise') && !plan.isValidPlan(undefined));
});

test('proEnabled tracks the feature flag', () => {
  delete process.env.FEATURE_PRO_TIER;
  assert.equal(plan.proEnabled(), false);
  process.env.FEATURE_PRO_TIER = 'true';
  assert.equal(plan.proEnabled(), true);
  delete process.env.FEATURE_PRO_TIER;
});

test('cgroup limits encode the brief defaults (0.5 vCPU limit, 1 GB RAM)', () => {
  const l = cgroupLimits();
  assert.equal(l.CPUQuota, '50%', 'limit 0.5 vCPU -> CPUQuota 50%');
  assert.equal(l.MemoryMax, '1024M', 'limit 1 GB -> MemoryMax 1024M');
  assert.equal(proTier.requestVcpu, 0.25);
  assert.equal(proTier.requestMemMb, 512);
});

test('region pricing returns explicit per-currency amounts (not FX)', () => {
  assert.equal(priceFor('USD'), proTier.priceUsdCents);
  assert.equal(priceFor('INR'), proTier.priceInrPaise);
  assert.equal(priceFor('anything-else'), proTier.priceUsdCents, 'non-INR falls back to USD');
});

test('082 migration adds tenants.plan defaulting to max, constrained, reversible', () => {
  const sql = fs.readFileSync(path.join(MIGRATIONS, '082_tenant_plan.sql'), 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'max'/);
  assert.match(sql, /CHECK \(plan IN \('pro', 'max'\)\)/);
  assert.match(sql, /DROP COLUMN IF EXISTS plan/, 'must document a reversal');
});
