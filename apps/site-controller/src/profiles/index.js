'use strict';

/**
 * The four site-controller components (SpaceArk contract §2.1). One signed image;
 * a startup profile selects EXACTLY ONE, immutable for the process lifetime and
 * never changeable via HTTP. In production each runs as its own Deployment with
 * its own ServiceAccount + minimal RBAC — a defect in the Internet-facing API
 * facade must not grant Namespace or workload mutation rights.
 *
 * These are SKELETONS; the API facade and reconcile loops are implemented next.
 */

const { metrics } = require('../metrics');

const notImplemented = (name) => async () => {
  console.warn(`profile "${name}" is a skeleton — idling (not implemented). Container stays healthy; no work performed.`);
  // A pending promise ALONE does not keep Node's event loop alive — the process would exit 0
  // (seen as a crashlooping "Completed" pod). A ref'd timer holds the loop open doing nothing,
  // so the Deployment stays Running until the profile is implemented.
  const keepAlive = setInterval(() => {}, 1 << 30); // ~12 days; effectively never fires
  return new Promise(() => { void keepAlive; }); // never resolves
};

// Run watch-driven reconciler(s), but only while this replica holds the profile's Lease
// (leader election → single active reconciler; other replicas stand by hot). The primary
// informer drives the profile's own resource; optional `extraWatches` react to related
// resources (e.g. the workload reconciler watching TenantClaims to apply suspend/resume
// immediately). All informers start on election and stop on deposition.
function reconcilerUnderLeader({ leaseName, watchArgs, listAll, reconcileItem, controller = null, extraWatches = [] }) {
  const { startInformer, k8sConnect } = require('../cluster/informer');
  const { runLeaderElection, k8sLeaseIO } = require('../cluster/leaderElection');
  const { loadArkaKubeConfig } = require('../cluster/kubeconfig');
  const kc = loadArkaKubeConfig();
  const namespace = watchArgs.namespace;
  const identity = process.env.POD_NAME || `${leaseName}-${process.pid}`;
  let stops = [];

  runLeaderElection({
    ...k8sLeaseIO(kc, { namespace, name: leaseName }),
    identity,
    onElected: () => {
      console.log(`${leaseName}: elected leader (${identity}) — starting informer${extraWatches.length ? 's' : ''}.`);
      stops.push(startInformer({ connect: k8sConnect(kc, watchArgs), listAll, reconcileItem, controller }));
      for (const w of extraWatches) {
        stops.push(startInformer({ connect: k8sConnect(kc, w.watchArgs), listAll: w.listAll || (async () => []), reconcileItem: w.reconcileItem }));
      }
    },
    onDeposed: () => {
      console.log(`${leaseName}: lost leadership — stopping informer(s).`);
      for (const stop of stops) { try { stop(); } catch { /* ignore */ } }
      stops = [];
    },
  });
}

