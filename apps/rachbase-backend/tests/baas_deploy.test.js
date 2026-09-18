'use strict';

/** enableBaas → deploy bundle orchestration (unverifiable against a live cluster; tested with an
 * injected pool + enqueue spy). Asserts each container is enqueued, the gateway is public, and
 * the deploy defers cleanly when the tenant isn't placed or no images are set. */

const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SITE_APP_SEND_HOST = '1'; // exercise the host-enabled path (gateway gets a public host)
const { deployBundle } = require('../src/services/baasDeploy');

const REF = 'p0123456789abcdef';
const IMAGES = { gateway: 'gw:1', services: 'svc:1', rest: 'pgrst:1' };

// Fake pool whose client returns a placed tenant.
function placedPool(placement = { site_id: 'site1', site_tenant_ref: 't-abcd1234' }) {
  return { connect: async () => ({
    query: async (t) => (/FROM tenants/.test(t) ? { rows: [{ id: 1, ...placement }] } : { rows: [] }),
    release: () => {},
  }) };
}

test('deploys every bundle container; gateway gets the public <ref>.rachbase.app host', async () => {
  const calls = [];
  const enqueue = async (_c, spec) => { calls.push(spec); return { operationId: `op-${spec.appId}` }; };
  const r = await deployBundle({ tenantId: 1, ref: REF, secret: 's', databaseUrl: 'postgres://x', images: IMAGES }, { pool: placedPool(), enqueue });

  assert.equal(r.deployed, 3);
  assert.equal(r.gatewayHost, `${REF}.rachbase.app`);
  assert.equal(calls.length, 3);

  const gw = calls.find((c) => c.host);        // only the gateway carries a host
  assert.equal(gw.host, `${REF}.rachbase.app`);
  assert.equal(calls.filter((c) => c.host).length, 1); // primitives are internal
  // env (project secret + DB URL) rides the App upsert
  const auth = calls.find((c) => c.env.some((e) => e.name === 'DATABASE_URL'));
  assert.ok(auth.env.some((e) => e.name === 'PROJECT_JWT_SECRET' && e.value === 's'));
});

test('compute size flows into every container as resource requests', async () => {
  const calls = [];
  const enqueue = async (_c, spec) => { calls.push(spec); return { operationId: 'op' }; };
  await deployBundle({ tenantId: 1, ref: REF, secret: 's', databaseUrl: 'postgres://x', images: IMAGES, computeSize: 'micro' }, { pool: placedPool(), enqueue });
  assert.equal(calls.length, 3);
  for (const c of calls) {           // micro = 2000m CPU / 1024 MiB on all 3 containers
    assert.equal(c.resources.cpuRequestM, 2000);
    assert.equal(c.resources.memRequestMiB, 1024);
  }
});

test('defers when the tenant is not placed on a site', async () => {
  const r = await deployBundle({ tenantId: 1, ref: REF, secret: 's', images: IMAGES },
    { pool: placedPool({ site_id: null, site_tenant_ref: null }), enqueue: async () => ({}) });
  assert.deepEqual(r, { deployed: 0, deferred: 'tenant_not_placed' });
});

test('defers when no primitive images are configured', async () => {
  const r = await deployBundle({ tenantId: 1, ref: REF, secret: 's', images: {} }, { pool: placedPool(), enqueue: async () => ({}) });
  assert.deepEqual(r, { deployed: 0, deferred: 'no_images_configured' });
});
