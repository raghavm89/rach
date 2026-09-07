'use strict';

/**
 * BaaS backend resize billing — pure parts. resizeDeltaCents is the money math for a
 * pay-first bundle upsize; createResizeOrder/currency touch Razorpay/DB (controller path).
 * verifyPayment is reused from containerBilling and covered there too; re-pinned here.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.RAZORPAY_KEY_SECRET = 'test_secret';
const bb = require('../src/services/baasBilling');

const C = 3; // the fixed 3-container backend bundle (gateway + services + rest)

test('resizeDeltaCents = (perContainerDelta(to) - perContainerDelta(from)) × containers', () => {
  // per-container compute deltas: nano $0, micro $10, small $20.
  assert.equal(bb.resizeDeltaCents({ fromSize: 'nano', toSize: 'micro', containers: C }), 3000);  // +$30 across 3
  assert.equal(bb.resizeDeltaCents({ fromSize: 'micro', toSize: 'small', containers: C }), 3000); // +$30
  assert.equal(bb.resizeDeltaCents({ fromSize: 'nano', toSize: 'small', containers: C }), 6000);  // +$60
});

test('resizeDeltaCents is zero for same size and negative for a downsize (free path)', () => {
  assert.equal(bb.resizeDeltaCents({ fromSize: 'micro', toSize: 'micro', containers: C }), 0);
  assert.ok(bb.resizeDeltaCents({ fromSize: 'small', toSize: 'nano', containers: C }) < 0);
});

test('resizeDeltaCents uses NATIVE India pricing (not a USD peg)', () => {
  // India micro delta = ₹400 (40000 paise) per container × 3 = ₹1,200 for a nano→micro bump.
  assert.equal(bb.resizeDeltaCents({ fromSize: 'nano', toSize: 'micro', containers: C, currency: 'INR' }), 120000);
});

test('verifyPayment accepts a correct HMAC and rejects tampering', () => {
  const orderId = 'order_baas_1', paymentId = 'pay_1';
  const sig = crypto.createHmac('sha256', 'test_secret').update(`${orderId}|${paymentId}`).digest('hex');
  assert.equal(bb.verifyPayment({ orderId, paymentId, signature: sig }), true);
  assert.equal(bb.verifyPayment({ orderId, paymentId, signature: 'deadbeef' }), false);
  assert.equal(bb.verifyPayment({ orderId, paymentId }), false); // missing signature
});
