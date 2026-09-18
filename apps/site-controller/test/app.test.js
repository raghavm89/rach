'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../src/reconcilers/workload');
const build = require('../src/reconcilers/build');
const { handleAppPut, handleReleasePost, handleAppDelete, handleTenantSuspend, handleTenantResume } = require('../src/api/facade');
const { createIdempotencyStore } = require('../src/api/idempotency');

test('workload.desired renders a hardened Deployment + Service from the image', () => {
  const objs = W.desired({ tenantId: 'abcd1234', appId: 'a-web12345', image: 'reg/img@sha256:x', port: 8080 });
  assert.deepEqual(objs.map((o) => o.kind), ['Deployment', 'Service']);
  const c = objs[0].spec.template.spec.containers[0];
  assert.equal(c.image, 'reg/img@sha256:x');
  assert.equal(c.securityContext.readOnlyRootFilesystem, true);
  assert.deepEqual(c.securityContext.capabilities.drop, ['ALL']);
});

test('workload.appToInput strips t- and maps fields (desiredState defaults ACTIVE)', () => {
  const i = W.appToInput({ metadata: { name: 'a-web12345' }, spec: { tenantId: 't-abcd1234', appId: 'a-web12345', image: 'x', port: 9000, generation: 2 } });
  assert.equal(i.tenantId, 'abcd1234');
  assert.equal(i.appId, 'a-web12345');
  assert.equal(i.port, 9000);
  assert.equal(i.desiredState, 'ACTIVE');
  const del = W.appToInput({ metadata: { name: 'a-web12345' }, spec: { tenantId: 't-abcd1234', appId: 'a-web12345', desiredState: 'DELETED' } });
  assert.equal(del.desiredState, 'DELETED');
});

test('workload.lifecycleFor: suspend only for WORKLOADS_STOPPED/SECURITY_ISOLATED; else run', () => {
  assert.deepEqual(W.lifecycleFor({ desiredState: 'SUSPENDED', suspendMode: 'WORKLOADS_STOPPED' }), { action: 'suspend', mode: 'WORKLOADS_STOPPED' });
  assert.deepEqual(W.lifecycleFor({ desiredState: 'SUSPENDED', suspendMode: 'SECURITY_ISOLATED' }), { action: 'suspend', mode: 'SECURITY_ISOLATED' });
  assert.deepEqual(W.lifecycleFor({ desiredState: 'SUSPENDED', suspendMode: 'MUTATIONS_BLOCKED' }), { action: 'none' }); // runtime untouched
  assert.deepEqual(W.lifecycleFor({ desiredState: 'ACTIVE' }), { action: 'run' });
  assert.deepEqual(W.lifecycleFor({}), { action: 'run' });
});

test('owner + runtime flow spec → appToInput → workload annotations', () => {
  const i = W.appToInput({ metadata: { name: 'a-web12345' }, spec: { tenantId: 't-abcd1234', appId: 'a-web12345', image: 'x', owner: 'alice', runtime: 'nodejs-22' } });
  assert.equal(i.owner, 'alice');
  assert.equal(i.runtime, 'nodejs-22');
  const [dep, svc] = W.desired(i);
  assert.equal(dep.metadata.annotations['rachbase.io/created-by'], 'alice');
  assert.equal(dep.metadata.annotations['rachbase.io/runtime'], 'nodejs-22');
  assert.equal(dep.spec.template.metadata.annotations['rachbase.io/created-by'], 'alice');
  assert.equal(svc.metadata.annotations['rachbase.io/created-by'], 'alice');
});

