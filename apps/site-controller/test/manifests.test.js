'use strict';

/**
 * Hardening baseline is enforced by construction — pure renderer tests, no cluster.
 * These lock the §9 security controls so they can't silently regress.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/renderers/manifests');
const { requestHash, canonicalJson } = require('@rach/site-contracts');
const tenantReconciler = require('../src/reconcilers/tenant');

test('namespace enforces Pod Security Standards: restricted', () => {
  const ns = M.namespaceManifest(7);
  assert.equal(ns.metadata.name, 'rb-t-7');
  assert.equal(ns.metadata.labels['pod-security.kubernetes.io/enforce'], 'restricted');
  assert.equal(ns.metadata.labels['rachbase.io/tenant'], '7');
});

test('deployment applies the full hardening baseline + runs as the tokenless runtime SA', () => {
  const d = M.deploymentManifest({ tenantId: 7, name: 'demo', image: 'x:1', port: 8080 });
  const pod = d.spec.template.spec;
  assert.equal(pod.securityContext.runAsNonRoot, true);
  assert.equal(pod.securityContext.seccompProfile.type, 'RuntimeDefault');
  assert.equal(pod.automountServiceAccountToken, false);
  assert.equal(pod.serviceAccountName, 'rb-runtime');

  const c = pod.containers[0];
  assert.equal(c.securityContext.allowPrivilegeEscalation, false);
  assert.equal(c.securityContext.readOnlyRootFilesystem, true);
  assert.deepEqual(c.securityContext.capabilities.drop, ['ALL']);
  assert.deepEqual(c.resources.requests, c.resources.limits); // guaranteed QoS

  // Writable scratch dirs (bounded emptyDir) so apps can write under the read-only rootfs.
  const tmp = c.volumeMounts.find((m) => m.mountPath === '/tmp');
  assert.ok(tmp, '/tmp is mounted writable');
  const vol = pod.volumes.find((v) => v.name === tmp.name);
  assert.ok(vol.emptyDir, '/tmp backed by emptyDir');
  assert.equal(vol.emptyDir.sizeLimit, '1Gi'); // bounded
  assert.ok(c.volumeMounts.some((m) => m.mountPath === '/var/tmp'));
});

test('owner annotation tags the workload + service for differentiation (opt-in)', () => {
  const none = M.deploymentManifest({ tenantId: 7, name: 'demo', image: 'x:1' });
  assert.equal(none.metadata.annotations, undefined); // no owner → no annotation

  const d = M.deploymentManifest({ tenantId: 7, name: 'demo', image: 'x:1', owner: 'alice', runtime: 'nodejs-22' });
  assert.equal(d.metadata.annotations['rachbase.io/created-by'], 'alice');
  assert.equal(d.metadata.annotations['rachbase.io/runtime'], 'nodejs-22'); // §7.1 runtime recorded
  assert.equal(d.spec.template.metadata.annotations['rachbase.io/created-by'], 'alice');
  const s = M.serviceManifest({ tenantId: 7, name: 'demo', owner: 'alice' });
  assert.equal(s.metadata.annotations['rachbase.io/created-by'], 'alice');
});

test('env → envFrom Secret (not inline); run command absent → image default', () => {
  const bare = M.deploymentManifest({ tenantId: 7, name: 'demo', image: 'x:1' }).spec.template.spec.containers[0];
  assert.equal(bare.command, undefined); // no run command → image's ENTRYPOINT/CMD runs
  assert.equal(bare.env, undefined);
  assert.equal(bare.envFrom, undefined);

  const c = M.deploymentManifest({
    tenantId: 7, name: 'demo', image: 'x:1',
    command: ['sh', '-c', 'npm start'],
    env: [{ name: 'API', value: 'y' }, { name: 'PORT', value: 3000 }, { bad: true }],
  }).spec.template.spec.containers[0];
  assert.deepEqual(c.command, ['sh', '-c', 'npm start']);
  assert.equal(c.env, undefined); // NOT inline
  assert.deepEqual(c.envFrom, [{ secretRef: { name: 'demo-env' } }]);

  // Pod template carries an env checksum so a changed env rolls the Deployment; absent env → none.
  const dep = (envv) => M.deploymentManifest({ tenantId: 7, name: 'demo', image: 'x:1', env: envv });
  const sum = (d) => d.spec.template.metadata.annotations?.['rachbase.io/env-checksum'];
  assert.equal(sum(dep(undefined)), undefined);
  assert.ok(sum(dep([{ name: 'A', value: '1' }])));
  assert.notEqual(sum(dep([{ name: 'A', value: '1' }])), sum(dep([{ name: 'A', value: '2' }]))); // value change → new checksum

  // a plain string command is wrapped as a shell exec form
  const strCmd = M.deploymentManifest({ tenantId: 7, name: 'demo', image: 'x:1', command: 'node index.js' }).spec.template.spec.containers[0];
  assert.deepEqual(strCmd.command, ['sh', '-c', 'node index.js']);
});

test('envSecretManifest builds a per-app Opaque Secret (junk dropped, values stringified); null when empty', () => {
  assert.equal(M.envSecretManifest({ tenantId: 7, name: 'demo', env: [] }), null);
  assert.equal(M.envSecretManifest({ tenantId: 7, name: 'demo' }), null);
  const s = M.envSecretManifest({ tenantId: 7, name: 'demo', env: [{ name: 'API', value: 'y' }, { name: 'PORT', value: 3000 }, { bad: true }] });
  assert.equal(s.kind, 'Secret');
  assert.equal(s.type, 'Opaque');
  assert.equal(s.metadata.name, 'demo-env');
  assert.equal(s.metadata.namespace, 'rb-t-7');
  assert.deepEqual(s.stringData, { API: 'y', PORT: '3000' });
});

test('tokenless runtime ServiceAccount (no auto-mounted token)', () => {
  const sa = M.serviceAccountManifest(7);
  assert.equal(sa.kind, 'ServiceAccount');
  assert.equal(sa.metadata.name, 'rb-runtime');
  assert.equal(sa.metadata.namespace, 'rb-t-7');
  assert.equal(sa.automountServiceAccountToken, false);
});

test('workload Role is namespace-scoped (deployments/services/pods + app-env secrets, no exec/wildcard)', () => {
  const role = M.workloadRoleManifest(7);
  assert.equal(role.metadata.namespace, 'rb-t-7'); // namespace-scoped (not a ClusterRole)
  const resources = role.rules.flatMap((r) => r.resources);
  assert.deepEqual([...new Set(resources)].sort(), ['deployments', 'ingresses', 'pods', 'secrets', 'services']);
  const verbs = role.rules.flatMap((r) => r.verbs);
  assert.ok(!verbs.includes('*') && !verbs.some((v) => v.includes('exec')));

  const rb = M.workloadRoleBindingManifest(7);
  assert.equal(rb.roleRef.name, 'rb-workload');
  assert.equal(rb.subjects[0].kind, 'ServiceAccount');
  assert.equal(rb.subjects[0].name, M.WORKLOAD_SA);
  assert.equal(rb.subjects[0].namespace, M.CONTROLLER_NS);
});

test('default-deny network policy denies ingress + egress', () => {
  const np = M.defaultDenyNetworkPolicyManifest(7);
  assert.deepEqual(np.spec.podSelector, {});
  assert.deepEqual(np.spec.policyTypes, ['Ingress', 'Egress']);
});

test('resource quota caps cpu / memory / pods', () => {
  const q = M.resourceQuotaManifest(7, { cpu: '2', memory: '2Gi', pods: 10 });
  assert.equal(q.spec.hard['limits.cpu'], '2');
  assert.equal(q.spec.hard['limits.memory'], '2Gi');
  assert.equal(q.spec.hard.pods, '10');
});

test('canonical hashing is order-independent on object keys, order-sensitive on arrays', () => {
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
  const base = { method: 'PUT', route: '/v1/tenants/t-1', siteId: 'site1', tenantId: 't-1', body: { plan: 'pro' } };
  assert.equal(
    requestHash(base),
    requestHash({ ...base, body: { plan: 'pro' } }),
    'same canonical request → same hash',
  );
  assert.notEqual(requestHash(base), requestHash({ ...base, body: { plan: 'free' } }));
});

test('tenant reconciler renders the full boundary (policies + SA + workload RBAC), quota from plan', () => {
  const objs = tenantReconciler.desired({ tenantId: 7, plan: 'pro' });
  assert.deepEqual(objs.map((o) => o.kind),
    ['Namespace', 'ResourceQuota', 'LimitRange', 'NetworkPolicy', 'NetworkPolicy', 'NetworkPolicy', 'NetworkPolicy', 'ServiceAccount', 'Role', 'RoleBinding', 'ConfigMap']);
  assert.deepEqual(objs.filter((o) => o.kind === 'NetworkPolicy').map((o) => o.metadata.name),
    ['default-deny', 'allow-dns', 'allow-gateway-ingress', 'allow-egress']);
  const quota = objs.find((o) => o.kind === 'ResourceQuota');
  assert.equal(quota.spec.hard['limits.cpu'], '1');        // pro plan
  assert.equal(quota.spec.hard['limits.memory'], '1024Mi');
  assert.throws(() => tenantReconciler.desired({ tenantId: 7, plan: 'nope' }));
});

test('registry boundary is an opaque, credential-free ConfigMap reference (§9.5 step 9)', () => {
  const cm = M.registryBoundaryManifest(7);
  assert.equal(cm.kind, 'ConfigMap');
  assert.equal(cm.metadata.name, 'tenant-registry');
  assert.equal(cm.data.ref, 'reg-7');
  assert.equal(JSON.stringify(cm).toLowerCase().includes('password'), false); // no creds
});

test('build boundary (§9.5 step 8): separate namespace, minimal build Role, reconciler SA binding', () => {
  const objs = M.buildObjects(7, { cpu: '2', memory: '2Gi' });
  assert.deepEqual(objs.map((o) => o.kind),
    ['Namespace', 'ResourceQuota', 'LimitRange', 'NetworkPolicy', 'ServiceAccount', 'Role', 'RoleBinding']);
  assert.equal(objs[0].metadata.name, 'rb-b-7'); // separate build namespace
  const role = objs.find((o) => o.kind === 'Role');
  const resources = role.rules.flatMap((r) => r.resources);
  assert.deepEqual([...new Set(resources)].sort(), ['jobs', 'pods']);
  assert.ok(!resources.includes('secrets'));
  const rb = objs.find((o) => o.kind === 'RoleBinding');
  assert.equal(rb.subjects[0].name, M.BUILD_SA);
  assert.equal(rb.subjects[0].namespace, M.CONTROLLER_NS);
});

test('network policies: DNS egress, gateway-only ingress, entitled egress denies cluster/metadata', () => {
  const dns = M.allowDnsNetworkPolicyManifest(7);
  assert.deepEqual(dns.spec.policyTypes, ['Egress']);
  assert.deepEqual(dns.spec.egress[0].ports.map((p) => p.port), [53, 53]);

  const ing = M.allowGatewayIngressNetworkPolicyManifest(7);
  assert.deepEqual(ing.spec.policyTypes, ['Ingress']);
  assert.ok(ing.spec.ingress[0].from[0].namespaceSelector); // only from the gateway namespace

  const eg = M.allowEgressNetworkPolicyManifest(7);
  const except = eg.spec.egress[0].to[0].ipBlock.except;
  assert.equal(eg.spec.egress[0].to[0].ipBlock.cidr, '0.0.0.0/0');
  assert.ok(except.includes('169.254.0.0/16')); // cloud metadata denied
  assert.ok(except.includes('10.0.0.0/8'));      // cluster-internal denied
});
