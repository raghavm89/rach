'use strict';

/**
 * ArkaClient — the reconcilers' access to the site's Kubernetes API.
 *
 * Dev/bootstrap: `health` + imperative `provisionNamespace`/`deployWorkload` prove
 * the renderers apply cleanly on real k3s. The production reconcilers converge the
 * same rendered objects declaratively (server-side apply, stable field manager,
 * force=false) off request CRDs — but the objects are exactly these renderers.
 *
 * `@kubernetes/client-node` is pinned to 0.22.x (CommonJS); calls resolve to
 * `{ body }`, normalised by `unwrap()`.
 */

const k8s = require('@kubernetes/client-node');
const dns = require('dns').promises;
const { loadArkaKubeConfig } = require('./kubeconfig');
const M = require('../renderers/manifests');

// PUBLIC resolvers to check propagation against (like Let's Encrypt's global vantage points).
const DNS_CHECK_RESOLVERS = (process.env.SITE_DNS_CHECK_RESOLVERS || '8.8.8.8,1.1.1.1')
  .split(',').map((s) => s.trim()).filter(Boolean);

// Does `host` resolve on ONE public resolver? Bounded so a slow/unreachable resolver can't stall.
async function resolvesOn(server, host) {
  const r = new dns.Resolver({ timeout: 3000, tries: 1 });
  r.setServers([server]);
  try { const a = await r.resolve4(host); return Array.isArray(a) && a.length > 0; }
  catch { return false; }
}

// Is `host` GLOBALLY resolvable? We require it on ALL configured public resolvers before creating
// the Ingress, so Traefik's HTTP-01 challenge fires only after the record has propagated
// everywhere — otherwise Let's Encrypt's multi-perspective ("secondary") validation hits a
// still-NXDOMAIN vantage point and negatively-caches it, failing every retry until it expires.
async function hostResolves(host) {
  if (!DNS_CHECK_RESOLVERS.length) { try { return (await dns.resolve4(host)).length > 0; } catch { return false; } }
  const results = await Promise.all(DNS_CHECK_RESOLVERS.map((s) => resolvesOn(s, host)));
  return results.every(Boolean);
}

const unwrap = (r) => (r && r.body !== undefined ? r.body : r);

// The build boundary (§9.5 step 8) is provisioned only when builds are enabled — SpaceArk's
// build service is a pending handoff, so it's off by default.
const BUILDS_ENABLED = process.env.SITE_BUILDS_ENABLED === 'true';

async function ignoreStatus(promise, ...codes) {
  try {
    return await promise;
  } catch (e) {
    const s = e?.statusCode ?? e?.response?.statusCode ?? e?.body?.code;
    if (codes.includes(s)) return null;
    throw e;
  }
}

function makeClient() {
  const kc = loadArkaKubeConfig();
  return {
    kc,
    core: kc.makeApiClient(k8s.CoreV1Api),
    apps: kc.makeApiClient(k8s.AppsV1Api),
    net: kc.makeApiClient(k8s.NetworkingV1Api),
    rbac: kc.makeApiClient(k8s.RbacAuthorizationV1Api),
    version: kc.makeApiClient(k8s.VersionApi),
  };
}

async function health() {
  const { kc, core, version } = makeClient();
  const cluster = kc.getCurrentCluster();
  const ver = unwrap(await version.getCode());
  const nodes = unwrap(await core.listNode());
  const namespaces = unwrap(await core.listNamespace());
  return {
    clusterName: cluster?.name,
    server: cluster?.server,
    version: ver.gitVersion,
    platform: ver.platform,
    nodes: nodes.items.map((n) => ({
      name: n.metadata?.name,
      ready: (n.status?.conditions || []).find((c) => c.type === 'Ready')?.status === 'True',
      kubelet: n.status?.nodeInfo?.kubeletVersion,
    })),
    namespaces: namespaces.items.map((x) => x.metadata?.name),
  };
}

