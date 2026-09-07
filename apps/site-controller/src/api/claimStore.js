'use strict';

/**
 * TenantClaim request-CRD store (contract §5). The api facade's ONLY cluster write:
 * create a TenantClaim in `spaceark-site-requests`; the tenant reconciler watches it.
 * `getOperation` reads the claim's status back for GET /operations. Requires the
 * TenantClaim CRD to be installed (SpaceArk owns CRD installation; deploy/crds has it).
 */

const k8s = require('@kubernetes/client-node');
const { loadArkaKubeConfig } = require('../cluster/kubeconfig');

const GROUP = 'rachbase.io';
const VERSION = 'v1';
const PLURAL = 'tenantclaims';
const NAMESPACE = process.env.SITE_REQUESTS_NAMESPACE || 'spaceark-site-requests';

const unwrap = (r) => (r && r.body !== undefined ? r.body : r);
const api = () => loadArkaKubeConfig().makeApiClient(k8s.CustomObjectsApi);

// TenantClaim CRD name = the tenant ref (`t-<id>`). The BFF passes the ref already prefixed,
// so normalize to a SINGLE `t-` (avoids the `t-t-<id>` double-prefix) and keep every
// create/patch/get call addressing the same object.
const claimName = (tenantId) => (String(tenantId).startsWith('t-') ? String(tenantId) : `t-${tenantId}`);

// Server-side apply (create-or-update, idempotent, stable field manager, force=true
// so we own the spec fields). Replaces create-or-409 so re-PUTs actually update spec.
async function applyObject(plural, name, obj) {
  // @kubernetes/client-node@0.22 signature: (group, version, namespace, plural, name, body,
  // dryRun, fieldManager, force, options). No `pretty` arg — an extra positional shifts the
  // options object out of range and the `application/apply-patch+yaml` Content-Type is lost,
  // which the apiserver rejects with 415. Keep exactly: dryRun, fieldManager, force, options.
  await api().patchNamespacedCustomObject(
    GROUP, VERSION, NAMESPACE, plural, name, obj,
    undefined, 'rachbase-site-controller', true,
    { headers: { 'Content-Type': 'application/apply-patch+yaml' } },
  );
}

async function createClaim({ tenantId, plan, customerRef, generation = 1, operationId }) {
  const ref = claimName(tenantId);
  const obj = {
    apiVersion: `${GROUP}/${VERSION}`,
    kind: 'TenantClaim',
    metadata: { name: ref, namespace: NAMESPACE, labels: { 'rachbase.io/tenant': ref } },
    spec: { tenantId: ref, plan, customerRef, generation, operationId, desiredState: 'ACTIVE' },
  };
  await applyObject(PLURAL, ref, obj);
  return { name: ref };
}

// All TenantClaims in the requests namespace (the reconciler's list/watch source).
async function listClaims() {
  const list = unwrap(await api().listNamespacedCustomObject(GROUP, VERSION, NAMESPACE, PLURAL));
  return list.items || [];
}

// The owning tenant's lifecycle ({ desiredState, suspendMode }) for the workload reconciler
// to enforce suspend/resume replica scaling. Missing/absent claim → treated as ACTIVE.
async function tenantLifecycle(tenantId) {
  try {
    const obj = unwrap(await api().getNamespacedCustomObject(GROUP, VERSION, NAMESPACE, PLURAL, claimName(tenantId)));
    return { desiredState: obj?.spec?.desiredState || 'ACTIVE', suspendMode: obj?.spec?.suspendMode || null };
  } catch {
    return { desiredState: 'ACTIVE', suspendMode: null };
  }
}

// Patch a claim's status subresource (owned by the reconciler). `statusBody` = { status: {...} }.
async function patchStatus(name, statusBody) {
  await api().patchNamespacedCustomObjectStatus(
    GROUP, VERSION, NAMESPACE, PLURAL, name, statusBody,
    undefined, undefined, undefined,
    { headers: { 'Content-Type': 'application/merge-patch+json' } },
  );
}

// Internal reconciler states (engine) → the contract's operation states (§4.3).
const OP_STATE = { ACTIVE: 'SUCCEEDED', DEPLOYED: 'SUCCEEDED' };
const toOpState = (s) => OP_STATE[s] || s || 'ACCEPTED';

// Resolve an operation across the request CRDs it may live on (TenantClaim, then App).
// Surfaces the app's public URL once ACTIVE. Read back by the BFF's status-poll worker.
async function getOperation(operationId) {
  const sources = [
    { plural: PLURAL, type: 'tenant', id: (c) => c.spec.tenantId },
    { plural: 'apps', type: 'app', id: (c) => c.spec.appId },
  ];
  for (const src of sources) {
    const list = unwrap(await api().listNamespacedCustomObject(GROUP, VERSION, NAMESPACE, src.plural));
    const item = (list.items || []).find((c) => c.spec?.operationId === operationId);
    if (!item) continue;
    const st = item.status || {};
    return {
      operationId,
      state: toOpState(st.state),
      resource: { type: src.type, id: src.id(item) },
      observedGeneration: st.observedGeneration || item.spec.generation,
      reason: st.reason || null,
      message: st.message || null,
      url: st.url || null,
      updatedAt: st.updatedAt || null,
    };
  }
  return null;
}

