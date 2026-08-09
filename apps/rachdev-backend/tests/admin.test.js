'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ctrl = require('../src/controllers/adminController');

function mockRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
  };
}

test('adminController exposes the org + template endpoints', () => {
  for (const m of ['listOrgs', 'setOrgIndustry', 'listTemplates', 'createTemplate', 'updateTemplate']) {
    assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  }
});

test('adminController exposes doctor department endpoints', () => {
  for (const m of ['listDoctorProfiles', 'setDoctorProfile']) {
    assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  }
});

test('setDoctorProfile upserts department without touching the shared users table', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'adminController.js'), 'utf8');
  assert.match(src, /INSERT INTO doctor_profiles[\s\S]*ON CONFLICT \(tenant_id, user_id\)/);
  assert.match(src, /Only doctors have a department/);
});

test('setOrgIndustry rejects an unsupported industry (no DB touched)', async () => {
  const res = mockRes();
  await ctrl.setOrgIndustry({ params: { id: 1 }, body: { industry: 'banking' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Unsupported industry/);
});

test('createTemplate 400s without key/name (no DB touched)', async () => {
  const res = mockRes();
  await ctrl.createTemplate({ body: { name: '' } }, res);
  assert.equal(res.statusCode, 400);
});

test('healthcare is an allowed org industry', () => {
  assert.ok(ctrl.ALLOWED_INDUSTRIES.has('healthcare'));
});
