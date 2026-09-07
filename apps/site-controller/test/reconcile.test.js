'use strict';

/**
 * Tenant reconcile state machine — pure orchestration with injected apply/verify,
 * so the converge → verify → ACTIVE logic is tested without a cluster.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileClaim, isPermanentK8sError, claimToInput, statusPatch } = require('../src/reconcilers/tenant');

const claim = { tenantId: 7, plan: 'pro' };

test('apply ok + all boundary objects present → ACTIVE', async () => {
  const s = await reconcileClaim(claim, { apply: async () => {}, verify: async () => ({ present: true }) });
  assert.equal(s.state, 'ACTIVE');
});

test('apply ok + boundary not yet present → RECONCILING (retry)', async () => {
  const s = await reconcileClaim(claim, { apply: async () => {}, verify: async () => ({ present: false }) });
  assert.equal(s.state, 'RECONCILING');
  assert.equal(s.reason, 'VERIFY_PENDING');
});

test('permanent apply error → FAILED (no retry)', async () => {
  const apply = async () => { const e = new Error('invalid'); e.permanent = true; throw e; };
  const s = await reconcileClaim(claim, { apply, verify: async () => ({ present: true }) });
  assert.equal(s.state, 'FAILED');
  assert.equal(s.reason, 'ADMISSION_REJECTED');
});

test('transient apply error → RECONCILING (retry)', async () => {
  const apply = async () => { throw new Error('etimedout'); };
  const s = await reconcileClaim(claim, { apply, verify: async () => ({ present: true }) });
  assert.equal(s.state, 'RECONCILING');
  assert.equal(s.reason, 'APPLY_RETRY');
});

test('k8s error classification: 422/403/400 permanent, others transient', () => {
  assert.equal(isPermanentK8sError({ statusCode: 422 }), true);
  assert.equal(isPermanentK8sError({ statusCode: 403 }), true);
  assert.equal(isPermanentK8sError({ statusCode: 400 }), true);
  assert.equal(isPermanentK8sError({ statusCode: 503 }), false);
  assert.equal(isPermanentK8sError({ code: 'ETIMEDOUT' }), false);
});

test('claimToInput maps a TenantClaim CRD → reconcile input (strips the t- prefix)', () => {
  const crd = { metadata: { name: 't-abcd1234' }, spec: { tenantId: 't-abcd1234', plan: 'pro', generation: 2, operationId: 'op-1' } };
  const inp = claimToInput(crd);
  assert.equal(inp.name, 't-abcd1234');
  assert.equal(inp.tenantId, 'abcd1234');   // namespace becomes rb-t-abcd1234
  assert.equal(inp.plan, 'pro');
  assert.equal(inp.generation, 2);
  assert.equal(inp.operationId, 'op-1');
  assert.equal(inp.desiredState, 'ACTIVE'); // defaults
  assert.equal(inp.suspendMode, null);
  // suspended claim carries the mode through
  const s = claimToInput({ metadata: { name: 't-abcd1234' }, spec: { tenantId: 't-abcd1234', plan: 'pro', desiredState: 'SUSPENDED', suspendMode: 'WORKLOADS_STOPPED' } });
  assert.equal(s.desiredState, 'SUSPENDED');
  assert.equal(s.suspendMode, 'WORKLOADS_STOPPED');
});

// lifecycleFor moved to the workload reconciler (it owns runtime scaling) — tested in app.test.js.

test('statusPatch builds the status subresource body', () => {
  const p = statusPatch({ state: 'ACTIVE', reason: null }, 2);
  assert.equal(p.status.state, 'ACTIVE');
  assert.equal(p.status.observedGeneration, 2);
  assert.ok(p.status.updatedAt);
});