async function provisionNamespace(tenantId, quota) {
  const c = makeClient();
  const ns = M.NS(tenantId);
  await ignoreStatus(c.core.createNamespace(M.namespaceManifest(tenantId)), 409);
  // Declarative desired-state → create-or-replace so renderer changes reach existing tenants.
  await convergeNamespaced(c, 'core', 'ResourceQuota', ns, M.resourceQuotaManifest(tenantId, quota));
  await convergeNamespaced(c, 'core', 'LimitRange', ns, M.limitRangeManifest(tenantId));
  await convergeNamespaced(c, 'net', 'NetworkPolicy', ns, M.defaultDenyNetworkPolicyManifest(tenantId));
  await convergeNamespaced(c, 'net', 'NetworkPolicy', ns, M.allowDnsNetworkPolicyManifest(tenantId));
  await convergeNamespaced(c, 'net', 'NetworkPolicy', ns, M.allowGatewayIngressNetworkPolicyManifest(tenantId));
  if (M.SELF_INGRESS) await convergeNamespaced(c, 'net', 'NetworkPolicy', ns, M.allowIngressControllerNetworkPolicyManifest(tenantId));
  await convergeNamespaced(c, 'net', 'NetworkPolicy', ns, M.allowEgressNetworkPolicyManifest(tenantId));
  // Tokenless runtime ServiceAccount (identity — create-once) + the per-tenant workload
  // Role/RoleBinding (§9.5 steps 4, 7). The Role/RoleBinding converge so new rules propagate.
  await ignoreStatus(c.core.createNamespacedServiceAccount(ns, M.serviceAccountManifest(tenantId)), 409);
  await convergeNamespaced(c, 'rbac', 'Role', ns, M.workloadRoleManifest(tenantId));
  await convergeNamespaced(c, 'rbac', 'RoleBinding', ns, M.workloadRoleBindingManifest(tenantId));
  // The namespace's auto-created `default` SA is also made tokenless (§9.5 step 4). Best-
  // effort: it's created asynchronously by the SA controller, so a later reconcile retries.
  await ensureDefaultSaTokenless(c, ns);
  // Opaque registry boundary reference (§9.5 step 9) — no credentials.
  await ignoreStatus(c.core.createNamespacedConfigMap(ns, M.registryBoundaryManifest(tenantId)), 409);
  // Separate build boundary (§9.5 step 8), only when builds are enabled.
  if (BUILDS_ENABLED) await provisionBuildBoundary(c, tenantId, quota);
  return { namespace: ns };
}

// Set the namespace's `default` ServiceAccount to automountServiceAccountToken:false via
// read-modify-replace (reliable across client versions). Best-effort — returns false if the
// SA isn't created yet or a transient error occurs, so a later reconcile converges.
async function ensureDefaultSaTokenless(c, ns) {
  try {
    const sa = unwrap(await c.core.readNamespacedServiceAccount('default', ns));
    if (sa.automountServiceAccountToken === false) return true; // already tokenless
    sa.automountServiceAccountToken = false;
    await c.core.replaceNamespacedServiceAccount('default', ns, sa);
    return true;
  } catch { return false; }
}

// Provision the tenant's SEPARATE build namespace + its quota/limits/policy/SA/RoleBinding.
async function provisionBuildBoundary(c, tenantId, quota) {
  const bns = M.BUILD_NS(tenantId);
  await ignoreStatus(c.core.createNamespace(M.buildNamespaceManifest(tenantId)), 409);
  await convergeNamespaced(c, 'core', 'ResourceQuota', bns, M.buildResourceQuotaManifest(tenantId, quota));
  await convergeNamespaced(c, 'core', 'LimitRange', bns, M.buildLimitRangeManifest(tenantId));
  await convergeNamespaced(c, 'net', 'NetworkPolicy', bns, M.buildDefaultDenyNetworkPolicyManifest(tenantId));
  await ignoreStatus(c.core.createNamespacedServiceAccount(bns, M.buildServiceAccountManifest(tenantId)), 409);
  await convergeNamespaced(c, 'rbac', 'Role', bns, M.buildRoleManifest(tenantId));
  await convergeNamespaced(c, 'rbac', 'RoleBinding', bns, M.buildRoleBindingManifest(tenantId));
  return { namespace: bns };
}

