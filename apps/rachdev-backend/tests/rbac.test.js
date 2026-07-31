'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { authorize } = require('@rach/identity');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('authorize() calls next when the role is permitted', () => {
  const mw = authorize('tenant_admin', 'admin');
  const res = mockRes();
  let called = false;
  mw({ user: { role: 'tenant_admin' } }, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.statusCode, null);
});

test('authorize() 403s when the role is not permitted', () => {
  const mw = authorize('tenant_admin', 'admin');
  const res = mockRes();
  let called = false;
  mw({ user: { role: 'doctor' } }, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
});

test('the new clinical roles work with authorize()', () => {
  const mw = authorize('doctor', 'reception', 'store_manager');
  for (const role of ['doctor', 'reception', 'store_manager']) {
    const res = mockRes();
    let called = false;
    mw({ user: { role } }, res, () => { called = true; });
    assert.equal(called, true, `role ${role} should be permitted`);
  }
});
