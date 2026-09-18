'use strict';

/**
 * Billing-profile persistence + the "GST for every Indian buyer" rule (6 Sep 2026).
 * Pure unit tests with a stubbed pool — no DB.
 *
 * The rule: an India-billed customer pays GST whether or not they give a GSTIN. GSTIN is
 * optional B2B detail. What enforces the rule end-to-end is (a) the checkout's typed
 * billing details being PERSISTED before pricing and (b) refusing to price for a buyer
 * whose country can't be resolved at all ("unknown" must never mean tax-free).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const bp = require('../src/services/billingProfile');

// Pool stub: serves a users row for SELECTs, records UPDATEs.
function poolWith(row) {
  const updates = [];
  return {
    updates,
    query: async (text, params) => {
      if (/^SELECT/i.test(text.trim())) return { rows: row ? [row] : [] };
      updates.push({ text, params });
      return { rows: [] };
    },
  };
}

test('persistForUser merges the typed address over the saved one and uppercases the GSTIN', async () => {
  const pool = poolWith({ billing_address: { line1: 'Old Lane', country: 'India', state: 'Karnataka' } });
  const out = await bp.persistForUser(7, { city: 'Bengaluru', pincode: '560001', gstin: '29abcde1234f1z5' }, { pool });
  assert.equal(out.updated, true);
  assert.equal(out.gstin, '29ABCDE1234F1Z5');
  // Merge: new keys added, absent keys (line1/country/state) preserved.
  assert.deepEqual(out.address, { line1: 'Old Lane', country: 'India', state: 'Karnataka', city: 'Bengaluru', pincode: '560001' });
  assert.equal(pool.updates.length, 1);
  assert.match(pool.updates[0].text, /gstin = \$3/);
});

test('persistForUser without a GSTIN still persists the address and never clears a saved GSTIN', async () => {
  const pool = poolWith({ billing_address: {} });
  const out = await bp.persistForUser(7, { country: 'India', state: 'Maharashtra', city: 'Mumbai' }, { pool });
  assert.equal(out.updated, true);
  assert.equal(out.gstin, null);
  assert.ok(!/gstin/.test(pool.updates[0].text)); // gstin column untouched
});

test('persistForUser rejects a malformed GSTIN with 400 invalid_gstin', async () => {
  const pool = poolWith({ billing_address: {} });
  await assert.rejects(
    bp.persistForUser(7, { country: 'India', gstin: 'NOT-A-GSTIN' }, { pool }),
    (err) => {
      assert.equal(err.status, 400);
      assert.equal(err.code, 'invalid_gstin');
      assert.match(err.message, /GST applies either way/);
      return true;
    },
  );
  assert.equal(pool.updates.length, 0); // nothing written
});

test('persistForUser is a no-op for an empty/absent payload (falls back to the saved profile)', async () => {
  const pool = poolWith({ billing_address: { country: 'India' } });
  assert.deepEqual(await bp.persistForUser(7, undefined, { pool }), { updated: false });
  assert.deepEqual(await bp.persistForUser(7, { junk: 'x', line1: '' }, { pool }), { updated: false });
  assert.equal(pool.updates.length, 0);
});

test('assertBillableCountry: India address WITHOUT a GSTIN resolves to IN — GST applies, GSTIN optional', async () => {
  const pool = poolWith({ gstin: null, billing_address: { country: 'India', state: 'Karnataka' } });
  const buyer = await bp.assertBillableCountry(7, { pool });
  assert.equal(buyer.country_code, 'IN');
  assert.equal(buyer.gstin, null);
});

test('assertBillableCountry: a GSTIN alone also resolves to IN', async () => {
  const pool = poolWith({ gstin: '29ABCDE1234F1Z5', billing_address: {} });
  const buyer = await bp.assertBillableCountry(7, { pool });
  assert.equal(buyer.country_code, 'IN');
});

test('assertBillableCountry REFUSES an unresolvable country — unknown must never mean tax-free', async () => {
  const pool = poolWith({ gstin: null, billing_address: {} });
  await assert.rejects(
    bp.assertBillableCountry(7, { pool }),
    (err) => {
      assert.equal(err.status, 400);
      assert.equal(err.code, 'billing_country_required');
      return true;
    },
  );
});

test('normalizeBilling keeps only known non-empty string fields (and trims them)', () => {
  const norm = bp.normalizeBilling({
    country: '  India ', city: 'Pune', junk: 'drop-me', pincode: 42, line1: '', gstin: ' 29abcde1234f1z5 ',
  });
  assert.deepEqual(norm.address, { country: 'India', city: 'Pune' });
  assert.equal(norm.gstin, '29ABCDE1234F1Z5');
});
