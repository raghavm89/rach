'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../index');

test('canonical hash is key-order independent, array-order sensitive', () => {
  assert.equal(C.canonicalJson({ b: 1, a: 2 }), C.canonicalJson({ a: 2, b: 1 }));
  assert.notEqual(C.canonicalJson([1, 2]), C.canonicalJson([2, 1]));
});

test('requestHash is stable and body-sensitive', () => {
  const base = { method: 'PUT', route: '/v1/tenants/t-abcd1234', siteId: 'site1', tenantId: 't-abcd1234', body: { plan: 'pro' } };
  assert.equal(C.requestHash(base), C.requestHash({ ...base, body: { plan: 'pro' } }));
  assert.notEqual(C.requestHash(base), C.requestHash({ ...base, body: { plan: 'free' } }));
  assert.match(C.requestHash(base), /^[a-f0-9]{64}$/);
});

test('ids are prefixed and unique', () => {
  assert.match(C.newOperationId(), /^op-/);
  assert.match(C.newRequestId(), /^req-/);
  assert.notEqual(C.newIdempotencyKey(), C.newIdempotencyKey());
});

test('tenantPutDTO validates + shapes', () => {
  const dto = C.tenantPutDTO({ operationId: 'op-1', customerRef: 'c-1', plan: 'pro' });
  assert.deepEqual(dto, { operationId: 'op-1', customerRef: 'c-1', plan: 'pro', desiredState: 'ACTIVE', generation: 1 });
  assert.throws(() => C.tenantPutDTO({ operationId: 'op-1', customerRef: 'c-1', plan: 'nope' }));
});

test('routes validate id patterns', () => {
  assert.equal(C.tenantRoute('t-abcd1234'), '/v1/tenants/t-abcd1234');
  assert.throws(() => C.tenantRoute('bad'));
  assert.equal(C.appRoute('t-abcd1234', 'a-web12345'), '/v1/tenants/t-abcd1234/apps/a-web12345');
  assert.equal(C.releaseRoute('t-abcd1234', 'a-web12345'), '/v1/tenants/t-abcd1234/apps/a-web12345/releases');
});

test('appPutDTO + releasePostDTO validate/shape', () => {
  const a = C.appPutDTO({ operationId: 'op-1', image: 'reg/img@sha256:x', port: 8080, owner: 'alice' });
  assert.equal(a.image, 'reg/img@sha256:x');
  assert.ok(a.resources.cpuLimitM > 0);
  assert.equal(a.owner, 'alice'); // user_name attribution flows through the DTO
  assert.equal(C.appPutDTO({ operationId: 'op-1' }).owner, undefined); // opt-in
  assert.equal(C.appPutDTO({ operationId: 'op-1', runtime: 'nodejs-22' }).runtime, 'nodejs-22'); // §7.1
  assert.equal(C.appPutDTO({ operationId: 'op-1' }).runtime, undefined); // optional, backward-compatible

  // env + run command (user runtime inputs) — optional, normalized, backward-compatible.
  assert.equal(C.appPutDTO({ operationId: 'op-1' }).env, undefined);      // absent → omitted
  assert.equal(C.appPutDTO({ operationId: 'op-1' }).command, undefined);
  const withEnv = C.appPutDTO({ operationId: 'op-1', env: [{ key: 'PORT', value: 3000 }, { name: 'BAD KEY', value: 'x' }, { name: 'API', value: 'y' }] });
  assert.deepEqual(withEnv.env, [{ name: 'PORT', value: '3000' }, { name: 'API', value: 'y' }]); // invalid name dropped, value stringified
  assert.deepEqual(C.appPutDTO({ operationId: 'op-1', command: 'npm start' }).command, ['sh', '-c', 'npm start']); // string → shell exec form
  assert.deepEqual(C.appPutDTO({ operationId: 'op-1', command: ['node', 'index.js'] }).command, ['node', 'index.js']); // array passthrough
  assert.equal(C.appPutDTO({ operationId: 'op-1', command: '   ' }).command, undefined); // blank → omitted (image default)

  // host (public domain) — normalized, invalid dropped, optional.
  assert.equal(C.appPutDTO({ operationId: 'op-1' }).host, undefined);
  assert.equal(C.appPutDTO({ operationId: 'op-1', host: 'https://Test-Api.rachbase.app/x' }).host, 'test-api.rachbase.app'); // scheme/path/case stripped
  assert.equal(C.appPutDTO({ operationId: 'op-1', host: 'app.example.com' }).host, 'app.example.com');
  assert.equal(C.appPutDTO({ operationId: 'op-1', host: 'not a host' }).host, undefined); // invalid → omitted

  // releasePostDTO — the three deploy sources.
  assert.equal(C.releasePostDTO({ operationId: 'op-1', image: 'reg/img@sha256:x' }).image, 'reg/img@sha256:x');
  assert.equal(C.releasePostDTO({ operationId: 'op-1', externalImage: 'postgres:16' }).externalImage, 'postgres:16');
  const built = C.releasePostDTO({ operationId: 'op-1', source: { provider: 'github', commitSha: 'abc', baseImage: 'node:20-alpine' } });
  assert.equal(built.source.baseImage, 'node:20-alpine');
  assert.throws(() => C.releasePostDTO({ operationId: 'op-1' })); // none of source/externalImage/image
});

test('appDeleteDTO + tenantDeleteDTO carry desiredState=DELETED and require operationId', () => {
  assert.deepEqual(C.appDeleteDTO({ operationId: 'op-del', reason: 'gone' }), { operationId: 'op-del', desiredState: 'DELETED', reason: 'gone' });
  assert.deepEqual(C.tenantDeleteDTO({ operationId: 'op-del' }), { operationId: 'op-del', desiredState: 'DELETED', reason: null });
  assert.throws(() => C.appDeleteDTO({}));
  assert.throws(() => C.tenantDeleteDTO({}));
});

test('tenant suspend/resume routes + DTOs (§9.10)', () => {
  assert.equal(C.tenantSuspendRoute('t-abcd1234'), '/v1/tenants/t-abcd1234:suspend');
  assert.equal(C.tenantResumeRoute('t-abcd1234'), '/v1/tenants/t-abcd1234:resume');
  assert.throws(() => C.tenantSuspendRoute('bad'));
  const s = C.tenantSuspendDTO({ operationId: 'op-s', mode: 'WORKLOADS_STOPPED', reasonCode: 'SUBSCRIPTION_SUSPENDED' });
  assert.deepEqual(s, { operationId: 'op-s', generation: 1, mode: 'WORKLOADS_STOPPED', reasonCode: 'SUBSCRIPTION_SUSPENDED', desiredState: 'SUSPENDED' });
  assert.throws(() => C.tenantSuspendDTO({ operationId: 'op-s', mode: 'NOPE' })); // invalid mode
  assert.throws(() => C.tenantSuspendDTO({ mode: 'WORKLOADS_STOPPED' }));         // missing operationId
  assert.deepEqual(C.tenantResumeDTO({ operationId: 'op-r' }), { operationId: 'op-r', generation: 1, desiredState: 'ACTIVE' });
});

test('registryImagesRoute validates the tenant id; registryImageDTO normalizes + requires ref', () => {
  assert.equal(C.registryImagesRoute('t-abcd1234'), '/v1/tenants/t-abcd1234/registry/images');
  assert.throws(() => C.registryImagesRoute('bad'));
  assert.deepEqual(C.registryImageDTO({ ref: 'reg/app:1', tag: '1' }), { ref: 'reg/app:1', repository: null, tag: '1', digest: null, pushedAt: null, sizeBytes: null });
  assert.throws(() => C.registryImageDTO({}));
});
