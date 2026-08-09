'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const echs = require('../src/services/echs');
const abdm = require('../src/services/abdm');

test('ECHS eligibility (stub) is eligible when an ECHS number + valid dates exist', async () => {
  const r = await echs.verifyEligibility({ military: { echs_number: 'ECHS123', category: 'Army(ECHS)', validity_from: '2026-01-01', validity_to: '2030-01-01' } });
  assert.equal(r.eligible, true);
  assert.equal(r.cashless, true);
  assert.equal(r.source, 'stub');
  assert.equal(r.valid_to, '2030-01-01');
});

test('ECHS eligibility (stub) is ineligible with no number, and when expired', async () => {
  const none = await echs.verifyEligibility({ military: {} });
  assert.equal(none.eligible, false);
  assert.match(none.remarks, /No ECHS/);
  const expired = await echs.verifyEligibility({ military: { echs_number: 'X', validity_to: '2000-01-01' } });
  assert.equal(expired.eligible, false);
  assert.equal(expired.status, 'ineligible');
});

test('ECHS pre-auth (stub) auto-approves small low-risk claims, else pending', async () => {
  const ok = await echs.preAuth({ amount: 3300, denial_risk: 'low' });
  assert.equal(ok.status, 'approved');
  assert.match(ok.reference_id, /^ECHS-PA-/);
  const big = await echs.preAuth({ amount: 90000, denial_risk: 'low' });
  assert.equal(big.status, 'pending');
  const risky = await echs.preAuth({ amount: 1000, denial_risk: 'high' });
  assert.equal(risky.status, 'pending');
});

test('ABHA link (stub) yields a deterministic number + address', async () => {
  const a = await abdm.linkAbha({ uhid: 'UH000001', name: 'Test' });
  assert.equal(a.verified, true);
  assert.equal(a.abha_address, 'uh000001@sbx');
  assert.match(a.abha_number, /^\d{2}-\d{4}-\d{4}-\d{4}$/);
  // deterministic
  const b = await abdm.linkAbha({ uhid: 'UH000001', name: 'Test' });
  assert.equal(a.abha_number, b.abha_number);
});

test('seams report enabled=false without env config', () => {
  assert.equal(echs.enabled(), false);
  assert.equal(abdm.enabled(), false);
});

test('integrationsController exposes the endpoints and audits ECHS/ABHA', () => {
  const ctrl = require('../src/controllers/integrationsController');
  for (const m of ['verifyEligibility', 'latestEligibility', 'preAuth', 'linkAbha']) assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'integrationsController.js'), 'utf8');
  assert.match(src, /agent: 'Asha'/);   // eligibility + abha at intake
  assert.match(src, /agent: 'Rhea'/);   // pre-auth on the claim
});

test('075 migration adds ABHA columns + eligibility_checks', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', '075_integrations.sql'), 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS abha_number/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS eligibility_checks/);
  assert.match(sql, /kind/);
});
