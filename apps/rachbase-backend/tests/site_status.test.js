'use strict';

/**
 * Status-poll worker — pure/unit tests (no DB, no site). `fetch`/`reflect`/`setState`
 * are injected. The DB read (listInFlight) + the services.status UPDATE are exercised
 * locally against Postgres after migration 098.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const W = require('../src/services/siteStatusWorker');

test('normalizeState passes contract states through, defaults unknown to RECONCILING', () => {
  for (const s of ['ACCEPTED', 'RECONCILING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED']) {
    assert.equal(W.normalizeState(s), s);
  }
  assert.equal(W.normalizeState('ACTIVE'), 'RECONCILING'); // internal leak → safe default
  assert.equal(W.normalizeState(undefined), 'RECONCILING');
});

test('serviceIdFromAppId recovers the service id from the dashboard app id', () => {
  assert.equal(W.serviceIdFromAppId('a-svc00000123'), 123);
  assert.equal(W.serviceIdFromAppId('a-svc7'), 7);
  assert.equal(W.serviceIdFromAppId('a-web12345'), null); // not a service-backed app
  assert.equal(W.serviceIdFromAppId(''), null);
});

test('every contract state maps to a valid services.status value', () => {
  const allowed = new Set(['created', 'building', 'deploying', 'online', 'crashed', 'stopped']);
  for (const v of Object.values(W.SERVICE_STATUS)) assert.ok(allowed.has(v), v);
  assert.equal(W.SERVICE_STATUS.SUCCEEDED, 'online');
  assert.equal(W.SERVICE_STATUS.FAILED, 'crashed');
});

test('refreshOne writes state + url and reflects an app op; reports updated vs unchanged', async () => {
  const setCalls = [];
  const reflected = [];
  const setState = async (id, state, extra) => setCalls.push({ id, state, extra });
  const reflect = async (op) => reflected.push(op);
  const reflectDeployment = async () => {}; // no-op (DB path covered elsewhere)

  const fetch = async () => ({ state: 'ACTIVE', url: 'https://a-svc00000123.apps.rachbase.app', reason: null, resource: { type: 'app', id: 'a-svc00000123' } });
  const row = { operation_id: 'op-1', state: 'RECONCILING', resource_type: 'app', resource_id: 'a-svc00000123' };
  const r1 = await W.refreshOne(row, { fetch, reflect, setState, reflectDeployment });

  // ACTIVE is an internal state → normalized to RECONCILING (still != row? no, equal) — assert the url still flows.
  assert.equal(setCalls[0].extra.url, 'https://a-svc00000123.apps.rachbase.app');
  assert.equal(reflected[0].resource.id, 'a-svc00000123');
  assert.equal(r1, 'unchanged'); // RECONCILING == row.state

  const fetch2 = async () => ({ state: 'SUCCEEDED', url: 'https://a-svc00000123.apps.rachbase.app', resource: { type: 'app', id: 'a-svc00000123' } });
  const r2 = await W.refreshOne(row, { fetch: fetch2, reflect, setState, reflectDeployment });
  assert.equal(setCalls[1].state, 'SUCCEEDED');
  assert.equal(r2, 'updated'); // RECONCILING → SUCCEEDED
});

test('refreshOne skips when the site has no status yet (dry-run / not found)', async () => {
  let set = 0;
  const r = await W.refreshOne({ operation_id: 'op-x', state: 'ACCEPTED' }, { fetch: async () => null, reflect: async () => {}, setState: async () => { set++; } });
  assert.equal(r, 'skipped');
  assert.equal(set, 0);
});

test('refreshOne terminalizes a superseded op (site 404) past the grace window, not before', async () => {
  const notFound = async () => ({ __notFound: true });
  const calls = [];
  const setState = async (id, state, extra) => calls.push({ id, state, extra });

  // Fresh op that 404s → within grace → skip, no state change.
  const fresh = await W.refreshOne({ operation_id: 'op-new', state: 'ACCEPTED', updated_at: new Date().toISOString() }, { fetch: notFound, reflect: async () => {}, setState });
  assert.equal(fresh, 'skipped');
  assert.equal(calls.length, 0);

  // Old op that 404s → past grace → SUPERSEDED, drops out of the in-flight set.
  const old = await W.refreshOne({ operation_id: 'op-old', state: 'ACCEPTED', updated_at: new Date(Date.now() - 10 * 60_000).toISOString() }, { fetch: notFound, reflect: async () => {}, setState });
  assert.equal(old, 'updated');
  assert.equal(calls[0].state, 'SUPERSEDED');

  // A not-found APP op past grace fails its own deploy row AND crashes the service if this is
  // still its current op (so a failed first deploy flips off an optimistic "online").
  const deps = [];
  const crashes = [];
  const reflectDeployment = async (opId, status) => { deps.push([opId, status]); };
  const crashIfLatest = async (appId, opId) => { crashes.push([appId, opId]); };
  await W.refreshOne(
    { operation_id: 'op-app', state: 'ACCEPTED', resource_type: 'app', resource_id: 'a-svc00000014', updated_at: new Date(Date.now() - 10 * 60_000).toISOString() },
    { fetch: notFound, reflect: async () => {}, setState, reflectDeployment, crashIfLatest },
  );
  assert.deepEqual(deps, [['op-app', 'failed']]);
  assert.deepEqual(crashes, [['a-svc00000014', 'op-app']]);
});

test('pollOnce counts only state changes as updated', async () => {
  const rows = [
    { operation_id: 'op-a', state: 'RECONCILING', resource_type: 'tenant', resource_id: 't-1' },
    { operation_id: 'op-b', state: 'RECONCILING', resource_type: 'app', resource_id: 'a-svc00000009' },
  ];
  // Stub listInFlight via the module's outbox dependency by injecting through pollOnce's fetch/reflect/setState,
  // but listInFlight itself hits the DB — so drive refreshOne directly for count semantics.
  let updated = 0;
  const setState = async () => {};
  const reflect = async () => {};
  const outcomes = ['SUCCEEDED', 'RECONCILING'];
  for (let i = 0; i < rows.length; i++) {
    const fetch = async () => ({ state: outcomes[i], resource: { type: rows[i].resource_type, id: rows[i].resource_id } });
    if ((await W.refreshOne(rows[i], { fetch, reflect, setState })) === 'updated') updated++;
  }
  assert.equal(updated, 1);
});

test('appDriftState: reflects site state; not-found past grace → crashed; within grace → leave', () => {
  const staleMs = 1000;
  assert.equal(W.appDriftState(null, { ageMs: 9999, staleMs }), null);                       // dry-run / not visible
  assert.equal(W.appDriftState({ __notFound: true }, { ageMs: 500, staleMs }), null);         // within grace → leave
  assert.equal(W.appDriftState({ __notFound: true }, { ageMs: 5000, staleMs }), 'crashed');   // desired state gone
  assert.equal(W.appDriftState({ state: 'SUCCEEDED' }, { ageMs: 5000, staleMs }), 'online');  // healthy on site
  assert.equal(W.appDriftState({ state: 'FAILED' }, { ageMs: 5000, staleMs }), 'crashed');
  assert.equal(W.appDriftState({ state: 'DELETED' }, { ageMs: 5000, staleMs }), 'stopped');
});

test('appDriftDeploymentStatus: gone-past-grace → failed; healthy → success; in-flight/within-grace → null', () => {
  const staleMs = 1000;
  assert.equal(W.appDriftDeploymentStatus({ __notFound: true }, { ageMs: 5000, staleMs }), 'failed');
  assert.equal(W.appDriftDeploymentStatus({ __notFound: true }, { ageMs: 500, staleMs }), null);
  assert.equal(W.appDriftDeploymentStatus({ state: 'SUCCEEDED' }, { ageMs: 5000, staleMs }), 'success');
  assert.equal(W.appDriftDeploymentStatus({ state: 'RECONCILING' }, { ageMs: 5000, staleMs }), null);
  assert.equal(W.appDriftDeploymentStatus(null, { ageMs: 5000, staleMs }), null);
});

test('reconcileAppStatusOnce: vanished op → service crashed AND its deploy row failed (by operation_id)', async () => {
  const svcUpdates = [];
  const depUpdates = [];
  const list = async () => [
    { service_id: 1, operation_id: 'op-gone', site_id: 's', state: 'SUCCEEDED', updated_at: new Date(0).toISOString() },
    { service_id: 2, operation_id: 'op-ok',   site_id: 's', state: 'SUCCEEDED', updated_at: new Date(0).toISOString() },
  ];
  const fetch = async (opId) => (opId === 'op-gone' ? { __notFound: true } : { state: 'SUCCEEDED' });
  const setStatus = async (id, status) => { svcUpdates.push([id, status]); return true; };
  const reflectDeployment = async (opId, status) => { depUpdates.push([opId, status]); return true; };

  const r = await W.reconcileAppStatusOnce({ list, fetch, setStatus, reflectDeployment, now: Date.now(), staleMs: 1000 });
  assert.equal(r.scanned, 2);
  assert.deepEqual(svcUpdates.find((u) => u[0] === 1), [1, 'crashed']);   // service reflects reality
  assert.deepEqual(depUpdates.find((u) => u[0] === 'op-gone'), ['op-gone', 'failed']); // AND the deploy row
  assert.deepEqual(svcUpdates.find((u) => u[0] === 2), [2, 'online']);
  assert.deepEqual(depUpdates.find((u) => u[0] === 'op-ok'), ['op-ok', 'success']);
});

test('deploymentStatusFor: only terminal op states set deploy history; else leave it', () => {
  assert.equal(W.deploymentStatusFor('SUCCEEDED'), 'success');
  assert.equal(W.deploymentStatusFor('FAILED'), 'failed');
  assert.equal(W.deploymentStatusFor('BLOCKED'), 'failed');
  assert.equal(W.deploymentStatusFor('RECONCILING'), null); // in-flight → don't touch history
  assert.equal(W.deploymentStatusFor('ACCEPTED'), null);
  assert.equal(W.deploymentStatusFor('DELETED'), null);
});
