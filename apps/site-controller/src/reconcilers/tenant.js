'use strict';

/**
 * Tenant reconciler mapping (contract §6). Given a TenantClaim (tenantId + plan),
 * derive the exact boundary objects and converge them. `desired()` is pure and
 * unit-tested; `reconcile()` applies to the cluster (idempotent).
 *
 * The production reconciler watches the TenantClaim CRD and server-side-applies with
 * a stable field manager + force=false, reporting ACTIVE only after every boundary
 * object verifies. This first path reuses the imperative provisioner to prove the
 * BFF → request → namespace-ACTIVE flow end to end.
 */

const M = require('../renderers/manifests');
const { planOrThrow } = require('../plans/catalog');
const arka = require('../cluster/arkaClient');
const { metrics } = require('../metrics');

// SpaceArk plan → namespace ResourceQuota.
function quotaFromPlan(plan) {
  const p = planOrThrow(plan);
  return { cpu: p.cpuLimit, memory: `${p.memLimitMiB}Mi`, pods: p.maxApps + 2, pvcs: p.maxApps + 2 };
}

// Pure: the exact desired objects for a TenantClaim (no cluster).
function desired({ tenantId, plan }) {
  return M.tenantObjects(tenantId, quotaFromPlan(plan));
}

// Apply the tenant boundary to the cluster (idempotent). Returns { namespace }. The tenant
// reconciler owns only the boundary (§9.2) — it does NOT touch Deployments; the WORKLOAD
// reconciler enforces suspend/resume replica-scaling (it owns the runtime + has deployments RBAC).
async function reconcile({ tenantId, plan }) {
  return arka.provisionNamespace(tenantId, quotaFromPlan(plan));
}

// Reconcile engine is shared (see reconcilers/engine.js); re-exported for callers/tests.
const { reconcileClaim, isPermanentK8sError } = require('./engine');

// Real wiring: apply via the provisioner (tagging permanent k8s errors), verify via
// the boundary read.
async function reconcileOnce(claim) {
  return reconcileClaim(claim, {
    apply: async (c) => {
      try { await reconcile(c); }
      catch (e) { if (isPermanentK8sError(e)) e.permanent = true; throw e; }
    },
    verify: (c) => arka.verifyTenant(c.tenantId),
  });
}

// Map a TenantClaim CRD → reconcile input. The spec's SpaceArk ref (t-<id>) is
// stripped to the bare id so the namespace is rb-t-<id> (consistent with numeric ids).
function claimToInput(crd) {
  return {
    name: crd.metadata?.name,
    tenantId: String(crd.spec?.tenantId || '').replace(/^t-/, ''),
    plan: crd.spec?.plan,
    desiredState: crd.spec?.desiredState || 'ACTIVE',
    suspendMode: crd.spec?.suspendMode || null,
    generation: crd.spec?.generation || 1,
    operationId: crd.spec?.operationId,
  };
}

// Build the CRD status subresource patch from a reconcile result.
function statusPatch(result, generation) {
  return {
    status: {
      state: result.state,
      reason: result.reason || null,
      observedGeneration: generation,
      updatedAt: new Date().toISOString(),
    },
  };
}

// Poll loop: list TenantClaims, converge each, write status back. `listClaims` returns
// reconcile inputs; `onStatus(input, result)` persists the CRD status (both injected).
// Emits bounded §10 controller metrics (reconcile_total/duration, queue_depth).
function startReconciler({ listClaims, intervalMs = 5000, onStatus = () => {}, controller = 'tenant' } = {}) {
  let stopped = false;
  (async function loop() {
    while (!stopped) {
      try {
        const claims = (await listClaims()) || [];
        metrics.queueDepth(controller, claims.length);
        for (const c of claims) {
          const t0 = Date.now();
          const result = await reconcileOnce(c);
          metrics.reconcileDuration(controller, (Date.now() - t0) / 1000);
          metrics.reconcile(controller, result.state, result.reason);
          await onStatus(c, result);
        }
      } catch (e) {
        metrics.reconcile(controller, 'ERROR', 'LOOP_ERROR');
        console.error('[tenant-reconciler] loop error:', e.message);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  })();
  return () => { stopped = true; };
}

module.exports = {
  quotaFromPlan, desired, reconcile, reconcileClaim, reconcileOnce,
  startReconciler, isPermanentK8sError, claimToInput, statusPatch,
};
