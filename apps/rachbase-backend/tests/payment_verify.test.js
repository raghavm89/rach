'use strict';

/**
 * Captured-amount payment verification (go-live audit P0 #4). A stubbed Razorpay confirms the
 * "pay cheap, verify expensive" bypass is closed: with an expectedAmount, a payment that matches
 * the cheap order but not the expensive price is rejected.
 */

process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { assertOrderPaid } = require('../src/services/paymentVerify');

const ORDER = 'order_cheap';
const PAY = 'pay_1';
const sigFor = (order, pay) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${order}|${pay}`).digest('hex');

// Fake Razorpay: one captured ₹100 payment on `order_cheap`.
const fakeRazorpay = (payment, order) => ({
  payments: { fetch: async () => payment },
  orders: { fetch: async () => order },
});

test('accepts a captured payment that matches the expected price', async () => {
  const rp = fakeRazorpay({ status: 'captured', amount: 10000, currency: 'INR', order_id: ORDER }, { amount: 10000, currency: 'INR' });
  const r = await assertOrderPaid(
    { razorpay_order_id: ORDER, razorpay_payment_id: PAY, razorpay_signature: sigFor(ORDER, PAY), expectedAmount: 10000, expectedCurrency: 'INR' },
    { razorpay: rp },
  );
  assert.equal(r.verified, true);
  assert.equal(r.amount, 10000);
});

test('rejects the pay-cheap / verify-expensive bypass (amount mismatch)', async () => {
  // Attacker paid ₹100 on the cheap order, replays it while claiming an expensive package (₹10000).
  const rp = fakeRazorpay({ status: 'captured', amount: 10000, currency: 'INR', order_id: ORDER });
  await assert.rejects(
    () => assertOrderPaid(
      { razorpay_order_id: ORDER, razorpay_payment_id: PAY, razorpay_signature: sigFor(ORDER, PAY), expectedAmount: 1000000, expectedCurrency: 'INR' },
      { razorpay: rp },
    ),
    /amount .* does not match|amount_mismatch/i,
  );
});

test('rejects an uncaptured (authorized-only) payment for a one-time order', async () => {
  const rp = fakeRazorpay({ status: 'authorized', amount: 10000, currency: 'INR', order_id: ORDER }, { amount: 10000, currency: 'INR' });
  await assert.rejects(
    () => assertOrderPaid({ razorpay_order_id: ORDER, razorpay_payment_id: PAY, razorpay_signature: sigFor(ORDER, PAY) }, { razorpay: rp }),
    /not captured|"authorized"/i,
  );
});

test('rejects a payment that belongs to a different order', async () => {
  const rp = fakeRazorpay({ status: 'captured', amount: 10000, currency: 'INR', order_id: 'order_other' }, { amount: 10000, currency: 'INR' });
  await assert.rejects(
    () => assertOrderPaid({ razorpay_order_id: ORDER, razorpay_payment_id: PAY, razorpay_signature: sigFor(ORDER, PAY) }, { razorpay: rp }),
    /different order|order_mismatch/i,
  );
});

test('rejects a bad signature before any gateway call', async () => {
  let called = false;
  const rp = { payments: { fetch: async () => { called = true; return {}; } }, orders: { fetch: async () => { called = true; return {}; } } };
  await assert.rejects(
    () => assertOrderPaid({ razorpay_order_id: ORDER, razorpay_payment_id: PAY, razorpay_signature: 'deadbeef' }, { razorpay: rp }),
    /signature/i,
  );
  assert.equal(called, false);
});

test('order-derived amount path: no expectedAmount → trusts the fetched order', async () => {
  const rp = fakeRazorpay({ status: 'captured', amount: 4000, currency: 'USD', order_id: ORDER }, { amount: 4000, currency: 'USD' });
  const r = await assertOrderPaid({ razorpay_order_id: ORDER, razorpay_payment_id: PAY, razorpay_signature: sigFor(ORDER, PAY) }, { razorpay: rp });
  assert.equal(r.verified, true);
  assert.equal(r.amount, 4000);
});
