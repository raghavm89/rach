'use strict';

/**
 * Deploy preflight — the pure schema-compatibility check. Blocks a deploy when the site's App
 * CRD is behind the fields we send, so it fails fast with a clear message instead of a 500.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { checkAppCompat, REQUIRED_APP_FIELDS, REQUIRED_CONTRACT_VERSION, preflightApp } = require('../src/services/siteCapabilities');

test('checkAppCompat by fields: missing a required field → blocked with the name', () => {
  const behind = checkAppCompat({ appSpecFields: REQUIRED_APP_FIELDS.filter((f) => f !== 'host') });
  assert.equal(behind.ok, false);
  assert.deepEqual(behind.missing, ['host']);
  assert.match(behind.reason, /host/);

  const current = checkAppCompat({ appSpecFields: [...REQUIRED_APP_FIELDS, 'extra'] });
  assert.equal(current.ok, true);
  assert.ok(!current.unknown);
});

test('checkAppCompat by contractVersion: older → blocked; current → ok', () => {
  assert.equal(checkAppCompat({ contractVersion: REQUIRED_CONTRACT_VERSION - 1 }).ok, false);
  assert.equal(checkAppCompat({ contractVersion: REQUIRED_CONTRACT_VERSION }).ok, true);
});

test('checkAppCompat unknown (endpoint absent / no signal) → ok but unknown (fail-open)', () => {
  assert.deepEqual(checkAppCompat(null), { ok: true, unknown: true });
  assert.deepEqual(checkAppCompat({ __notFound: true }), { ok: true, unknown: true });
  assert.deepEqual(checkAppCompat({}), { ok: true, unknown: true });
});

test('preflightApp falls back to a recent schema dead-letter when capabilities are unavailable', async () => {
  const fetch = async () => ({ __notFound: true });                 // capabilities endpoint not implemented
  const withFailure = async () => ({ last_error: 'HTTP 500: .spec.host: field not declared in schema' });
  const blocked = await preflightApp('site1', { fetch, checkFailure: withFailure });
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /App CRD is out of date|rejected by ARKA/);

  const noFailure = async () => null;
  const allowed = await preflightApp('site1', { fetch, checkFailure: noFailure });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.unknown, true);
});

test('preflightApp: capabilities say behind → block without consulting the fallback', async () => {
  const fetch = async () => ({ appSpecFields: ['image', 'port'] }); // missing host, etc.
  let fallbackCalled = false;
  const checkFailure = async () => { fallbackCalled = true; return null; };
  const r = await preflightApp('site1', { fetch, checkFailure });
  assert.equal(r.ok, false);
  assert.equal(fallbackCalled, false); // authoritative signal wins
});
