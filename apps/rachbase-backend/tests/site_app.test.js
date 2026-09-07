'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { enqueueAppUpsert, enqueueRelease } = require('../src/services/siteApp');

const mockTx = () => { const calls = []; return { calls, query: async (sql) => { calls.push(sql); return { rows: [] }; } }; };

test('enqueueAppUpsert writes op + outbox and returns a 202 envelope', async () => {
  const tx = mockTx();
  const r = await enqueueAppUpsert(tx, { tenantRef: 't-abcd1234', appId: 'a-web12345', tenantId: 7, siteId: 'site1', image: 'reg/img@sha256:x' });
  assert.equal(r.state, 'ACCEPTED');
  assert.match(r.operationId, /^op-/);
  assert.equal(r.resourceId, 'a-web12345');
  assert.equal(tx.calls.length, 2);
  assert.match(tx.calls[0], /INSERT INTO site_operations/);
  assert.match(tx.calls[1], /INSERT INTO site_outbox/);
});

test('enqueueRelease writes op + outbox', async () => {
  const tx = mockTx();
  const r = await enqueueRelease(tx, { tenantRef: 't-abcd1234', appId: 'a-web12345', tenantId: 7, siteId: 'site1', image: 'reg/img@sha256:x', deploymentId: 'd-1' });
  assert.equal(r.state, 'ACCEPTED');
  assert.equal(tx.calls.length, 2);
});
