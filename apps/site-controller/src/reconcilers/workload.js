'use strict';

/**
 * Workload reconciler — deploy a tenant's app from an approved image digest into its
 * hardened namespace (Deployment + Service via the shared renderers). Converge →
 * verify readiness → status, reusing the shared engine. Reconciles App CRDs whose
 * spec carries an `image` (BYO / our-registry, or a build-resolved digest).
 */

const M = require('../renderers/manifests');
const arka = require('../cluster/arkaClient');
const { reconcileClaim, isPermanentK8sError } = require('./engine');

// Pure: what a tenant's lifecycle means for its RUNTIME (unit-tested). A tenant SUSPENDED in
// WORKLOADS_STOPPED/SECURITY_ISOLATED stops workloads (replicas → 0); MUTATIONS_BLOCKED leaves
// the runtime alone (that gate is product-side); ACTIVE runs normally.
function lifecycleFor({ desiredState, suspendMode } = {}) {
  if (desiredState === 'SUSPENDED') {
    return (suspendMode === 'WORKLOADS_STOPPED' || suspendMode === 'SECURITY_ISOLATED')
      ? { action: 'suspend', mode: suspendMode }
      : { action: 'none' };
  }
  return { action: 'run' };
}
const isSuspended = (lifecycle) => lifecycleFor(lifecycle).action === 'suspend';

// Pure: from a Deployment status snapshot, did the latest redeploy FAIL while the previous
// version is still serving? (rollout hit the progress deadline, but ready pods ≥ 1 because
// maxUnavailable:0 kept the old ReplicaSet up.) Unit-tested.
function deployFailedButServing(s = {}, suspended = false) {
  return !suspended && !!s.rolloutFailed && (s.ready || 0) >= 1;
}

// App input → the deployWorkload spec (hardened renderers do the securityContext).
function toWorkloadSpec(app) {
  return {
    tenantId: app.tenantId,
    name: app.appId,
    image: app.image,
    port: app.port || 8080,
    replicas: app.replicas || 1,
    cpu: `${app.cpuLimitM || 500}m`,
    memory: `${app.memLimitMiB || 512}Mi`,
    ...(app.host ? { host: app.host } : {}),   // public host for the self-managed Ingress
    ...(app.owner ? { owner: app.owner } : {}),
    ...(app.runtime ? { runtime: app.runtime } : {}),
    ...(Array.isArray(app.env) && app.env.length ? { env: app.env } : {}),
    ...(Array.isArray(app.command) && app.command.length ? { command: app.command } : {}),
  };
}

// Pure: the objects the workload reconciler applies. When self-ingress is on and the app has a
// public host, a per-app Ingress is included so `<host>` routes to its Service.
function desired(app) {
  const s = toWorkloadSpec(app);
  const objs = [M.deploymentManifest(s), M.serviceManifest(s)];
  if (M.SELF_INGRESS && s.host) objs.push(M.ingressManifest({ tenantId: s.tenantId, name: s.name, host: s.host, port: s.port }));
  return objs;
}

// `lifecycle` = the owning tenant's { desiredState, suspendMode } (from the TenantClaim). A
// suspended tenant scales its apps to 0; otherwise they run at their desired replicas.
async function reconcileApp(app, lifecycle = {}) {
  if (app.desiredState === 'DELETED') return decommissionApp(app);
  const suspended = isSuspended(lifecycle);
  let ingressReady = true; // deployWorkload sets false while the Ingress is deferred (DNS pending)
  return reconcileClaim(app, {
    apply: async (a) => {
      if (!a.image) { const e = new Error('no approved image yet'); e.permanent = false; throw e; } // wait for build
      try {
        const r = await arka.deployWorkload(toWorkloadSpec(a));
        ingressReady = r && r.ingressReady !== false;
        // Enforce the tenant lifecycle on THIS app's Deployment (workload reconciler owns it).
        await arka.setWorkloadReplicas(a.tenantId, a.appId, suspended ? 0 : (a.replicas || 1));
      } catch (e) { if (isPermanentK8sError(e)) e.permanent = true; throw e; }
    },
    verify: async (a) => {
      const s = await arka.workloadStatus(a.tenantId, a.appId);
      const workloadOk = suspended ? (s.replicas || 0) === 0 : s.ready >= 1;
      // Safe-redeploy: if a new rollout failed readiness, k8s (maxUnavailable:0) kept the previous
      // version serving. The service is still UP (ready >= 1), so we stay ACTIVE — but attach a
      // reason so the deploy is flagged as failed rather than silently reported as success.
      const deployFailed = deployFailedButServing(s, suspended);
      if (deployFailed) console.warn(`[workload] ${a.appId}: redeploy failed readiness within the deadline — previous version kept running`);
      // A public app isn't fully converged until its Ingress is up — stays RECONCILING
      // ("deploying") while DNS propagates, then flips to ACTIVE ("online"). Suspended apps
      // scale to 0 and don't need an ingress.
      return {
        present: workloadOk && (suspended || ingressReady),
        suspended, ingressReady, deployFailed,
        ...(deployFailed ? { reason: 'DEPLOY_FAILED_PREVIOUS_RUNNING' } : {}),
        ...s,
      };
    },
  });
}

