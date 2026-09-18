'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRegistry, routeTemplate, registry, metrics } = require('../src/metrics');
const W = require('../src/reconcilers/workload');

test('registry counts and renders OpenMetrics with labels', () => {
  const r = createRegistry();
  r.inc('spaceark_site_api_requests_total', { route: '/v1/tenants/:tenant', method: 'PUT', code: 202 });
  r.inc('spaceark_site_api_requests_total', { route: '/v1/tenants/:tenant', method: 'PUT', code: 202 });
  r.set('spaceark_site_queue_depth', 3, { controller: 'tenant' });
  const out = r.render();
  assert.match(out, /spaceark_site_api_requests_total\{[^}]*code="202"[^}]*\} 2/);
  assert.match(out, /spaceark_site_queue_depth\{controller="tenant"\} 3/);
});

test('observe records a summary (_sum + _count); describe emits # HELP/# TYPE', () => {
  const r = createRegistry();
  r.describe('spaceark_site_reconcile_duration_seconds', 'summary', 'dur');
  r.observe('spaceark_site_reconcile_duration_seconds', 0.5, { controller: 'tenant' });
  r.observe('spaceark_site_reconcile_duration_seconds', 1.5, { controller: 'tenant' });
  const out = r.render();
  assert.match(out, /# TYPE spaceark_site_reconcile_duration_seconds summary/);
  assert.match(out, /spaceark_site_reconcile_duration_seconds_sum\{controller="tenant"\} 2/);
  assert.match(out, /spaceark_site_reconcile_duration_seconds_count\{controller="tenant"\} 2/);
});

test('metrics recorders emit the §10 set with bounded, PII-free labels', () => {
  metrics.reconcile('tenant', 'SUCCEEDED');
  metrics.reconcileDuration('tenant', 0.1);
  metrics.operation('app.upsert', 'ACCEPTED');
  metrics.drift('inventory', 'namespace');
  metrics.builds('BUILDING', 2);
  const out = registry.render();
  assert.match(out, /spaceark_site_reconcile_total\{controller="tenant",reason="ok",result="SUCCEEDED"\} \d+/);
  assert.match(out, /spaceark_site_operations_total\{state="ACCEPTED",type="app.upsert"\} \d+/);
  assert.match(out, /spaceark_site_drift_total\{controller="inventory",kind="namespace"\} \d+/);
  assert.match(out, /spaceark_site_builds\{state="BUILDING"\} 2/);
  // no tenant/app/operation id or email leaked into any label
  assert.doesNotMatch(out, /t-[a-z0-9]{8}|a-[a-z0-9]{8}|op-[a-z0-9]|@/);
});

test('routeTemplate strips ids to keep label cardinality bounded', () => {
  assert.equal(routeTemplate('/v1/tenants/t-abcd1234'), '/v1/tenants/:tenant');
  assert.equal(routeTemplate('/v1/tenants/t-abcd1234/apps/a-web12345/releases'), '/v1/tenants/:tenant/apps/:app/releases');
  assert.equal(routeTemplate('/v1/operations/op-XYZ123'), '/v1/operations/:op');
});

test('workload.statusPatch adds the app URL only when ACTIVE', () => {
  const input = { appId: 'a-web12345', generation: 3 };
  const active = W.statusPatch({ state: 'ACTIVE', reason: null }, input);
  assert.equal(active.status.state, 'ACTIVE');
  assert.match(active.status.url, /^https:\/\/a-web12345\./);
  assert.equal(active.status.observedGeneration, 3);
  const pending = W.statusPatch({ state: 'RECONCILING', reason: 'VERIFY_PENDING' }, input);
  assert.equal(pending.status.url, undefined);
});
