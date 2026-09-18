'use strict';

/**
 * BFF outbox + tenant mapping — pure/unit tests (no DB). DB integration
 * (enqueue/claim SKIP-LOCKED against real Postgres) runs locally after migration 096.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { backoffMs } = require('../src/services/siteOutbox');
const { buildDelivery, dryRunTransport } = require('../src/services/siteClient');
const { enqueueTenantReconcile } = require('../src/services/siteTenant');

test('backoff grows and stays bounded (0.5s..90s)', () => {
  for (let a = 0; a < 12; a++) {
    const b = backoffMs(a);
    assert.ok(b >= 500 && b <= 90000, `attempt ${a} → ${b}`);
  }
});

test('buildDelivery computes hash + idempotency key + carries the payload', () => {
  const d = buildDelivery({ operationId: 'op-1', method: 'PUT', route: '/v1/tenants/t-abcd1234', tenantId: 't-abcd1234', body: { plan: 'pro' } });
  assert.match(d.requestHash, /^[a-f0-9]{64}$/);
  assert.ok(d.idempotencyKey && d.requestId);
  assert.equal(d.method, 'PUT');
  assert.deepEqual(d.payload, { plan: 'pro' });
});

test('enqueueTenantReconcile writes operation + outbox in the given txn and returns 202 envelope', async () => {
  const calls = [];
  const txClient = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };

  const res = await enqueueTenantReconcile(txClient, {
    tenantRef: 't-abcd1234', tenantId: 7, siteId: 'site1', customerRef: 'c-1', plan: 'pro',
  });

  assert.equal(res.state, 'ACCEPTED');
  assert.match(res.operationId, /^op-/);
  assert.equal(res.resourceId, 't-abcd1234');
  assert.equal(res.statusUrl, `/v1/operations/${res.operationId}`);
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /INSERT INTO site_operations/);
  assert.match(calls[1].sql, /INSERT INTO site_outbox/);
});

test('dry-run transport acknowledges (drains the outbox without SpaceArk creds)', async () => {
  const r = await dryRunTransport({ method: 'PUT', route: '/v1/tenants/t-1', idempotency_key: 'k' });
  assert.equal(r.ack, true);
});