const PROFILES = {
  api: {
    describe: 'API facade — site API auth, idempotency, admission/capacity, create request CRDs (spaceark-site-requests only); NO namespace/RBAC/workload writes',
    start: async () => {
      const { startApiServer } = require('../api/facade');
      const { verifyPartnerJwt } = require('../api/jwtVerify');
      const { createIdempotencyStore, createDurableIdempotencyStore, k8sConfigMapBackend } = require('../api/idempotency');
      const claimStore = require('../api/claimStore');
      const seenJti = new Set(); // jti replay guard (in-memory; same ConfigMap backend can back it durably)

      // Durable, replica-shared idempotency when a ConfigMap name is configured; else in-memory.
      let idempotency;
      if (process.env.IDEMPOTENCY_CONFIGMAP) {
        const k8s = require('@kubernetes/client-node');
        const { loadArkaKubeConfig } = require('../cluster/kubeconfig');
        const core = loadArkaKubeConfig().makeApiClient(k8s.CoreV1Api);
        const backend = k8sConfigMapBackend(core, { namespace: claimStore.NAMESPACE, name: process.env.IDEMPOTENCY_CONFIGMAP });
        idempotency = createDurableIdempotencyStore({ backend });
        console.log(`api facade: durable idempotency via ConfigMap ${claimStore.NAMESPACE}/${process.env.IDEMPOTENCY_CONFIGMAP}`);
      } else {
        idempotency = createIdempotencyStore();
      }

      startApiServer({
        siteId: process.env.SITE_ID || 'site1',
        verifyJwt: (token) => verifyPartnerJwt(token, { seenJti }),
        idempotency,
        createClaim: claimStore.createClaim,
        createApp: claimStore.createApp,
        createRelease: claimStore.createRelease,
        deleteApp: claimStore.markAppDeleted,
        deleteTenant: claimStore.markTenantDeleted,
        suspendTenant: claimStore.suspendTenant,
        resumeTenant: claimStore.resumeTenant,
        getOperation: claimStore.getOperation,
        // Registry listing is SpaceArk's to implement (it owns the registry). Stub → [].
        listRegistryImages: async () => [],
      });
      await new Promise(() => {}); // long-running Deployment
    },
  },
  tenant: {
    describe: 'Tenant reconciler — Namespace, quota, limits, ServiceAccounts, NetworkPolicy, approved RoleBindings',
    start: async () => {
      const R = require('../reconcilers/tenant');
      const claimStore = require('../api/claimStore');
      console.log('tenant reconciler: watching TenantClaims → converge → verify → write status (leader-elected).');
      reconcilerUnderLeader({
        leaseName: 'rb-tenant-reconciler',
        watchArgs: { group: claimStore.GROUP, version: claimStore.VERSION, namespace: claimStore.NAMESPACE, plural: claimStore.PLURAL },
        listAll: async () => claimStore.listClaims(),
        controller: 'tenant',
        reconcileItem: async (crd) => {
          const input = R.claimToInput(crd);
          const t0 = Date.now();
          const s = await R.reconcileOnce(input);
          metrics.reconcileDuration('tenant', (Date.now() - t0) / 1000);
          metrics.reconcile('tenant', s.state, s.reason);
          await claimStore.patchStatus(input.name, R.statusPatch(s, input.generation));
          console.log(`${input.name}: ${s.state}${s.reason ? ` (${s.reason})` : ''}${s.message ? ` — ${s.message}` : ''}`);
        },
      });
      await new Promise(() => {}); // stay up (this is a long-running Deployment)
    },
  },
  workload: {
    describe: 'Workload reconciler — managed application-runtime objects via per-tenant RoleBindings',
    start: async () => {
      const W = require('../reconcilers/workload');
      const claimStore = require('../api/claimStore');
      console.log('workload reconciler: watching Apps (+ TenantClaims for suspend/resume) → deploy → verify → status (leader-elected).');

      // Remember each tenant's last suspend-relevant lifecycle so the TenantClaim watch fires
      // ONLY when it actually changes (skips status-subresource patches, which also emit MODIFIED).
      const lastLifecycle = new Map(); // tenantId → "desiredState|suspendMode"

      // Reconcile ONE app against its tenant's lifecycle (deploy/scale + status). Shared by
      // the App watch and the TenantClaim watch so both paths behave identically.
      const reconcileOneApp = async (crd, lifecycle) => {
        const input = W.appToInput(crd);
        const life = lifecycle || await claimStore.tenantLifecycle(input.tenantId);
        const t0 = Date.now();
        const s = await W.reconcileApp(input, life);
        metrics.reconcileDuration('workload', (Date.now() - t0) / 1000);
        metrics.reconcile('workload', s.state, s.reason);

        // Teardown CONFIRMED (workload gone): remove the App CR so it isn't reconciled forever.
        // `deletionTimestamp` guard + idempotent delete avoid re-logging while the delete lands.
        if (s.state === 'DELETED') {
          if (!crd.metadata?.deletionTimestamp) {
            await claimStore.deleteApp(input.name);
            console.log(`${input.name}: DELETED — App CR removed`);
          }
          return;
        }

        // Only write status + log when it actually changed — otherwise the status patch re-fires
        // this same App watch and we hot-loop (repeated "<app>: <state>" logs).
        const next = W.statusPatch(s, input).status;
        if (W.appStatusChanged(crd.status || {}, next)) {
          await claimStore.patchAppStatus(input.name, { status: next });
          console.log(`${input.name}: ${s.state}${s.reason ? ` (${s.reason})` : ''}${s.message ? ` — ${s.message}` : ''}`);
        }
      };

      reconcilerUnderLeader({
        leaseName: 'rb-workload-reconciler',
        watchArgs: { group: claimStore.GROUP, version: claimStore.VERSION, namespace: claimStore.NAMESPACE, plural: 'apps' },
        listAll: async () => claimStore.listApps(),
        controller: 'workload',
        reconcileItem: (crd) => reconcileOneApp(crd),
        // Immediate suspend/resume: on a TenantClaim change, re-reconcile that tenant's apps
        // with the new lifecycle (scale to 0 / restore) instead of waiting for the app resync.
        extraWatches: [{
          watchArgs: { group: claimStore.GROUP, version: claimStore.VERSION, namespace: claimStore.NAMESPACE, plural: claimStore.PLURAL },
          listAll: async () => claimStore.listClaims(),
          reconcileItem: async (tc) => {
            const tenantId = String(tc.spec?.tenantId || '').replace(/^t-/, '');
            const desiredState = tc.spec?.desiredState || 'ACTIVE';
            const suspendMode = tc.spec?.suspendMode || null;
            const sig = `${desiredState}|${suspendMode}`;
            if (lastLifecycle.get(tenantId) === sig) return; // unchanged → skip (e.g. a status patch)
            lastLifecycle.set(tenantId, sig);
            const lifecycle = { desiredState, suspendMode };
            for (const appCrd of (await claimStore.listApps())) {
              if (W.appToInput(appCrd).tenantId === tenantId) await reconcileOneApp(appCrd, lifecycle);
            }
          },
        }],
      });
      await new Promise(() => {});
    },
  },
  build: {
    describe: 'Build reconciler — source-to-image lifecycle, SBOM/scan/signature, immutable digest',
    start: notImplemented('build'),
  },
};

const selectProfile = (name) => PROFILES[name] || null;

module.exports = { PROFILES, selectProfile };