// Decommission path: tear the workload down, then confirm it's gone. Unlike the
// deploy path, ABSENCE is success (DELETED); still-present is a pending teardown.
async function decommissionApp(app) {
  try {
    await arka.teardownWorkload(app.tenantId, app.appId);
  } catch (e) {
    if (isPermanentK8sError(e)) return { state: 'FAILED', reason: 'TEARDOWN_REJECTED' };
    return { state: 'RECONCILING', reason: 'TEARDOWN_RETRY' };
  }
  try {
    await arka.workloadStatus(app.tenantId, app.appId); // 404 → gone
    return { state: 'RECONCILING', reason: 'TEARDOWN_PENDING' };
  } catch (e) {
    const code = e?.statusCode ?? e?.response?.statusCode ?? e?.body?.code;
    if (code === 404) return { state: 'DELETED', reason: null };
    return { state: 'RECONCILING', reason: 'TEARDOWN_PENDING' };
  }
}

// App CRD → reconcile input (strip t- so namespace is rb-t-<id>).
function appToInput(crd) {
  return {
    name: crd.metadata?.name,
    tenantId: String(crd.spec?.tenantId || '').replace(/^t-/, ''),
    appId: crd.spec?.appId,
    image: crd.spec?.image || null,
    runtime: crd.spec?.runtime || null,
    port: crd.spec?.port || 8080,
    owner: crd.spec?.owner || null,
    // Host rides as an annotation (schema-safe across CRD versions); fall back to spec.host.
    host: crd.metadata?.annotations?.['rachbase.io/host'] || crd.spec?.host || null,
    env: Array.isArray(crd.spec?.env) ? crd.spec.env : null,
    command: Array.isArray(crd.spec?.command) ? crd.spec.command : null,
    cpuLimitM: crd.spec?.resources?.cpuLimitM,
    memLimitMiB: crd.spec?.resources?.memLimitMiB,
    replicas: crd.spec?.replicas || 1,
    generation: crd.spec?.generation || 1,
    operationId: crd.spec?.operationId,
    desiredState: crd.spec?.desiredState || 'ACTIVE',
  };
}

// The app's public URL (SpaceArk provisions the ingress; the host is derived from
// the app id + the site's apps domain). Surfaced in status once the app is ACTIVE.
function urlFor(input) {
  // The app's public host is chosen product-side (<service-slug>.rachbase.app or a user custom
  // domain) and carried on the App spec. Fall back to the appId-based host only if absent.
  const host = input.host || `${input.appId}.${process.env.SITE_APPS_DOMAIN || 'apps.rachbase.app'}`;
  return `https://${host}`;
}

function statusPatch(result, input) {
  const generation = typeof input === 'object' ? input.generation : input; // tolerate (result, generation)
  const status = { state: result.state, reason: result.reason || null, observedGeneration: generation, updatedAt: new Date().toISOString() };
  if (result.state === 'ACTIVE' && typeof input === 'object') status.url = urlFor(input);
  return { status };
}

// True when the newly-computed status differs from what's already on the App CR. `updatedAt`
// is ignored (it always changes). Without this the reconciler patches status on EVERY pass,
// and each status-subresource patch re-fires the App watch → reconcile → patch → a hot loop
// (seen as the same "<app>: <state>" line, e.g. DELETED, logged again and again). Pure.
function appStatusChanged(current = {}, next = {}) {
  const c = current || {};
  const n = next || {};
  return c.state !== n.state
    || (c.reason || null) !== (n.reason || null)
    || (c.observedGeneration ?? null) !== (n.observedGeneration ?? null)
    || (c.url || null) !== (n.url || null);
}

module.exports = { toWorkloadSpec, desired, lifecycleFor, reconcileApp, appToInput, statusPatch, appStatusChanged, urlFor, deployFailedButServing };