test('env + command flow: App spec → appToInput → workload container', () => {
  const i = W.appToInput({ metadata: { name: 'a-web12345' }, spec: {
    tenantId: 't-abcd1234', appId: 'a-web12345', image: 'x',
    env: [{ name: 'API', value: 'y' }], command: ['sh', '-c', 'npm start'],
  } });
  assert.deepEqual(i.env, [{ name: 'API', value: 'y' }]);
  assert.deepEqual(i.command, ['sh', '-c', 'npm start']);
  const c = W.desired(i)[0].spec.template.spec.containers[0];
  assert.deepEqual(c.command, ['sh', '-c', 'npm start']);
  assert.equal(c.env, undefined); // env is NOT inline — it comes from the app-env Secret
  assert.deepEqual(c.envFrom, [{ secretRef: { name: 'a-web12345-env' } }]);

  // absent → no command/env (image default runs)
  const bare = W.appToInput({ metadata: { name: 'a-web12345' }, spec: { tenantId: 't-abcd1234', appId: 'a-web12345', image: 'x' } });
  assert.equal(bare.env, null);
  assert.equal(bare.command, null);
  const bc = W.desired(bare)[0].spec.template.spec.containers[0];
  assert.equal(bc.command, undefined);
  assert.equal(bc.env, undefined);
  assert.equal(bc.envFrom, undefined);
});

test('handleAppPut threads env + command into createApp', async () => {
  const created = [];
  const req = appReq({ body: { operationId: 'op-1', image: 'reg/img@sha256:x', port: 8080, env: [{ name: 'API', value: 'y' }], command: 'npm start' } });
  const r = await handleAppPut(req, deps({ createApp: async (a) => created.push(a) }));
  assert.equal(r.status, 202);
  assert.deepEqual(created[0].env, [{ name: 'API', value: 'y' }]);
  assert.deepEqual(created[0].command, ['sh', '-c', 'npm start']); // DTO normalized the string
});

test('a non-default port flows App spec → container port + Service port/targetPort', () => {
  const i = W.appToInput({ metadata: { name: 'a-web12345' }, spec: { tenantId: 't-abcd1234', appId: 'a-web12345', image: 'x', port: 3000 } });
  assert.equal(i.port, 3000);
  const [dep, svc] = W.desired(i);
  assert.equal(dep.spec.template.spec.containers[0].ports[0].containerPort, 3000);
  assert.equal(svc.spec.ports[0].port, 3000);
  assert.equal(svc.spec.ports[0].targetPort, 3000);
  // absent → default 8080
  const bare = W.appToInput({ metadata: { name: 'a-web12345' }, spec: { tenantId: 't-abcd1234', appId: 'a-web12345', image: 'x' } });
  assert.equal(W.desired(bare)[0].spec.template.spec.containers[0].ports[0].containerPort, 8080);
});

test('host flows App spec → appToInput → urlFor (falls back to appId host when absent)', () => {
  const i = W.appToInput({ metadata: { name: 'a-web12345' }, spec: { tenantId: 't-abcd1234', appId: 'a-web12345', image: 'x', host: 'test-api.rachbase.app' } });
  assert.equal(i.host, 'test-api.rachbase.app');
  assert.equal(W.urlFor(i), 'https://test-api.rachbase.app');
  // absent host → appId-based fallback
  const bare = W.appToInput({ metadata: { name: 'a-web12345' }, spec: { tenantId: 't-abcd1234', appId: 'a-web12345', image: 'x' } });
  assert.match(W.urlFor(bare), /^https:\/\/a-web12345\./);
});

test('build.resolve classifies the three deploy sources (gated)', () => {
  // 1) approved digest → runnable now
  assert.equal(build.resolve({ spec: { image: 'reg@sha256:x' } }).state, 'RESOLVED');
  // 2) prebuilt external image → ARKA must ingest it (blocked)
  const ext = build.resolve({ spec: { externalImage: 'postgres:16' } });
  assert.equal(ext.state, 'INGEST_PENDING');
  assert.equal(ext.reason, 'AWAITS_SPACEARK_IMAGE_INGEST');
  assert.equal(ext.externalImage, 'postgres:16');
  // 3) build from commit → blocked; carries baseImage when present (mode 2b)
  const build1 = build.resolve({ spec: { source: { provider: 'github', commitSha: 'abc' } } });
  assert.equal(build1.state, 'BUILD_PENDING');
  assert.equal(build1.reason, 'AWAITS_SPACEARK_BUILD_SERVICE');
  assert.equal(build1.baseImage, undefined);
  const build2 = build.resolve({ spec: { source: { provider: 'github', commitSha: 'abc', baseImage: 'node:20-alpine' } } });
  assert.equal(build2.baseImage, 'node:20-alpine');
  // none → FAILED
  assert.equal(build.resolve({ spec: {} }).state, 'FAILED');
});

