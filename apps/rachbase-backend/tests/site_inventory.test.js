'use strict';

/**
 * Inventory reconcile (drift repair) — pure/unit tests (no DB). `list`/`reassert` are
 * injected; the drift decision is pure. The DB scan (listPlacedTenants) + txn
 * re-assert run locally against Postgres after migrations 097/098.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const R = require('../src/services/siteInventoryReconcile');

const NOW = Date.parse('2026-08-21T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

test('isDrifted: unplaced tenants are never drifted', () => {
  assert.equal(R.isDrifted({ site_tenant_ref: null, op_state: null }, { now: NOW }), false);
});

test('isDrifted: a missing operation (missed callback) is drift', () => {
  assert.equal(R.isDrifted({ site_tenant_ref: 't-1', op_state: null }, { now: NOW }), true);
});

test('isDrifted: SUCCEEDED is healthy, FAILED is drift', () => {
  assert.equal(R.isDrifted({ site_tenant_ref: 't-1', op_state: 'SUCCEEDED', op_updated_at: ago(0) }, { now: NOW }), false);
  assert.equal(R.isDrifted({ site_tenant_ref: 't-1', op_state: 'FAILED', op_updated_at: ago(0) }, { now: NOW }), true);
});

test('isDrifted: in-flight is healthy while fresh, drift once stuck past the window', () => {
  const staleMs = 15 * 60 * 1000;
  assert.equal(R.isDrifted({ site_tenant_ref: 't-1', op_state: 'RECONCILING', op_updated_at: ago(60 * 1000) }, { now: NOW, staleMs }), false);
  assert.equal(R.isDrifted({ site_tenant_ref: 't-1', op_state: 'RECONCILING', op_updated_at: ago(30 * 60 * 1000) }, { now: NOW, staleMs }), true);
  assert.equal(R.isDrifted({ site_tenant_ref: 't-1', op_state: 'ACCEPTED', op_updated_at: ago(30 * 60 * 1000) }, { now: NOW, staleMs }), true);
});

test('isDrifted: CANCELLED/BLOCKED are left alone (human decision)', () => {
  assert.equal(R.isDrifted({ site_tenant_ref: 't-1', op_state: 'CANCELLED', op_updated_at: ago(60 * 60 * 1000) }, { now: NOW }), false);
  assert.equal(R.isDrifted({ site_tenant_ref: 't-1', op_state: 'BLOCKED', op_updated_at: ago(60 * 60 * 1000) }, { now: NOW }), false);
});

test('reconcileOnce re-asserts only drifted tenants and counts repairs', async () => {
  const rows = [
    { id: 1, plan: 'pro', site_id: 'site1', site_tenant_ref: 't-aaaaaaaa', op_state: 'SUCCEEDED', op_updated_at: ago(0) },      // healthy
    { id: 2, plan: 'pro', site_id: 'site1', site_tenant_ref: 't-bbbbbbbb', op_state: null },                                    // missed callback
    { id: 3, plan: 'max', site_id: 'site1', site_tenant_ref: 't-cccccccc', op_state: 'FAILED', op_updated_at: ago(0) },         // failed
    { id: 4, plan: 'pro', site_id: 'site1', site_tenant_ref: 't-dddddddd', op_state: 'RECONCILING', op_updated_at: ago(1000) }, // fresh in-flight
  ];
  const reasserted = [];
  const out = await R.reconcileOnce({
    list: async () => rows,
    reassert: async (row) => reasserted.push(row.id),
    now: NOW,
  });
  assert.deepEqual(reasserted, [2, 3]);
  assert.deepEqual(out, { scanned: 4, repaired: 2 });
});

test('reconcileOnce keeps going when one re-assert throws', async () => {
  const rows = [
    { id: 5, plan: 'pro', site_id: 'site1', site_tenant_ref: 't-eeeeeeee', op_state: 'FAILED', op_updated_at: ago(0) },
    { id: 6, plan: 'pro', site_id: 'site1', site_tenant_ref: 't-ffffffff', op_state: null },
  ];
  const ok = [];
  const out = await R.reconcileOnce({
    list: async () => rows,
    reassert: async (row) => { if (row.id === 5) throw new Error('boom'); ok.push(row.id); },
    now: NOW,
  });
  assert.deepEqual(ok, [6]);
  assert.equal(out.repaired, 1); // only the successful one counts
});