// Create-or-replace a Secret so env changes propagate (create → on 409 replace with the
// current resourceVersion; stringData fully replaces the previous keys).
async function upsertSecret(c, ns, sec) {
  try {
    await c.core.createNamespacedSecret(ns, sec);
  } catch (e) {
    if ((e?.statusCode ?? e?.response?.statusCode ?? e?.body?.code) !== 409) throw e;
    const cur = unwrap(await c.core.readNamespacedSecret(sec.metadata.name, ns));
    cur.data = {};                       // drop old keys; stringData below is the full set
    cur.stringData = sec.stringData;
    cur.type = sec.type;
    await c.core.replaceNamespacedSecret(sec.metadata.name, ns, cur);
  }
}

const isConflict = (e) => (e?.statusCode ?? e?.response?.statusCode ?? e?.body?.code) === 409;

// Create-or-REPLACE a namespaced object so desired-state changes CONVERGE on every reconcile.
// create-and-ignore-409 left existing tenants stale — e.g. the rb-workload Role never gained the
// `ingresses` rule that was added to the renderer after the tenant was first provisioned, so its
// workload SA couldn't manage Ingresses. On conflict we read the live object once to carry its
// resourceVersion into the replace. `apiKey` ∈ {core,net,rbac}; `kind` is the client's
// Namespaced<Kind> suffix (ResourceQuota | LimitRange | NetworkPolicy | Role | RoleBinding).
async function convergeNamespaced(c, apiKey, kind, ns, manifest) {
  const api = c[apiKey];
  const name = manifest.metadata.name;
  try {
    await api[`createNamespaced${kind}`](ns, manifest);
  } catch (e) {
    if (!isConflict(e)) throw e;
    const cur = unwrap(await api[`readNamespaced${kind}`](name, ns));
    manifest.metadata = { ...manifest.metadata, resourceVersion: cur?.metadata?.resourceVersion };
    await api[`replaceNamespaced${kind}`](name, ns, manifest);
  }
}

// Create-or-replace a Deployment so redeploys UPDATE image/env/port/command (create-or-ignore
// left an existing Deployment stale). Preserve `replicas` — that's owned by setWorkloadReplicas
// (suspend/resume), so we must not reset it here.
async function upsertDeployment(c, ns, dep) {
  try {
    await c.apps.createNamespacedDeployment(ns, dep);
  } catch (e) {
    if (!isConflict(e)) throw e;
    const cur = unwrap(await c.apps.readNamespacedDeployment(dep.metadata.name, ns));
    cur.spec = { ...dep.spec, replicas: cur.spec.replicas };
    await c.apps.replaceNamespacedDeployment(dep.metadata.name, ns, cur);
  }
}

// Create-or-replace a Service, preserving the cluster-assigned clusterIP(s) (immutable).
async function upsertService(c, ns, svc) {
  try {
    await c.core.createNamespacedService(ns, svc);
  } catch (e) {
    if (!isConflict(e)) throw e;
    const cur = unwrap(await c.core.readNamespacedService(svc.metadata.name, ns));
    cur.spec = { ...svc.spec, clusterIP: cur.spec.clusterIP, clusterIPs: cur.spec.clusterIPs };
    await c.core.replaceNamespacedService(svc.metadata.name, ns, cur);
  }
}

// Create-or-replace an Ingress (public routing for the app's host).
async function upsertIngress(c, ns, ing) {
  try {
    await c.net.createNamespacedIngress(ns, ing);
  } catch (e) {
    if (!isConflict(e)) throw e;
    const cur = unwrap(await c.net.readNamespacedIngress(ing.metadata.name, ns));
    cur.spec = ing.spec;
    cur.metadata.annotations = ing.metadata.annotations;
    await c.net.replaceNamespacedIngress(ing.metadata.name, ns, cur);
  }
}

// A well-formed hostname (defense-in-depth; the BFF already claims a safe, unique host).
const HOSTNAME_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

async function ingressExists(c, ns, name) {
  try { await c.net.readNamespacedIngress(name, ns); return true; }
  catch (e) { if ((e?.statusCode ?? e?.response?.statusCode ?? e?.body?.code) === 404) return false; throw e; }
}

