'use strict';

/**
 * BFF site endpoints — pure helpers + the GET /operations handler (flag gate +
 * normalization, with the DB lookup mocked). The transactional POST reconcile is
 * DB-integration and runs locally after migrations 096/097.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const outbox = require('../src/services/siteOutbox');
const { newTenantRef, productToSitePlan } = require('../src/services/siteTenant');

test('newTenantRef matches the SpaceArk pattern ^t-[a-z0-9]{8,32}$', () => {
  assert.match(newTenantRef(), /^t-[a-z0-9]{8,32}$/);
});

test('productToSitePlan maps pro→pro, max→enterprise', () => {
  assert.equal(productToSitePlan('pro'), 'pro');
  assert.equal(productToSitePlan('max'), 'enterprise');
  assert.equal(productToSitePlan(undefined), 'pro');
});

test('normalizeOperation returns the contract DTO with no raw internals', () => {
  const row = {
    operation_id: 'op-1', state: 'RECONCILING', resource_type: 'tenant', resource_id: 't-abc',
    generation: 2, reason: null, message: null, updated_at: '2026-08-19T00:00:00Z',
    tenant_id: 7, site_id: 'site1', // internal fields must NOT leak
  };
  assert.deepEqual(outbox.normalizeOperation(row), {
    operationId: 'op-1', state: 'RECONCILING', resource: { type: 'tenant', id: 't-abc' },
    observedGeneration: 2, reason: null, message: null, url: null, updatedAt: '2026-08-19T00:00:00Z',
  });
  assert.equal(outbox.normalizeOperation(null), null);
});

test('site registry admin endpoints: flag gate, upsert/list/disable', async (t) => {
  const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();
  if (!HAVE_PGLITE) return t.skip('pglite not installed');
  const core = require('@rach/core');
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`CREATE TABLE sites (site_id TEXT PRIMARY KEY, api_url TEXT NOT NULL, audience TEXT, issuer TEXT, ca_pem TEXT, ingress_ip TEXT, enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());`);
  const savedQuery = core.pool.query;
  core.pool.query = (text, params) => (params === undefined ? db.query(text) : db.query(text, params));

  const ctrl = require('../src/controllers/siteController');
  const mkRes = () => ({ code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
  const admin = { role: 'admin' };

  try {
    delete process.env.FEATURE_PRO_TIER; // flag OFF → 404
    let res = mkRes();
    await ctrl.listSites({ user: admin }, res);
    assert.equal(res.code, 404);

    process.env.FEATURE_PRO_TIER = 'true';

    // bad api_url → 400
    res = mkRes();
    await ctrl.upsertSite({ params: { siteId: 'site1' }, body: { api_url: 'ftp://nope' }, user: admin }, res);
    assert.equal(res.code, 400);

    // upsert → returns the site
    res = mkRes();
    await ctrl.upsertSite({ params: { siteId: 'site1' }, body: { api_url: 'https://api.site1.example/v1', audience: 'spaceark-site-api:site1' }, user: admin }, res);
    assert.equal(res.body.site.apiUrl, 'https://api.site1.example/v1');

    // list → contains it
    res = mkRes();
    await ctrl.listSites({ user: admin }, res);
    assert.equal(res.body.sites.length, 1);
    assert.equal(res.body.sites[0].siteId, 'site1');

    // disable → enabled false; unknown → 404
    res = mkRes();
    await ctrl.disableSite({ params: { siteId: 'site1' }, user: admin }, res);
    assert.equal(res.body.site.enabled, false);
    res = mkRes();
    await ctrl.disableSite({ params: { siteId: 'ghost' }, user: admin }, res);
    assert.equal(res.code, 404);
  } finally {
    core.pool.query = savedQuery;
    delete process.env.FEATURE_PRO_TIER;
  }
});

test('getOperationStatus: 404 when flag off; normalized DTO when on', async () => {
  const ctrl = require('../src/controllers/siteController');
  const mkRes = () => ({ code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });

  delete process.env.FEATURE_PRO_TIER; // flag OFF
  let res = mkRes();
  await ctrl.getOperationStatus({ params: { operationId: 'op-1' }, user: { role: 'admin' } }, res);
  assert.equal(res.code, 404);

  process.env.FEATURE_PRO_TIER = 'true'; // flag ON
  const saved = outbox.getOperation;
  outbox.getOperation = async () => ({
    operation_id: 'op-1', state: 'SUCCEEDED', resource_type: 'tenant', resource_id: 't-abc',
    generation: 1, reason: null, message: null, updated_at: 't', tenant_id: null,
  });
  try {
    res = mkRes();
    await ctrl.getOperationStatus({ params: { operationId: 'op-1' }, user: { role: 'admin' } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.operationId, 'op-1');
    assert.equal(res.body.resource.id, 't-abc');
  } finally {
    outbox.getOperation = saved;
    delete process.env.FEATURE_PRO_TIER;
  }
});
