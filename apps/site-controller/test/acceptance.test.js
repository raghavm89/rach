'use strict';

/**
 * Acceptance / security test-gates (§10). Certifies the SHIPPED artifacts without a cluster:
 *   - hostile-RBAC   — no wildcard/exec/cluster-secret/cluster-admin grants in the deploy RBAC
 *   - admission PSS  — every rendered workload + the controller's own pods meet restricted PSS
 *   - CRD schema     — the App/Release/TenantClaim schemas declare every field the BFF sends
 *   - secret hygiene — app env is never inline in the pod spec; the api facade has no secrets
 *   - determinism    — the canonical request hash is order-independent (BFF ↔ controller agree)
 *
 * (JWT auth valid/expired/wrong-aud/replay + idempotency new/replay/conflict are gated in
 * api.test.js.) The LIVE-cluster gates — 2 replicas, leader-election failover, node-disruption,
 * zero-BFF-creds — are the runbook in deploy/ACCEPTANCE.md.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const M = require('../src/renderers/manifests');
const { requestHash } = require('@rach/site-contracts');

const deploy = (f) => yaml.loadAll(fs.readFileSync(path.join(__dirname, '..', 'deploy', f), 'utf8')).filter(Boolean);
const rbacDocs = (docs) => docs.filter((d) => d.kind === 'Role' || d.kind === 'ClusterRole');
const allRules = (docs) => rbacDocs(docs).flatMap((d) => d.rules || []);

// ── Hostile-RBAC ────────────────────────────────────────────────────────────────
test('gate: rendered per-tenant Roles have no wildcard / exec / escalate / bind', () => {
  for (const role of [M.workloadRoleManifest(7), M.buildRoleManifest(7)]) {
    assert.equal(role.kind, 'Role');            // namespaced, NOT a ClusterRole
    assert.match(role.metadata.namespace, /^rb-[tb]-7$/); // in the tenant/build namespace only
    for (const r of role.rules) {
      assert.ok(!r.resources.includes('*'), 'no wildcard resources');
      assert.ok(!r.verbs.includes('*'), 'no wildcard verbs');
      assert.ok(!r.verbs.some((v) => ['escalate', 'bind', 'impersonate'].includes(v)), 'no privilege-escalation verbs');
      assert.ok(!r.resources.some((res) => res.includes('exec') || res.includes('attach')), 'no exec/attach');
    }
  }
});

test('gate: deploy RBAC grants no wildcard, no cluster-admin, no cluster-wide secrets', () => {
  for (const file of ['site-controller.yaml', 'site-controller-all-in-one.yaml']) {
    const docs = deploy(file);
    for (const r of allRules(docs)) {
      assert.ok(!(r.resources || []).includes('*'), `${file}: no wildcard resources`);
      assert.ok(!(r.verbs || []).includes('*'), `${file}: no wildcard verbs`);
    }
    // No ClusterRole grants secrets (secrets are namespace-scoped in the per-tenant Role only).
    for (const cr of docs.filter((d) => d.kind === 'ClusterRole')) {
      for (const r of cr.rules || []) assert.ok(!(r.resources || []).includes('secrets'), `${file}: no cluster-wide secrets`);
    }
    // No binding to a cluster-admin / edit / admin built-in.
    for (const b of docs.filter((d) => d.kind === 'ClusterRoleBinding' || d.kind === 'RoleBinding')) {
      assert.ok(!['cluster-admin', 'admin', 'edit'].includes(b.roleRef.name), `${file}: no built-in admin binding`);
    }
  }
});

test('gate: split-mode api facade Role touches ONLY the request CRDs (no namespaces/workloads/secrets)', () => {
  const apiRole = deploy('site-controller.yaml').find((d) => d.kind === 'Role' && d.metadata.name === 'site-controller-api');
  assert.ok(apiRole, 'api Role present');
  const groups = new Set(apiRole.rules.flatMap((r) => r.apiGroups));
  assert.deepEqual([...groups], ['rachbase.io']); // request CRDs only
  const resources = apiRole.rules.flatMap((r) => r.resources);
  assert.ok(!resources.some((r) => ['secrets', 'namespaces', 'deployments', 'pods', 'services'].includes(r)));
});

// ── Admission / restricted Pod Security ─────────────────────────────────────────
function assertHardenedPod(podSpec, where) {
  assert.equal(podSpec.securityContext.runAsNonRoot, true, `${where}: runAsNonRoot`);
  assert.equal(podSpec.hostNetwork ?? false, false, `${where}: no hostNetwork`);
  assert.equal(podSpec.hostPID ?? false, false, `${where}: no hostPID`);
  assert.equal(podSpec.hostIPC ?? false, false, `${where}: no hostIPC`);
  for (const c of podSpec.containers) {
    assert.equal(c.securityContext.allowPrivilegeEscalation, false, `${where}: no privesc`);
    assert.equal(c.securityContext.readOnlyRootFilesystem, true, `${where}: read-only rootfs`);
    assert.notEqual(c.securityContext.privileged, true, `${where}: not privileged`);
    assert.deepEqual(c.securityContext.capabilities.drop, ['ALL'], `${where}: drop ALL caps`);
  }
}

test('gate: rendered tenant workload pod is restricted-PSS + guaranteed QoS + tokenless SA', () => {
  const pod = M.deploymentManifest({ tenantId: 7, name: 'demo', image: 'x:1' }).spec.template.spec;
  assertHardenedPod(pod, 'workload');
  assert.equal(pod.securityContext.seccompProfile.type, 'RuntimeDefault');
  assert.equal(pod.automountServiceAccountToken, false);
  const c = pod.containers[0];
  assert.deepEqual(c.resources.requests, c.resources.limits); // guaranteed QoS
});

test('gate: the controller\'s own Deployments run hardened (both topologies)', () => {
  for (const file of ['site-controller.yaml', 'site-controller-all-in-one.yaml']) {
    for (const d of deploy(file).filter((x) => x.kind === 'Deployment')) {
      assertHardenedPod(d.spec.template.spec, `${file}/${d.metadata.name}`);
    }
  }
});

// ── CRD schema completeness (structural schemas must declare every field we send) ──
test('gate: App CRD schema declares every field the BFF sends', () => {
  const crd = deploy('crds/app.yaml')[0];
  const props = crd.spec.versions[0].schema.openAPIV3Schema.properties.spec.properties;
  for (const f of ['tenantId', 'appId', 'image', 'runtime', 'port', 'host', 'env', 'command', 'resources', 'desiredState']) {
    assert.ok(props[f], `App spec.${f} declared`);
  }
  assert.equal(props.env.items.properties.name.type, 'string');
});

test('gate: Release + TenantClaim CRDs declare their deploy sources / lifecycle', () => {
  const rel = deploy('crds/release.yaml')[0].spec.versions[0].schema.openAPIV3Schema.properties.spec.properties;
  for (const f of ['source', 'externalImage', 'image']) assert.ok(rel[f], `Release spec.${f}`);
  const tc = deploy('crds/tenantclaim.yaml')[0].spec.versions[0].schema.openAPIV3Schema.properties.spec.properties;
  assert.ok(tc.desiredState.enum.includes('SUSPENDED') && tc.desiredState.enum.includes('DELETED'));
});

// ── Secret hygiene ──────────────────────────────────────────────────────────────
test('gate: app env is never inline in the pod spec (envFrom Secret only)', () => {
  const c = M.deploymentManifest({ tenantId: 7, name: 'demo', image: 'x:1', env: [{ name: 'TOKEN', value: 'sensitive' }] }).spec.template.spec.containers[0];
  assert.equal(c.env, undefined);
  assert.deepEqual(c.envFrom, [{ secretRef: { name: 'demo-env' } }]);
  // and the value must not leak into any annotation/label (only a checksum is stamped)
  const dep = JSON.stringify(M.deploymentManifest({ tenantId: 7, name: 'demo', image: 'x:1', env: [{ name: 'TOKEN', value: 'sensitive' }] }));
  assert.ok(!dep.includes('sensitive'), 'secret value not present anywhere in the Deployment');
});

// ── Determinism ─────────────────────────────────────────────────────────────────
test('gate: request hash is canonical (order-independent) so BFF and controller agree', () => {
  const base = { method: 'PUT', route: '/v1/tenants/t-abcd1234', siteId: 'site1', partnerId: 'rachbase-bff', tenantId: 't-abcd1234' };
  const h1 = requestHash({ ...base, body: { plan: 'pro', generation: 1, customerRef: 'c1' } });
  const h2 = requestHash({ ...base, body: { customerRef: 'c1', generation: 1, plan: 'pro' } });
  assert.equal(h1, h2);
  assert.notEqual(h1, requestHash({ ...base, body: { plan: 'enterprise', generation: 1, customerRef: 'c1' } }));
});
