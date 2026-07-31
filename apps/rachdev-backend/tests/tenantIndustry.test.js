'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ctrl = require('../src/controllers/tenantController');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
  };
}

test('exposes the workspace endpoints', () => {
  assert.equal(typeof ctrl.getMyTenant, 'function');
  assert.equal(typeof ctrl.setIndustry, 'function');
});

test('healthcare is an allowed workspace industry', () => {
  assert.ok(ctrl.ALLOWED_INDUSTRIES.has('healthcare'));
});

test('setIndustry rejects an unsupported industry (no DB touched)', async () => {
  const res = mockRes();
  await ctrl.setIndustry({ user: { tenant_id: 1 }, body: { industry: 'banking' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Unsupported industry/);
});

test('setIndustry 400s when the account has no tenant', async () => {
  const res = mockRes();
  await ctrl.setIndustry({ user: { tenant_id: null }, body: { industry: 'healthcare' } }, res);
  assert.equal(res.statusCode, 400);
});

test('getMyTenant returns a null tenant when the account has none', async () => {
  const res = mockRes();
  await ctrl.getMyTenant({ user: { tenant_id: null } }, res);
  assert.deepEqual(res.body, { tenant: null });
});
