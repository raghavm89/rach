'use strict';

/**
 * Container billing — pure parts (amount from the pricing authority + HMAC verify).
 * billingCurrencyFor / createDeployOrder touch the DB / Razorpay and are covered by
 * the controller path; here we pin the money math and the signature check.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.RAZORPAY_KEY_SECRET = 'test_secret';
const cb = require('../src/services/containerBilling');

test('deployAmountCents matches the pricing model: free app slot, then $10 + compute delta', () => {
  assert.equal(cb.deployAmountCents({ existingCount: 0, size: 'nano' }), 0);      // free app slot
  assert.equal(cb.deployAmountCents({ existingCount: 1, size: 'nano' }), 1000);   // +container
  assert.equal(cb.deployAmountCents({ existingCount: 1, size: 'micro' }), 2000);  // +container +$10
  assert.equal(cb.deployAmountCents({ existingCount: 1, size: 'small' }), 3000);  // +container +$20
  assert.equal(cb.deployAmountCents({ existingCount: 0, size: 'micro' }), 1000);  // free slot upsized → compute only
  assert.equal(cb.deployAmountCents({ existingCount: 1, size: 'small', currency: 'INR' }), 130000); // native India: ₹500 container + ₹800 small = ₹1,300
});

test('verifyPayment accepts a correct HMAC and rejects tampering / missing fields', () => {
  const orderId = 'order_1', paymentId = 'pay_1';
  const sig = crypto.createHmac('sha256', 'test_secret').update(`${orderId}|${paymentId}`).digest('hex');
  assert.equal(cb.verifyPayment({ orderId, paymentId, signature: sig }), true);
  assert.equal(cb.verifyPayment({ orderId, paymentId, signature: 'deadbeef' }), false);
  assert.equal(cb.verifyPayment({ orderId, paymentId: 'pay_2', signature: sig }), false); // wrong payment
  assert.equal(cb.verifyPayment({ orderId, paymentId }), false);                          // missing signature
});
