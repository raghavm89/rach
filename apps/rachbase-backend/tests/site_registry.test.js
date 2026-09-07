'use strict';

/**
 * Site registry (multi-site routing) — DB-backed, pglite. resolveSite maps a site_id to a
 * delivery target; upsert is idempotent + busts the cache; a disabled/absent row → null.
 */

process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();

const core = require('@rach/core');
const reg = require('../src/services/siteRegistry');

let db;
test.before(async () => {
  if (!HAVE_PGLITE) return;
  const { PGlite } = await import('@electric-sql/pglite');
  db = new PGlite();
  await db.exec(`
    CREATE TABLE sites (
      site_id TEXT PRIMARY KEY, api_url TEXT NOT NULL, audience TEXT, issuer TEXT,
      ca_pem TEXT, ingress_ip TEXT, enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  core.pool.query = (text, params) => (params === undefined ? db.query(text) : db.query(text, params));
});

test('falsy site id → null (unplaced tenant)', { skip: !HAVE_PGLITE }, async () => {
  assert.equal(await reg.resolveSite(null), null);
  assert.equal(await reg.resolveSite(''), null);
});

test('upsert then resolve returns the target; upsert updates in place', { skip: !HAVE_PGLITE }, async () => {
  await reg.upsertSite({ siteId: 'site1', apiUrl: 'https://api.site1.example/v1', audience: 'spaceark-site-api:site1', issuer: 'iss-1', caPem: 'CA-PEM' });
  let s = await reg.resolveSite('site1');
  assert.deepEqual(s, { siteId: 'site1', apiUrl: 'https://api.site1.example/v1', audience: 'spaceark-site-api:site1', issuer: 'iss-1', ca: 'CA-PEM', ingressIp: null, enabled: true });

  await reg.upsertSite({ siteId: 'site1', apiUrl: 'https://api.site1.example/v2' }); // clears cache
  s = await reg.resolveSite('site1');
  assert.equal(s.apiUrl, 'https://api.site1.example/v2');
  assert.equal(s.audience, null); // reset on upsert
});

test('a second site is addressed independently', { skip: !HAVE_PGLITE }, async () => {
  await reg.upsertSite({ siteId: 'site2', apiUrl: 'https://api.site2.example/v1' });
  assert.equal((await reg.resolveSite('site2')).apiUrl, 'https://api.site2.example/v1');
  assert.equal((await reg.resolveSite('site1')).apiUrl, 'https://api.site1.example/v2');
});

test('disabled row → null (soft-disabled, cache busted)', { skip: !HAVE_PGLITE }, async () => {
  await reg.upsertSite({ siteId: 'site2', apiUrl: 'https://api.site2.example/v1', enabled: false });
  assert.equal(await reg.resolveSite('site2'), null);
});