// Pure: decide what to do with the per-app Ingress and whether it counts as READY.
//   • no self-ingress            → skip (ready)
//   • no valid host              → delete any stale route (ready — nothing to publish)
//   • ALREADY published          → upsert + ready, EVEN IF the live DNS re-check flaps. The gate
//                                  exists only to avoid creating an Ingress before DNS resolves
//                                  (which poisons Let's Encrypt HTTP-01 with a cached NXDOMAIN);
//                                  once the Ingress exists, a transient resolver miss must not
//                                  regress a live app back to "deploying".
//   • not yet published, resolves→ upsert + ready
//   • not yet published, doesn't → defer (not ready) until DNS propagates
function ingressPlan({ selfIngress, host, published, resolves }) {
  if (!selfIngress) return { action: 'skip', ingressReady: true };
  const valid = !!(host && HOSTNAME_RE.test(host));
  if (!valid) return { action: 'delete', ingressReady: true };
  if (published || resolves) return { action: 'upsert', ingressReady: true };
  return { action: 'defer', ingressReady: false };
}

async function deployWorkload(spec) {
  const c = makeClient();
  const ns = M.NS(spec.tenantId);
  // Env → a per-app Secret (envFrom), applied BEFORE the Deployment references it. Keeps
  // secret values out of the Deployment/Pod spec.
  const envSecret = M.envSecretManifest(spec);
  if (envSecret) await upsertSecret(c, ns, envSecret);
  await upsertDeployment(c, ns, M.deploymentManifest(spec));
  await upsertService(c, ns, M.serviceManifest(spec));
  // Self-managed public routing: an Ingress for a valid host, else ensure no stale route exists
  // (e.g. a custom domain was cleared). Gated by SITE_SELF_INGRESS.
  let ingressReady = true;
  if (M.SELF_INGRESS) {
    const host = spec.host && String(spec.host).trim().toLowerCase();
    const valid = !!(host && HOSTNAME_RE.test(host));
    // An existing Ingress is already published; only run the DNS gate for a not-yet-created one.
    const published = valid ? await ingressExists(c, ns, spec.name) : false;
    const resolves = (valid && !published) ? await hostResolves(host) : false;
    const plan = ingressPlan({ selfIngress: true, host, published, resolves });
    if (plan.action === 'upsert') {
      await upsertIngress(c, ns, M.ingressManifest({ tenantId: spec.tenantId, name: spec.name, host, port: spec.port }));
    } else if (plan.action === 'delete') {
      await ignoreStatus(c.net.deleteNamespacedIngress(spec.name, ns), 404);
    } else if (plan.action === 'defer') {
      console.log(`[workload] ${spec.name}: deferring ingress — ${host} not resolving yet (DNS propagating)`);
    }
    ingressReady = plan.ingressReady;
  }
  return { namespace: ns, name: spec.name, ingressReady };
}

// Read-modify-replace a Deployment's replica count (reliable across client versions).
async function scaleDeployment(c, ns, name, replicas) {
  const dep = unwrap(await c.apps.readNamespacedDeployment(name, ns));
  dep.spec = dep.spec || {};
  dep.spec.replicas = replicas;
  await c.apps.replaceNamespacedDeployment(name, ns, dep);
}

// Set ONE app Deployment's replica count (owned by the WORKLOAD reconciler, §11.2). Used to
// stop a suspended tenant's runtime (replicas 0) or restore it (the app's desired replicas).
// Best-effort: a not-yet-created Deployment (404) is a no-op — the next reconcile applies it.
async function setWorkloadReplicas(tenantId, name, replicas) {
  const c = makeClient();
  const ns = M.NS(tenantId);
  await ignoreStatus(scaleDeployment(c, ns, name, replicas), 404);
  return { namespace: ns, name, replicas };
}

