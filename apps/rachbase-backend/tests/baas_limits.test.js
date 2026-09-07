'use strict';

/** Per-plan BaaS quotas — the pure decision helpers. Projects are gated in enableBaas (counted
 * via the DB); functions are gated in baasDeployFunction using functionDeployBlocked below. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { LIMITS, limitFor, functionDeployBlocked } = require('../src/lib/baasLimits');

test('limitFor returns per-plan caps; unknown/max plan gets nothing', () => {
  assert.deepEqual(limitFor('starter'), { projects: 1, functions: 2, storage_gb: 1 });
  assert.deepEqual(limitFor('pro'), { projects: 3, functions: 10, storage_gb: 10 });
  assert.deepEqual(limitFor('max'), { projects: 0, functions: 0, storage_gb: 0 });
  assert.deepEqual(limitFor('bogus'), LIMITS.max); // unknown → the nothing sentinel
});

test('functionDeployBlocked: a NEW name counts, an existing name (update) is free', () => {
  const limit = 2;
  // at cap, new name → blocked
  assert.equal(functionDeployBlocked({ existingNames: ['a', 'b'], targetName: 'c', limit }), true);
  // at cap, re-deploying an existing name → allowed (update, not a new slot)
  assert.equal(functionDeployBlocked({ existingNames: ['a', 'b'], targetName: 'a', limit }), false);
  // under cap, new name → allowed
  assert.equal(functionDeployBlocked({ existingNames: ['a'], targetName: 'b', limit }), false);
});

test('functionDeployBlocked: a plan with 0 functions blocks the very first deploy', () => {
  assert.equal(functionDeployBlocked({ existingNames: [], targetName: 'a', limit: 0 }), true);
  assert.equal(functionDeployBlocked({ existingNames: [], targetName: 'a', limit: 2 }), false);
});
