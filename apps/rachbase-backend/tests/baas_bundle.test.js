'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bundleSpecs, appIdFor } = require('../src/services/baasBundle');

const REF = 'p0123456789abcdef';
const SECRET = 'sekret';
const DB = 'postgres://u:p@host/db';

test('appIdFor derives valid, role-distinct appIds from the ref', () => {
  const gw = appIdFor('gateway', REF); const sv = appIdFor('services', REF);
  assert.match(gw, /^a-[a-z0-9]{8,15}$/);
  assert.match(sv, /^a-[a-z0-9]{8,15}$/);
  assert.notEqual(gw, sv);
});

test('3-container topology: gateway + combined services + rest; auth/storage/functions share services', () => {
  const specs = bundleSpecs({ ref: REF, secret: SECRET, databaseUrl: DB, images: { gateway: 'gw:1', services: 'svc:1', rest: 'pgrst:1' }, authEnv: { ALLOW_SIGNUPS: 'true' }, storageEnv: { S3_ENABLED: 'true' } });
  assert.deepEqual(specs.map((s) => s.role), ['gateway', 'services', 'rest']); // gateway first, 3 total

  const gwEnv = Object.fromEntries(specs[0].env.map((e) => [e.name, e.value]));
  const svcBase = `http://${appIdFor('services', REF)}:8080`;
  // auth/storage/functions all route to the ONE services container
  assert.equal(gwEnv.AUTH_UPSTREAM, svcBase);
  assert.equal(gwEnv.STORAGE_UPSTREAM, svcBase);
  assert.equal(gwEnv.FUNCTIONS_UPSTREAM, svcBase);
  assert.equal(gwEnv.REST_UPSTREAM, `http://${appIdFor('rest', REF)}:3000`);

  const svcEnv = Object.fromEntries(specs[1].env.map((e) => [e.name, e.value]));
  assert.equal(svcEnv.DATABASE_URL, DB);
  assert.equal(svcEnv.ALLOW_SIGNUPS, 'true');   // authEnv merged
  assert.equal(svcEnv.S3_ENABLED, 'true');      // storageEnv merged

  const restEnv = Object.fromEntries(specs[2].env.map((e) => [e.name, e.value]));
  assert.equal(restEnv.PGRST_DB_URI, DB);
  assert.equal(restEnv.PGRST_DB_ANON_ROLE, `anon_${REF}`); // per-project anon role
});

test('only containers with a configured image are deployed', () => {
  const only = bundleSpecs({ ref: REF, secret: SECRET, databaseUrl: DB, images: { gateway: 'gw:1' } });
  assert.deepEqual(only.map((s) => s.role), ['gateway']); // no services/rest → gateway 503s those routes
  assert.equal(bundleSpecs({ ref: REF, secret: SECRET, images: {} }).length, 0); // nothing configured
});

test('ref + secret are required', () => {
  assert.throws(() => bundleSpecs({ secret: SECRET }), /ref and secret/);
});
