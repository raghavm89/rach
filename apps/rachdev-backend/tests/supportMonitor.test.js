'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const support = require('../src/controllers/supportController');
const monitor = require('../src/controllers/agentMonitorController');

function mockRes() {
  return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
}

test('support controller exposes the ticket endpoints', () => {
  for (const m of ['createTicket', 'listTickets', 'getTicket', 'addMessage', 'updateTicket']) {
    assert.equal(typeof support[m], 'function', `missing ${m}`);
  }
});

test('createTicket 400s without a subject (no DB touched)', async () => {
  const res = mockRes();
  await support.createTicket({ user: { id: 1, tenant_id: 1 }, body: { body: 'x' } }, res);
  assert.equal(res.statusCode, 400);
});

test('updateTicket is support-only (403 for non-admin, no DB touched)', async () => {
  const res = mockRes();
  await support.updateTicket({ user: { id: 1, role: 'doctor', tenant_id: 1 }, params: { id: 1 }, body: { status: 'closed' } }, res);
  assert.equal(res.statusCode, 403);
});

test('agent monitor exposes overview', () => {
  assert.equal(typeof monitor.overview, 'function');
});

test('agent monitor returns an empty shape when the user has no tenant', async () => {
  const res = mockRes();
  await monitor.overview({ user: { id: 1, tenant_id: null } }, res);
  assert.equal(res.body.summary, null);
  assert.deepEqual(res.body.agents, []);
});