// ── App / Release CRDs (workload + build reconcilers) ──────────────────────────
async function createApp({ tenantId, appId, runtime = null, image = null, port = 8080, resources = {}, owner = null, env = null, command = null, host = null, operationId, generation = 1 }) {
  // `host` rides as an ANNOTATION (not schema-validated) so the workload reconciler can build a
  // self-managed Ingress regardless of whether the App CRD declares spec.host. It's ALSO placed
  // in spec.host only when SITE_APP_SPEC_HOST=1 (i.e. the installed CRD supports it) — otherwise
  // an older CRD rejects the undeclared field with a 500.
  const specHost = host && process.env.SITE_APP_SPEC_HOST === '1';
  const obj = {
    apiVersion: `${GROUP}/${VERSION}`, kind: 'App',
    metadata: {
      name: appId, namespace: NAMESPACE,
      labels: { 'rachbase.io/tenant': String(tenantId), 'rachbase.io/app': appId },
      ...(host ? { annotations: { 'rachbase.io/host': String(host) } } : {}),
    },
    // Omit null image (CRD types it as string → `null` is rejected 422; it's optional here —
    // a source deploy resolves the digest later via the build path).
    spec: { tenantId: String(tenantId), appId, ...(runtime ? { runtime: String(runtime) } : {}), ...(image ? { image: String(image) } : {}), port, generation, operationId, resources, ...(owner ? { owner: String(owner) } : {}), ...(specHost ? { host: String(host) } : {}), ...(Array.isArray(env) && env.length ? { env } : {}), ...(Array.isArray(command) && command.length ? { command } : {}) },
  };
  await applyObject('apps', appId, obj);
  return { name: appId };
}

async function createRelease({ tenantId, appId, deploymentId, source = null, image = null, externalImage = null, applicationGeneration = 1, operationId }) {
  const name = deploymentId || `rel-${operationId}`;
  const obj = {
    apiVersion: `${GROUP}/${VERSION}`, kind: 'Release',
    metadata: { name, namespace: NAMESPACE, labels: { 'rachbase.io/tenant': String(tenantId), 'rachbase.io/app': appId } },
    // Omit null source/image (CRD types them → `null` fails validation). Exactly one of
    // source / image / externalImage is set per release.
    spec: { tenantId: String(tenantId), appId, deploymentId, ...(source ? { source } : {}), ...(image ? { image: String(image) } : {}), ...(externalImage ? { externalImage: String(externalImage) } : {}), applicationGeneration, operationId, desiredState: 'DEPLOYED' },
  };
  await applyObject('releases', name, obj);
  return { name };
}

async function listApps() {
  const l = unwrap(await api().listNamespacedCustomObject(GROUP, VERSION, NAMESPACE, 'apps'));
  return l.items || [];
}

async function patchAppStatus(name, statusBody) {
  await api().patchNamespacedCustomObjectStatus(GROUP, VERSION, NAMESPACE, 'apps', name, statusBody,
    undefined, undefined, undefined, { headers: { 'Content-Type': 'application/merge-patch+json' } });
}

// Merge-patch a request CRD's spec (keeps other spec fields we own). Used to flip
// desiredState to DELETED so the reconciler tears the resource down — a merge patch,
// NOT server-side apply, so image/resources/plan aren't dropped.
async function patchSpec(plural, name, specPatch) {
  await api().patchNamespacedCustomObject(GROUP, VERSION, NAMESPACE, plural, name, { spec: specPatch },
    undefined, undefined, undefined, { headers: { 'Content-Type': 'application/merge-patch+json' } });
}

// Deleting an already-absent request CRD is success (idempotent DELETE) — swallow 404.
async function tolerate404(promise) {
  try { return await promise; }
  catch (e) { if ((e.statusCode ?? e.response?.statusCode ?? e.body?.code) === 404) return null; throw e; }
}

async function markAppDeleted({ appId, operationId, generation }) {
  await tolerate404(patchSpec('apps', appId, { desiredState: 'DELETED', operationId, ...(generation ? { generation } : {}) }));
  return { name: appId };
}

// Remove an App CR once its workload teardown is CONFIRMED (state DELETED). Without this a
// DELETED app lingers and is re-reconciled forever. Idempotent — an already-gone CR is success.
async function deleteApp(appId) {
  await tolerate404(api().deleteNamespacedCustomObject(GROUP, VERSION, NAMESPACE, 'apps', appId));
  return { name: appId };
}

async function markTenantDeleted({ tenantId, operationId, generation }) {
  await tolerate404(patchSpec(PLURAL, claimName(tenantId), { desiredState: 'DELETED', operationId, ...(generation ? { generation } : {}) }));
  return { name: claimName(tenantId) };
}

// Suspend/resume flip the TenantClaim desiredState (+ suspendMode) so the tenant reconciler
// converges routing/runtime; the CRD spec is otherwise unchanged (no data touched).
async function suspendTenant({ tenantId, mode, operationId, generation }) {
  await tolerate404(patchSpec(PLURAL, claimName(tenantId), { desiredState: 'SUSPENDED', suspendMode: mode, operationId, ...(generation ? { generation } : {}) }));
  return { name: claimName(tenantId) };
}
async function resumeTenant({ tenantId, operationId, generation }) {
  await tolerate404(patchSpec(PLURAL, claimName(tenantId), { desiredState: 'ACTIVE', suspendMode: null, operationId, ...(generation ? { generation } : {}) }));
  return { name: claimName(tenantId) };
}

module.exports = {
  createClaim, listClaims, patchStatus, getOperation, tenantLifecycle,
  createApp, createRelease, listApps, patchAppStatus, deleteApp,
  markAppDeleted, markTenantDeleted, suspendTenant, resumeTenant,
  GROUP, VERSION, PLURAL, NAMESPACE,
};