async function workloadStatus(tenantId, name) {
  const c = makeClient();
  const ns = M.NS(tenantId);
  const dep = unwrap(await c.apps.readNamespacedDeployment(name, ns));
  const s = dep.status || {};
  const conds = Array.isArray(s.conditions) ? s.conditions : [];
  // A failed redeploy shows up as Progressing=False/ProgressDeadlineExceeded — the new pods never
  // became Ready, so k8s (with maxUnavailable:0) kept the previous version serving.
  const rolloutFailed = conds.some((cnd) => cnd.type === 'Progressing' && cnd.status === 'False' && cnd.reason === 'ProgressDeadlineExceeded');
  return {
    namespace: ns,
    name,
    desired: dep.spec?.replicas ?? 0,
    replicas: s.replicas || 0,
    ready: s.readyReplicas || 0,
    available: s.availableReplicas || 0,
    updated: s.updatedReplicas || 0,
    rolloutFailed,
  };
}

// Decommission a single app: delete its Deployment + Service (leaving the tenant
// namespace and other apps intact). Idempotent — a missing object is treated as done.
async function teardownWorkload(tenantId, name) {
  const c = makeClient();
  const ns = M.NS(tenantId);
  await ignoreStatus(c.apps.deleteNamespacedDeployment(name, ns), 404);
  await ignoreStatus(c.core.deleteNamespacedService(name, ns), 404);
  await ignoreStatus(c.net.deleteNamespacedIngress(name, ns), 404);                     // public route
  await ignoreStatus(c.core.deleteNamespacedSecret(M.ENV_SECRET_NAME(name), ns), 404); // app env Secret
  return { namespace: ns, name, deleted: true };
}

async function teardownNamespace(tenantId) {
  const c = makeClient();
  const ns = M.NS(tenantId);
  await ignoreStatus(c.core.deleteNamespace(ns), 404);
  await ignoreStatus(c.core.deleteNamespace(M.BUILD_NS(tenantId)), 404); // build boundary too
  return { namespace: ns, deleted: true };
}

// Verify every tenant-boundary object exists (the reconciler reports ACTIVE only
// once all are present). A 404 → false; other errors bubble.
async function verifyTenant(tenantId) {
  const c = makeClient();
  const ns = M.NS(tenantId);
  const exists = async (p) => {
    try { await p; return true; }
    catch (e) {
      const s = e?.statusCode ?? e?.response?.statusCode ?? e?.body?.code;
      if (s === 404) return false;
      throw e;
    }
  };
  const [namespace, quota, limitRange, networkPolicy, allowDns, allowIngress, allowEgress, serviceAccount, role, roleBinding, registry] = await Promise.all([
    exists(c.core.readNamespace(ns)),
    exists(c.core.readNamespacedResourceQuota('tenant-quota', ns)),
    exists(c.core.readNamespacedLimitRange('tenant-limits', ns)),
    exists(c.net.readNamespacedNetworkPolicy('default-deny', ns)),
    exists(c.net.readNamespacedNetworkPolicy('allow-dns', ns)),
    exists(c.net.readNamespacedNetworkPolicy('allow-gateway-ingress', ns)),
    exists(c.net.readNamespacedNetworkPolicy('allow-egress', ns)),
    exists(c.core.readNamespacedServiceAccount(M.RUNTIME_SA, ns)),
    exists(c.rbac.readNamespacedRole('rb-workload', ns)),
    exists(c.rbac.readNamespacedRoleBinding('rb-workload', ns)),
    exists(c.core.readNamespacedConfigMap('tenant-registry', ns)),
  ]);
  // The `default` SA must exist AND be tokenless (§9.5 step 4) — a field check, not just existence.
  const defaultSaTokenless = await (async () => {
    try { return unwrap(await c.core.readNamespacedServiceAccount('default', ns)).automountServiceAccountToken === false; }
    catch { return false; }
  })();
  const present = namespace && quota && limitRange && networkPolicy && allowDns && allowIngress && allowEgress && serviceAccount && role && roleBinding && registry && defaultSaTokenless;
  return { namespace, quota, limitRange, networkPolicy, allowDns, allowIngress, allowEgress, serviceAccount, role, roleBinding, registry, defaultSaTokenless, present };
}

module.exports = {
  makeClient,
  unwrap,
  convergeNamespaced,
  ingressPlan,
  health,
  provisionNamespace,
  provisionBuildBoundary,
  deployWorkload,
  workloadStatus,
  setWorkloadReplicas,
  teardownWorkload,
  teardownNamespace,
  verifyTenant,
};
