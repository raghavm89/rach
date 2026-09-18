'use strict';

/**
 * convergeNamespaced — create-or-replace so per-tenant desired state (RBAC/quota/policies)
 * converges on reconcile instead of being frozen at first-create.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const arka = require('../src/cluster/arkaClient');

function fakeApi({ conflict } = {}) {
  const calls = { create: 0, read: 0, replace: 0, replacedBody: null };
  return {
    calls,
    createNamespacedRole: async () => {
      calls.create += 1;
      if (conflict) { const e = new Error('exists'); e.statusCode = 409; throw e; }
    },
    readNamespacedRole: async () => { calls.read += 1; return { metadata: { name: 'rb-workload', resourceVersion: '42' } }; },
    replaceNamespacedRole: async (name, ns, body) => { calls.replace += 1; calls.replacedBody = body; },
  };
}

test('convergeNamespaced: create path (no conflict) does not read or replace', async () => {
  const api = fakeApi({ conflict: false });
  await arka.convergeNamespaced({ rbac: api }, 'rbac', 'Role', 'rb-t-x', { metadata: { name: 'rb-workload' } });
  assert.equal(api.calls.create, 1);
  assert.equal(api.calls.read, 0);
  assert.equal(api.calls.replace, 0);
});

test('convergeNamespaced: on 409 it reads the live object and replaces, carrying resourceVersion', async () => {
  const api = fakeApi({ conflict: true });
  const manifest = { metadata: { name: 'rb-workload' }, rules: [{ apiGroups: ['networking.k8s.io'], resources: ['ingresses'] }] };
  await arka.convergeNamespaced({ rbac: api }, 'rbac', 'Role', 'rb-t-x', manifest);
  assert.equal(api.calls.create, 1);
  assert.equal(api.calls.read, 1);
  assert.equal(api.calls.replace, 1);
  // the desired rules are pushed, with the live resourceVersion carried in for a valid replace
  assert.equal(api.calls.replacedBody.metadata.resourceVersion, '42');
  assert.deepEqual(api.calls.replacedBody.rules, manifest.rules);
});

test('convergeNamespaced: a non-409 error is rethrown (not swallowed)', async () => {
  const api = fakeApi();
  api.createNamespacedRole = async () => { const e = new Error('boom'); e.statusCode = 500; throw e; };
  await assert.rejects(
    arka.convergeNamespaced({ rbac: api }, 'rbac', 'Role', 'rb-t-x', { metadata: { name: 'rb-workload' } }),
    /boom/
  );
});

// ── ingressPlan: an already-published Ingress must not regress to "deploying" ─────────────────
const H = 'test6.rachbase.app';

test('ingressPlan: self-ingress off → skip, ready', () => {
  assert.deepEqual(arka.ingressPlan({ selfIngress: false, host: H }), { action: 'skip', ingressReady: true });
});

test('ingressPlan: no/invalid host → delete stale route, ready', () => {
  assert.deepEqual(arka.ingressPlan({ selfIngress: true, host: '' }), { action: 'delete', ingressReady: true });
  assert.deepEqual(arka.ingressPlan({ selfIngress: true, host: 'not a host' }), { action: 'delete', ingressReady: true });
});

test('ingressPlan: not published + resolves → upsert, ready', () => {
  assert.deepEqual(arka.ingressPlan({ selfIngress: true, host: H, published: false, resolves: true }), { action: 'upsert', ingressReady: true });
});

test('ingressPlan: not published + does NOT resolve → defer, not ready', () => {
  assert.deepEqual(arka.ingressPlan({ selfIngress: true, host: H, published: false, resolves: false }), { action: 'defer', ingressReady: false });
});

test('ingressPlan: ALREADY published stays ready even when DNS re-check flaps (the bug fix)', () => {
  assert.deepEqual(arka.ingressPlan({ selfIngress: true, host: H, published: true, resolves: false }), { action: 'upsert', ingressReady: true });
});
