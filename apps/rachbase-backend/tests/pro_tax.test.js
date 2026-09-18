'use strict';

/**
 * Pro-path GST gross-up (go-live audit P0 #3). Pure unit tests with stubbed pool + tax engine
 * — no DB, no Razorpay. Verifies buyer resolution from the profile and that the charged amount
 * is grossed up by exactly the tax the invoice will re-add. Tax-engine FAILURE is fail-closed
 * (TaxUnavailableError, 503): a mispriced recurring plan is worse than a retryable checkout
 * error (re-audit 6 Sep). A computed zero (RoW / no registration) is still success.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const proTax = require('../src/services/proTax');

// A pool stub that returns one users row.
const poolWith = (row) => ({ query: async () => ({ rows: row ? [row] : [] }) });

test('buyerForUser maps an India billing address + GSTIN to the tax-engine buyer shape', async () => {
  const pool = poolWith({ gstin: '29ABCDE1234F1Z5', billing_address: { country: 'India', state: 'Karnataka', pincode: '560001', city: 'Bengaluru' } });
  const buyer = await proTax.buyerForUser(7, { pool });
  assert.equal(buyer.country_code, 'IN');
  assert.equal(buyer.region_code, 'Karnataka');
  assert.equal(buyer.postal_code, '560001');
  assert.equal(buyer.gstin, '29ABCDE1234F1Z5');
});

test('buyerForUser: an India address WITHOUT a GSTIN still resolves IN — GST is charged either way', async () => {
  const buyer = await proTax.buyerForUser(7, { pool: poolWith({ gstin: null, billing_address: { country: 'India', state: 'Maharashtra' } }) });
  assert.equal(buyer.country_code, 'IN');   // jurisdiction comes from the address…
  assert.equal(buyer.gstin, null);          // …GSTIN is optional B2B detail, not a tax switch
});

test('buyerForUser: GSTIN alone signals India even without a country', async () => {
  const buyer = await proTax.buyerForUser(7, { pool: poolWith({ gstin: '29ABCDE1234F1Z5', billing_address: {} }) });
  assert.equal(buyer.country_code, 'IN');
});

test('buyerForUser: unknown user → empty buyer (no jurisdiction)', async () => {
  const buyer = await proTax.buyerForUser(99, { pool: poolWith(null) });
  assert.deepEqual(buyer, {});
});

test('grossUpFor adds exactly the tax the engine reports (India 18% GST)', async () => {
  const pool = poolWith({ gstin: null, billing_address: { country: 'IN', state: 'MH' } });
  // Stub the tax engine: 18% of the subtotal.
  const calculateTax = async ({ lines }) => {
    const subtotal = lines[0].subtotal_minor;
    return { tax_total_minor: Math.round(subtotal * 0.18) };
  };
  const r = await proTax.grossUpFor({ userId: 7, subtotalCents: 50000, currency: 'INR', description: 'base' }, { pool, calculateTax });
  assert.equal(r.subtotalCents, 50000);
  assert.equal(r.taxCents, 9000);       // ₹90 GST on ₹500
  assert.equal(r.grossCents, 59000);    // ₹590 charged
});

test('grossUpFor: no registration / RoW → zero tax, gross == subtotal', async () => {
  const pool = poolWith({ gstin: null, billing_address: { country: 'US' } });
  const calculateTax = async () => ({ tax_total_minor: 0 });
  const r = await proTax.grossUpFor({ userId: 7, subtotalCents: 3000, currency: 'USD' }, { pool, calculateTax });
  assert.equal(r.taxCents, 0);
  assert.equal(r.grossCents, 3000);
});

test('taxCentsFor: a tax-engine failure FAILS CLOSED with TaxUnavailableError (503), never zero', async () => {
  const pool = poolWith({ billing_address: { country: 'IN' } });
  const calculateTax = async () => { throw new Error('tax service down'); };
  await assert.rejects(
    proTax.taxCentsFor({ userId: 7, subtotalCents: 50000, currency: 'INR' }, { pool, calculateTax }),
    (err) => {
      assert.ok(err instanceof proTax.TaxUnavailableError);
      assert.equal(err.status, 503);
      assert.equal(err.code, 'tax_unavailable');
      assert.match(err.message, /not been charged/);
      return true;
    },
  );
});

test('grossUpFor propagates the failure — a checkout must not mint an ex-GST recurring plan', async () => {
  const pool = poolWith({ billing_address: { country: 'IN' } });
  const calculateTax = async () => { throw new Error('tax service down'); };
  await assert.rejects(
    proTax.grossUpFor({ userId: 7, subtotalCents: 150000, currency: 'INR', description: 'base' }, { pool, calculateTax }),
    proTax.TaxUnavailableError,
  );
});

test('a profile-lookup (DB) failure also fails closed', async () => {
  const pool = { query: async () => { throw new Error('db unreachable'); } };
  const calculateTax = async () => ({ tax_total_minor: 0 });
  await assert.rejects(
    proTax.taxCentsFor({ userId: 7, subtotalCents: 50000, currency: 'INR' }, { pool, calculateTax }),
    proTax.TaxUnavailableError,
  );
});

test('taxCentsFor: zero subtotal short-circuits to zero (no engine call)', async () => {
  let called = false;
  const calculateTax = async () => { called = true; return { tax_total_minor: 999 }; };
  const cents = await proTax.taxCentsFor({ userId: 7, subtotalCents: 0, currency: 'INR' }, { pool: poolWith({}), calculateTax });
  assert.equal(cents, 0);
  assert.equal(called, false);
});