const deps = (x = {}) => ({ siteId: 'site1', verifyJwt: () => ({ sub: 'bff' }), idempotency: createIdempotencyStore(), createApp: async () => {}, createRelease: async () => {}, ...x });
const appReq = (over = {}) => ({ method: 'PUT', route: '/v1/tenants/t-abcd1234/apps/a-web12345', tenantId: 't-abcd1234', appId: 'a-web12345', headers: { authorization: 'Bearer x', 'idempotency-key': 'AK1' }, body: { operationId: 'op-1', image: 'reg/img@sha256:x', port: 8080 }, ...over });

test('handleAppPut: 202 + createApp with image', async () => {
  const created = [];
  const r = await handleAppPut(appReq(), deps({ createApp: async (a) => created.push(a) }));
  assert.equal(r.status, 202);
  assert.equal(created[0].appId, 'a-web12345');
  assert.equal(created[0].image, 'reg/img@sha256:x');
});

test('handleTenantSuspend: validates mode, 202 + suspendTenant(mode); resume clears it', async () => {
  const calls = [];
  const suspendReq = (body) => ({ method: 'POST', route: '/v1/tenants/t-abcd1234:suspend', tenantId: 't-abcd1234', headers: { authorization: 'Bearer x', 'idempotency-key': 'SK1' }, body });
  const d = deps({ suspendTenant: async (a) => calls.push(['suspend', a]), resumeTenant: async (a) => calls.push(['resume', a]) });

  const ok = await handleTenantSuspend(suspendReq({ operationId: 'op-s', mode: 'WORKLOADS_STOPPED' }), d);
  assert.equal(ok.status, 202);
  assert.equal(calls[0][1].mode, 'WORKLOADS_STOPPED');

  // invalid mode → 400 INVALID_REQUEST, no side effect
  const bad = await handleTenantSuspend(suspendReq({ operationId: 'op-s2', mode: 'NOPE' }), deps({ suspendTenant: async () => calls.push(['suspend', 'BAD']) }));
  assert.equal(bad.status, 400);

  const res = await handleTenantResume({ method: 'POST', route: '/v1/tenants/t-abcd1234:resume', tenantId: 't-abcd1234', headers: { authorization: 'Bearer x', 'idempotency-key': 'RK1' }, body: { operationId: 'op-r' } }, d);
  assert.equal(res.status, 202);
  assert.equal(calls.at(-1)[0], 'resume');
});

test('handleReleasePost: 202 with image; 400 when neither source nor image', async () => {
  const created = [];
  const rel = (body, ik) => ({ method: 'POST', route: '/v1/tenants/t-abcd1234/apps/a-web12345/releases', tenantId: 't-abcd1234', appId: 'a-web12345', headers: { authorization: 'Bearer x', 'idempotency-key': ik }, body });
  let r = await handleReleasePost(rel({ operationId: 'op-1', image: 'reg/img@sha256:x' }, 'RK1'), deps({ createRelease: async (x) => created.push(x) }));
  assert.equal(r.status, 202);
  assert.equal(created.length, 1);
  r = await handleReleasePost(rel({ operationId: 'op-2' }, 'RK2'), deps());
  assert.equal(r.status, 400);
});

test('handleAppDelete: 202 + deleteApp with the operation; 401 on bad JWT', async () => {
  const deleted = [];
  const delReq = (over = {}) => ({ method: 'DELETE', route: '/v1/tenants/t-abcd1234/apps/a-web12345', tenantId: 't-abcd1234', appId: 'a-web12345', headers: { authorization: 'Bearer x', 'idempotency-key': 'DK1' }, body: { operationId: 'op-del-1', reason: 'service deleted' }, ...over });
  const r = await handleAppDelete(delReq(), deps({ deleteApp: async (a) => deleted.push(a) }));
  assert.equal(r.status, 202);
  assert.equal(deleted[0].appId, 'a-web12345');
  assert.equal(deleted[0].operationId, 'op-del-1');

  const bad = await handleAppDelete(delReq(), deps({ verifyJwt: () => { throw new Error('bad'); } }));
  assert.equal(bad.status, 401);
});

