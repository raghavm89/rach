'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const inv = require('../src/services/inventory');

test('parsePrescription pulls quantity from #N / xN / qty N and matches a known drug', () => {
  const known = ['Metformin', 'Amoxicillin', 'Paracetamol'];
  assert.deepEqual(inv.parsePrescription('Metformin 500mg #30', known), { drug: 'Metformin', qty: 30 });
  assert.deepEqual(inv.parsePrescription('Amoxicillin x 21', known), { drug: 'Amoxicillin', qty: 21 });
  assert.deepEqual(inv.parsePrescription('paracetamol qty 10', known), { drug: 'Paracetamol', qty: 10 });
});

test('parsePrescription defaults qty to 1 and falls back to a token when unknown', () => {
  const out = inv.parsePrescription('Ibuprofen', []);
  assert.equal(out.drug, 'Ibuprofen');
  assert.equal(out.qty, 1);
});

test('suggestReorder brings stock above threshold (>= 1)', () => {
  assert.equal(inv.suggestReorder(2, 10), 18);   // 2*10 - 2
  assert.equal(inv.suggestReorder(10, 10), 10);  // target reached → at least threshold
  assert.ok(inv.suggestReorder(0, 0) >= 1);
});

test('buildAlertMessage reads naturally', () => {
  const msg = inv.buildAlertMessage({ drug: 'Metformin', quantity: 3, unit: 'tablet', threshold: 10, qty_suggested: 17 });
  assert.match(msg, /Metformin is low: 3 tablet left/);
  assert.match(msg, /Suggested reorder: 17 tablet/);
});

test('inventoryController exposes the endpoints', () => {
  const ctrl = require('../src/controllers/inventoryController');
  for (const m of ['listStock', 'upsertStock', 'dispense', 'restock', 'listAlerts', 'resolveAlert']) {
    assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  }
});

test('inventory migration creates the three tables', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', '057_inventory.sql'),
    'utf8',
  );
  assert.match(sql, /CREATE TABLE IF NOT EXISTS drug_stock/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS stock_transactions/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS reorder_alerts/);
});
