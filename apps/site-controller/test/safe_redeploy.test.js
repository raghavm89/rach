'use strict';

/**
 * Safe redeploy + auto-revert: the app Deployment keeps the working version serving until a new
 * one is Ready, marks a stuck rollout failed, and reports "deploy failed, previous running"
 * without taking the service down.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/renderers/manifests');
const W = require('../src/reconcilers/workload');
const { reconcileClaim } = require('../src/reconcilers/engine');

test('deploymentManifest: preserve-and-revert rollout settings', () => {
  const d = M.deploymentManifest({ tenantId: 't1', name: 'a-svc1', image: 'img@sha256:x', port: 8080 });
  assert.equal(d.spec.strategy.type, 'RollingUpdate');
  assert.equal(d.spec.strategy.rollingUpdate.maxUnavailable, 0); // never drop the working pod
  assert.equal(d.spec.strategy.rollingUpdate.maxSurge, 1);
  assert.equal(typeof d.spec.progressDeadlineSeconds, 'number'); // stuck rollout → failed
  assert.ok(d.spec.revisionHistoryLimit >= 1);                    // keep prior RS for undo
});

test('deploymentManifest: readiness probe gates promotion of a new pod', () => {
  const d = M.deploymentManifest({ tenantId: 't1', name: 'a-svc1', image: 'img', port: 9000 });
  const probe = d.spec.template.spec.containers[0].readinessProbe;
  assert.ok(probe, 'has a readiness probe');
  assert.equal(probe.tcpSocket.port, 9000); // checks the app's own port
});

test('deployFailedButServing: only when rollout failed AND a pod is still ready', () => {
  assert.equal(W.deployFailedButServing({ rolloutFailed: true, ready: 1 }, false), true);   // failed, old serving
  assert.equal(W.deployFailedButServing({ rolloutFailed: false, ready: 1 }, false), false);  // healthy deploy
  assert.equal(W.deployFailedButServing({ rolloutFailed: true, ready: 0 }, false), false);   // nothing serving → not this case
  assert.equal(W.deployFailedButServing({ rolloutFailed: true, ready: 1 }, true), false);    // suspended → n/a
});

test('reconcileClaim: an ACTIVE result can carry a reason from verify (serving previous version)', async () => {
  const r = await reconcileClaim({}, {
    apply: async () => {},
    verify: async () => ({ present: true, reason: 'DEPLOY_FAILED_PREVIOUS_RUNNING' }),
  });
  assert.equal(r.state, 'ACTIVE');                          // service stays up
  assert.equal(r.reason, 'DEPLOY_FAILED_PREVIOUS_RUNNING'); // but the failed deploy is flagged
});

test('reconcileClaim: present with no reason stays a clean ACTIVE (back-compat)', async () => {
  const r = await reconcileClaim({}, { apply: async () => {}, verify: async () => ({ present: true }) });
  assert.equal(r.state, 'ACTIVE');
  assert.equal(r.reason, null);
});
