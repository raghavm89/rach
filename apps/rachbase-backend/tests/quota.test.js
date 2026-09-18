'use strict';

/**
 * Plan container quota — pure + config-driven. Pro caps at PRO_CONTAINER_QUOTA
 * (default 50); Max is unlimited. A cap of 0 means no limit.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const q = require('../src/lib/quota');

test('containerCapForPlan: Pro = 50 by default, Max = unlimited (0)', () => {
  delete process.env.PRO_CONTAINER_QUOTA;
  assert.equal(q.containerCapForPlan('pro'), 50);
  assert.equal(q.containerCapForPlan('max'), 0);
  assert.equal(q.containerCapForPlan(undefined), 0);
});

test('PRO_CONTAINER_QUOTA overrides the Pro cap', () => {
  process.env.PRO_CONTAINER_QUOTA = '3';
  assert.equal(q.containerCapForPlan('pro'), 3);
  delete process.env.PRO_CONTAINER_QUOTA;
});

test('exceedsCap: blocks the Nth container on Pro, never blocks Max', () => {
  process.env.PRO_CONTAINER_QUOTA = '2';
  assert.equal(q.exceedsCap({ plan: 'pro', currentCount: 0 }), false); // 1st ok
  assert.equal(q.exceedsCap({ plan: 'pro', currentCount: 1 }), false); // 2nd ok
  assert.equal(q.exceedsCap({ plan: 'pro', currentCount: 2 }), true);  // 3rd blocked (== cap)
  assert.equal(q.exceedsCap({ plan: 'max', currentCount: 999 }), false); // Max never blocked
  delete process.env.PRO_CONTAINER_QUOTA;
});

test('a cap of 0 (unlimited) never blocks', () => {
  process.env.PRO_CONTAINER_QUOTA = '0';
  assert.equal(q.exceedsCap({ plan: 'pro', currentCount: 100000 }), false);
  delete process.env.PRO_CONTAINER_QUOTA;
});