test('handleRegistryImages returns the injected list (stub → [])', async () => {
  const { handleRegistryImages } = require('../src/api/facade');
  const empty = await handleRegistryImages('t-abcd1234', deps());               // no listRegistryImages dep
  assert.deepEqual(empty, { status: 200, body: { images: [] } });
  const withImgs = await handleRegistryImages('t-abcd1234', deps({ listRegistryImages: async () => [{ ref: 'reg/app:1' }] }));
  assert.deepEqual(withImgs.body.images, [{ ref: 'reg/app:1' }]);
});

test('workload.statusPatch marks DELETED without a url', () => {
  const s = W.statusPatch({ state: 'DELETED', reason: null }, { appId: 'a-web12345', generation: 4 });
  assert.equal(s.status.state, 'DELETED');
  assert.equal(s.status.url, undefined);
  assert.equal(s.status.observedGeneration, 4);
});

test('appStatusChanged: unchanged status (incl. terminal DELETED) → false, so no re-patch/log loop', () => {
  // The reconciler computes { state, reason, observedGeneration } for gen G.
  const next = W.statusPatch({ state: 'DELETED', reason: null }, { generation: 3 }).status;
  const current = { state: 'DELETED', reason: null, observedGeneration: 3, updatedAt: '2020-01-01T00:00:00Z' };
  assert.equal(W.appStatusChanged(current, next), false);   // only updatedAt differs → NOT a change
  assert.equal(W.appStatusChanged({}, next), true);         // no prior status → change
  assert.equal(W.appStatusChanged({ state: 'RECONCILING', observedGeneration: 3 }, next), true); // state moved
  assert.equal(W.appStatusChanged({ state: 'DELETED', reason: null, observedGeneration: 2 }, next), true); // new generation
});

test('self-ingress: desired() emits an Ingress for a public host, keyed to the app service', () => {
  process.env.SITE_SELF_INGRESS = '1';
  delete require.cache[require.resolve('../src/renderers/manifests')];
  delete require.cache[require.resolve('../src/reconcilers/workload')];
  const W2 = require('../src/reconcilers/workload');
  const objs = W2.desired({ tenantId: 'abcd1234', appId: 'a-svc00000019', image: 'img:1', port: 8080, host: 'test.rachbase.app' });
  const ing = objs.find((o) => o.kind === 'Ingress');
  assert.ok(ing, 'Ingress present when self-ingress on + host set');
  assert.equal(ing.metadata.namespace, 'rb-t-abcd1234');
  assert.equal(ing.spec.rules[0].host, 'test.rachbase.app');
  assert.equal(ing.spec.rules[0].http.paths[0].backend.service.name, 'a-svc00000019');
  assert.equal(ing.spec.rules[0].http.paths[0].backend.service.port.number, 8080);
  // no per-namespace TLS secret (wildcard cert lives on the controller)
  assert.ok(!ing.spec.tls);

  // no host → no Ingress (e.g. non-public primitive)
  const noHost = W2.desired({ tenantId: 'abcd1234', appId: 'a-svc00000020', image: 'img:1', port: 8080 });
  assert.ok(!noHost.find((o) => o.kind === 'Ingress'));

  delete process.env.SITE_SELF_INGRESS;
  delete require.cache[require.resolve('../src/renderers/manifests')];
  delete require.cache[require.resolve('../src/reconcilers/workload')];
});

test('ingress NetworkPolicy is scoped to the controller pod, not the whole namespace', () => {
  process.env.SITE_SELF_INGRESS = '1';
  delete require.cache[require.resolve('../src/renderers/manifests')];
  const M2 = require('../src/renderers/manifests');
  const np = M2.allowIngressControllerNetworkPolicyManifest('abcd1234');
  const from = np.spec.ingress[0].from[0];
  assert.ok(from.namespaceSelector && from.podSelector, 'must scope by BOTH namespace and pod label');
  assert.equal(np.spec.policyTypes[0], 'Ingress');
  delete process.env.SITE_SELF_INGRESS;
  delete require.cache[require.resolve('../src/renderers/manifests')];
});
