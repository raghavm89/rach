'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('opdController exposes patient + visit endpoints', () => {
  const ctrl = require('../src/controllers/opdController');
  for (const m of ['searchPatients', 'upsertPatient', 'getPatient', 'listDoctors', 'createVisit', 'listVisits', 'updateVisit']) {
    assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  }
});

test('upsertPatient 400s without a name (no DB touched)', async () => {
  const ctrl = require('../src/controllers/opdController');
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
  await ctrl.upsertPatient({ user: { tenant_id: 1 }, body: {} }, res);
  assert.equal(res.statusCode, 400);
});

test('createVisit 400s without patient_id (no DB touched)', async () => {
  const ctrl = require('../src/controllers/opdController');
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
  await ctrl.createVisit({ user: { tenant_id: 1, id: 1 }, body: {} }, res);
  assert.equal(res.statusCode, 400);
});

test('dhanvantri seam is present and disabled by default', () => {
  const d = require('../src/services/dhanvantri');
  assert.equal(typeof d.enabled, 'function');
  assert.equal(d.enabled(), false);
});

test('opd migration creates patients + visits with source_system', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', '058_opd_reception.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS patients/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS visits/);
  assert.match(sql, /source_system/);
  assert.match(sql, /external_id/);
});
