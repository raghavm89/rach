'use strict';

/**
 * Recurring Pro subscription — pure decision layer (no DB, no Razorpay). Subscribe-first
 * model: a $15 base is created up front; each container's recurring amount comes from
 * `deployChargeCents` (first container's fee waived by the allowance). The orchestration
 * (Razorpay + pro_subscriptions rows + promotion) runs against Postgres locally.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const S = require('../src/services/proSubscription');

test('containerAmountCents: first container fee waived, later ones $10 + compute', () => {
  // First billable container (existingCount 0): allowance waives the $10 fee.
  assert.equal(S.containerAmountCents({ existingCount: 0, size: 'nano' }), 0);      // included, free
  assert.equal(S.containerAmountCents({ existingCount: 0, size: 'micro' }), 1000);  // compute only ($10)
  assert.equal(S.containerAmountCents({ existingCount: 0, size: 'small' }), 2000);  // compute only ($20)
  // Additional containers: $10 + compute.
  assert.equal(S.containerAmountCents({ existingCount: 1, size: 'nano' }), 1000);
  assert.equal(S.containerAmountCents({ existingCount: 1, size: 'micro' }), 2000);
  assert.equal(S.containerAmountCents({ existingCount: 2, size: 'small' }), 3000);
});

test('containerAmountCents honours INR (native India pricing)', () => {
  assert.equal(S.containerAmountCents({ existingCount: 1, size: 'micro', currency: 'INR' }), 90000); // ₹500 container + ₹400 micro = ₹900
  assert.equal(S.containerAmountCents({ existingCount: 0, size: 'nano', currency: 'INR' }), 0);
});

test('webhookAction classifies subscription events for the container lifecycle', () => {
  assert.equal(S.webhookAction('charged'), 'charged');
  for (const e of ['halted', 'cancelled', 'completed', 'expired']) assert.equal(S.webhookAction(e), 'terminal');
  for (const e of ['authenticated', 'activated', 'pending', 'updated', undefined]) assert.equal(S.webhookAction(e), 'ignore');
});
