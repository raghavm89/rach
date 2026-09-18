'use strict';

/**
 * Resource renderers — PURE functions (no cluster calls) that build the exact
 * Kubernetes objects the reconcilers apply. Keeping them pure makes the §9
 * hardening baseline unit-testable without a cluster.
 *
 * Per SpaceArk contract: the tenant reconciler owns namespace/quota/limits/SA/
 * NetworkPolicy/RoleBindings; the workload reconciler owns the app runtime. Every
 * customer workload lands in a per-tenant namespace with Pod Security Standards
 * restricted + ResourceQuota + LimitRange + default-deny NetworkPolicy, and every
 * container runs hardened (non-root, drop ALL caps, read-only rootfs, seccomp
 * RuntimeDefault) with requests == limits.
 */

const crypto = require('crypto');

const NS = (tenantId) => `rb-t-${tenantId}`;

// Short stable hash — stamped on the pod template so an env change rolls the Deployment
// (the container references the env Secret by name via envFrom, which alone wouldn't restart pods).
const shortHash = (obj) => crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 16);

// The workload reconciler's own ServiceAccount (lives in the site-controller namespace).
// Per contract §11.2 it acts on tenant namespaces ONLY through a per-tenant RoleBinding.
const CONTROLLER_NS = process.env.SITE_CONTROLLER_NAMESPACE || 'spaceark-site-system';
const WORKLOAD_SA = process.env.WORKLOAD_RECONCILER_SA || 'site-controller-workload';
// The tokenless runtime ServiceAccount every tenant workload runs as.
const RUNTIME_SA = 'rb-runtime';
// How long a redeploy may take to become Ready before k8s marks the rollout failed (the working
// version keeps serving throughout). Env-tunable for slow-starting apps.
const PROGRESS_DEADLINE_S = Number(process.env.SITE_ROLLOUT_DEADLINE_S) || 120;

const LABELS = (tenantId, extra = {}) => ({
  'app.kubernetes.io/managed-by': 'rachbase',
  'rachbase.io/tenant': String(tenantId),
  ...extra,
});

// Owner/audit + runtime annotations. `owner` is the creating user reference (see note in
// §9.5 wiring: the contract prefers an OPAQUE non-PII customerRef over a raw username);
// `runtime` is the §7.1 runtime id (e.g. nodejs-22), recorded for attribution/telemetry.
const OWNER_ANN = (owner, runtime) => ({
  ...(owner ? { 'rachbase.io/created-by': String(owner) } : {}),
  ...(runtime ? { 'rachbase.io/runtime': String(runtime) } : {}),
});

function namespaceManifest(tenantId) {
  return {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name: NS(tenantId),
      labels: {
        ...LABELS(tenantId),
        'pod-security.kubernetes.io/enforce': 'restricted',
        'pod-security.kubernetes.io/enforce-version': 'latest',
        'pod-security.kubernetes.io/warn': 'restricted',
        'pod-security.kubernetes.io/audit': 'restricted',
      },
    },
  };
}

function resourceQuotaManifest(tenantId, { cpu = '2', memory = '2Gi', pods = 10, pvcs = 5 } = {}) {
  return {
    apiVersion: 'v1',
    kind: 'ResourceQuota',
    metadata: { name: 'tenant-quota', namespace: NS(tenantId), labels: LABELS(tenantId) },
    spec: {
      hard: {
        'requests.cpu': cpu, 'limits.cpu': cpu,
        'requests.memory': memory, 'limits.memory': memory,
        pods: String(pods), persistentvolumeclaims: String(pvcs),
      },
    },
  };
}

function limitRangeManifest(tenantId) {
  return {
    apiVersion: 'v1',
    kind: 'LimitRange',
    metadata: { name: 'tenant-limits', namespace: NS(tenantId), labels: LABELS(tenantId) },
    spec: {
      limits: [{
        type: 'Container',
        default: { cpu: '250m', memory: '256Mi' },
        defaultRequest: { cpu: '100m', memory: '128Mi' },
      }],
    },
  };
}

// Deny all ingress and egress by default. NetworkPolicies are ADDITIVE, so the allow-*
// policies below open exactly the approved paths on top of this (contract §9.5 step 6).
function defaultDenyNetworkPolicyManifest(tenantId) {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: 'default-deny', namespace: NS(tenantId), labels: LABELS(tenantId) },
    spec: { podSelector: {}, policyTypes: ['Ingress', 'Egress'] },
  };
}

// The site edge gateway namespace (env-tunable; SpaceArk supplies the real value at handoff).
const GATEWAY_NS = process.env.SITE_GATEWAY_NAMESPACE || 'spaceark-edge';

// Self-managed ingress (opt-in). When on, the workload reconciler emits an Ingress per public
// app and opens the NetworkPolicy to the ingress controller ONLY (scoped by namespace + pod
// label, never all of kube-system). Defaults target the k3s-bundled Traefik.
const SELF_INGRESS = process.env.SITE_SELF_INGRESS === '1';
const APPS_DOMAIN = (process.env.APPS_DOMAIN || 'rachbase.app').toLowerCase();
const INGRESS_NS = process.env.SITE_INGRESS_NAMESPACE || 'kube-system';
const INGRESS_CLASS = process.env.SITE_INGRESS_CLASS || 'traefik';
const INGRESS_POD_LABEL_KEY = process.env.SITE_INGRESS_POD_LABEL_KEY || 'app.kubernetes.io/name';
const INGRESS_POD_LABEL_VAL = process.env.SITE_INGRESS_POD_LABEL_VAL || 'traefik';
// Traefik ACME cert resolver name. When set, each Ingress requests an automatic Let's Encrypt
// cert for its host via HTTP-01 (required: `.app` is HSTS-preloaded, so a valid public cert is
// mandatory). Per-host HTTP-01 keeps DNS-write creds OFF the cluster (unlike DNS-01/wildcard) —
// the deliberate, more-secure choice; pair it with a wildcard A record to avoid the issuance race.
const INGRESS_CERTRESOLVER = process.env.SITE_INGRESS_CERTRESOLVER || '';

// Allow DNS egress only (UDP+TCP 53) so workloads can resolve names.
function allowDnsNetworkPolicyManifest(tenantId) {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: 'allow-dns', namespace: NS(tenantId), labels: LABELS(tenantId) },
    spec: {
      podSelector: {},
      policyTypes: ['Egress'],
      egress: [{ ports: [{ protocol: 'UDP', port: 53 }, { protocol: 'TCP', port: 53 }] }],
    },
  };
}

// Allow ingress ONLY from the site edge gateway (public traffic enters via the gateway).
function allowGatewayIngressNetworkPolicyManifest(tenantId) {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: 'allow-gateway-ingress', namespace: NS(tenantId), labels: LABELS(tenantId) },
    spec: {
      podSelector: {},
      policyTypes: ['Ingress'],
      ingress: [{ from: [{ namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': GATEWAY_NS } } }] }],
    },
  };
}

// Entitled egress: allow the public internet but DENY cluster-internal, node/infra and the
// cloud metadata endpoint (contract §11.3). Private + link-local ranges are excepted.
function allowEgressNetworkPolicyManifest(tenantId) {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: 'allow-egress', namespace: NS(tenantId), labels: LABELS(tenantId) },
    spec: {
      podSelector: {},
      policyTypes: ['Egress'],
      egress: [{
        to: [{ ipBlock: { cidr: '0.0.0.0/0', except: ['169.254.0.0/16', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'] } }],
      }],
    },
  };
}

// ── Tenant registry boundary (§9.5 step 9) ──────────────────────────────────────
// Record only the tenant's OPAQUE private-registry reference (never credentials). The
// real registry is provisioned by SpaceArk; this ConfigMap is the boundary marker the
// workload/build reconcilers resolve the tenant's images against.
const REGISTRY_REF = (tenantId) => `reg-${tenantId}`;
function registryBoundaryManifest(tenantId) {
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name: 'tenant-registry', namespace: NS(tenantId), labels: LABELS(tenantId) },
    data: { ref: REGISTRY_REF(tenantId) },
  };
}

// ── Build boundary (§9.5 step 8) — a SEPARATE namespace for ephemeral source-to-image
// builds, isolated from the runtime namespace. Gated (SITE_BUILDS_ENABLED) since SpaceArk's
// build service is a pending handoff. The build reconciler acts here via `rb-build` only.
const BUILD_NS = (tenantId) => `rb-b-${tenantId}`;
const BUILD_SA = process.env.BUILD_RECONCILER_SA || 'site-controller-build';
const BUILD_RUNNER_SA = 'rb-build-runner';
const BUILD_LABELS = (tenantId) => ({ ...LABELS(tenantId), 'rachbase.io/boundary': 'build' });

function buildNamespaceManifest(tenantId) {
  return {
    apiVersion: 'v1', kind: 'Namespace',
    metadata: {
      name: BUILD_NS(tenantId),
      labels: {
        ...BUILD_LABELS(tenantId),
        'pod-security.kubernetes.io/enforce': 'restricted',
        'pod-security.kubernetes.io/enforce-version': 'latest',
      },
    },
  };
}
function buildResourceQuotaManifest(tenantId, { cpu = '2', memory = '2Gi', pods = 4 } = {}) {
  return {
    apiVersion: 'v1', kind: 'ResourceQuota',
    metadata: { name: 'build-quota', namespace: BUILD_NS(tenantId), labels: BUILD_LABELS(tenantId) },
    spec: { hard: { 'requests.cpu': cpu, 'limits.cpu': cpu, 'requests.memory': memory, 'limits.memory': memory, pods: String(pods) } },
  };
}
function buildLimitRangeManifest(tenantId) {
  return {
    apiVersion: 'v1', kind: 'LimitRange',
    metadata: { name: 'build-limits', namespace: BUILD_NS(tenantId), labels: BUILD_LABELS(tenantId) },
    spec: { limits: [{ type: 'Container', default: { cpu: '1', memory: '1Gi' }, defaultRequest: { cpu: '250m', memory: '256Mi' } }] },
  };
}
function buildDefaultDenyNetworkPolicyManifest(tenantId) {
  return {
    apiVersion: 'networking.k8s.io/v1', kind: 'NetworkPolicy',
    metadata: { name: 'default-deny', namespace: BUILD_NS(tenantId), labels: BUILD_LABELS(tenantId) },
    spec: { podSelector: {}, policyTypes: ['Ingress', 'Egress'] },
  };
}
function buildServiceAccountManifest(tenantId) {
  return {
    apiVersion: 'v1', kind: 'ServiceAccount',
    metadata: { name: BUILD_RUNNER_SA, namespace: BUILD_NS(tenantId), labels: BUILD_LABELS(tenantId) },
    automountServiceAccountToken: false,
  };
}
// Minimal Role for the BUILD reconciler in the build namespace: manage build Jobs + read
// their Pods. No Secrets, no exec (contract §11 — supply-chain evidence is separate).
function buildRoleManifest(tenantId) {
  return {
    apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'Role',
    metadata: { name: 'rb-build', namespace: BUILD_NS(tenantId), labels: BUILD_LABELS(tenantId) },
    rules: [
      { apiGroups: ['batch'], resources: ['jobs'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] },
      { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list', 'watch'] },
    ],
  };
}
function buildRoleBindingManifest(tenantId) {
  return {
    apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'RoleBinding',
    metadata: { name: 'rb-build', namespace: BUILD_NS(tenantId), labels: BUILD_LABELS(tenantId) },
    subjects: [{ kind: 'ServiceAccount', name: BUILD_SA, namespace: CONTROLLER_NS }],
    roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'rb-build' },
  };
}
// All build-boundary objects (applied only when builds are enabled).
function buildObjects(tenantId, quota) {
  return [
    buildNamespaceManifest(tenantId),
    buildResourceQuotaManifest(tenantId, quota),
    buildLimitRangeManifest(tenantId),
    buildDefaultDenyNetworkPolicyManifest(tenantId),
    buildServiceAccountManifest(tenantId),
    buildRoleManifest(tenantId),
    buildRoleBindingManifest(tenantId),
  ];
}

// Tokenless ServiceAccount (contract §9.5 step 4): no auto-mounted token. `RUNTIME_SA` is
// what tenant workloads run as; the namespace's `default` SA is patched tokenless separately.
function serviceAccountManifest(tenantId, name = RUNTIME_SA) {
  return {
    apiVersion: 'v1',
    kind: 'ServiceAccount',
    metadata: { name, namespace: NS(tenantId), labels: LABELS(tenantId) },
    automountServiceAccountToken: false,
  };
}

// The exact, minimal Role the WORKLOAD reconciler needs inside a tenant namespace
// (manage app Deployments/Services; read Pods for readiness). No Secrets, no RBAC, no
// pod exec/attach — contract §11.2.
function workloadRoleManifest(tenantId) {
  return {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'Role',
    metadata: { name: 'rb-workload', namespace: NS(tenantId), labels: LABELS(tenantId) },
    rules: [
      { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] },
      { apiGroups: [''], resources: ['services'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] },
      { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list', 'watch'] },
      // App env Secret (envFrom) — NAMESPACE-SCOPED to this tenant only. This is a deliberate,
      // narrow addition to the workload reconciler's rights (the §11.2 note bars BROAD/platform
      // Secret access, not managing an app's own env Secret in its own namespace). SpaceArk SRE
      // approves the final RBAC.
      { apiGroups: [''], resources: ['secrets'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] },
      // Self-managed public routing: the workload reconciler manages the app's Ingress in its
      // OWN namespace only (namespaced Role — never cluster-wide). Enables `<host>` → the app's
      // ClusterIP Service without depending on the SpaceArk edge.
      { apiGroups: ['networking.k8s.io'], resources: ['ingresses'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] },
    ],
  };
}

// Bind the workload reconciler's ServiceAccount to the per-tenant Role (contract §9.5 step 7).
function workloadRoleBindingManifest(tenantId) {
  return {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'RoleBinding',
    metadata: { name: 'rb-workload', namespace: NS(tenantId), labels: LABELS(tenantId) },
    subjects: [{ kind: 'ServiceAccount', name: WORKLOAD_SA, namespace: CONTROLLER_NS }],
    roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'rb-workload' },
  };
}

// User run command → container.command (exec form). A string is wrapped as ['sh','-c', str];
// an array is used as-is. Empty/absent → omitted, so the image's built-in ENTRYPOINT/CMD runs.
function normalizeCommand(command) {
  if (command == null) return null;
  const arr = Array.isArray(command) ? command.map(String).filter(Boolean) : [String('sh'), '-c', String(command)];
  return arr.length ? arr : null;
}

// User env → container.env ([{name,value}]). Filters junk; values coerced to strings.
function normalizeEnv(env) {
  if (!Array.isArray(env)) return [];
  return env
    .filter((e) => e && typeof e.name === 'string' && e.name)
    .map((e) => ({ name: e.name, value: String(e.value ?? '') }));
}

// Writable scratch dirs mounted as bounded emptyDir, so apps that write to disk work under
// `readOnlyRootFilesystem: true`. Ephemeral (cleared on restart), per-pod, no cross-tenant
// reach. `/tmp` gets the larger budget; `/var/tmp` a small one.
const WRITABLE_MOUNTS = [
  { path: '/tmp', name: 'scratch-tmp', sizeLimit: '1Gi' },
  { path: '/var/tmp', name: 'scratch-var-tmp', sizeLimit: '256Mi' },
];

function deploymentManifest({ tenantId, name, image, port = 8080, args, command, env, replicas = 1, cpu = '250m', memory = '256Mi', owner, runtime }) {
  const labels = LABELS(tenantId, { 'rachbase.io/service': name, app: name });
  const cmd = normalizeCommand(command);
  const envList = normalizeEnv(env);
  const ann = OWNER_ANN(owner, runtime);
  const meta = (m) => (Object.keys(ann).length ? { ...m, annotations: ann } : m);
  // Pod-template annotations = owner/runtime + an env checksum so redeploys with changed env
  // produce a new template (→ rollout) even though the container only references the Secret by name.
  const podAnn = { ...ann, ...(envList.length ? { 'rachbase.io/env-checksum': shortHash(envList) } : {}) };
  const podMeta = Object.keys(podAnn).length ? { labels, annotations: podAnn } : { labels };
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: meta({ name, namespace: NS(tenantId), labels }),
    spec: {
      replicas,
      selector: { matchLabels: { app: name } },
      // Safe redeploy: the CURRENT (working) pod is never torn down until the NEW one passes its
      // readiness probe. If the new image fails to become ready, the working version keeps
      // serving (maxUnavailable:0), and the rollout is marked failed after progressDeadline —
      // instead of a bad image replacing a healthy app. revisionHistoryLimit keeps prior
      // ReplicaSets for `kubectl rollout undo`.
      strategy: { type: 'RollingUpdate', rollingUpdate: { maxUnavailable: 0, maxSurge: 1 } },
      revisionHistoryLimit: 3,
      progressDeadlineSeconds: PROGRESS_DEADLINE_S,
      template: {
        metadata: podMeta,
        spec: {
          serviceAccountName: RUNTIME_SA,
          automountServiceAccountToken: false,
          securityContext: {
            runAsNonRoot: true,
            runAsUser: 65532,
            runAsGroup: 65532,
            fsGroup: 65532,
            seccompProfile: { type: 'RuntimeDefault' },
          },
          containers: [{
            name,
            image,
            ...(cmd ? { command: cmd } : {}),
            ...(args ? { args } : {}),
            // Env comes from a per-app Secret (envFrom), NOT inline — keeps secret values out
            // of the Deployment/Pod spec (they live in a Secret with its own RBAC + at-rest
            // encryption). The Secret is applied alongside the Deployment (see arkaClient).
            ...(envList.length ? { envFrom: [{ secretRef: { name: ENV_SECRET_NAME(name) } }] } : {}),
            ports: [{ containerPort: port }],
            // "Ready" = actually accepting connections on the app port, so the rollout only
            // promotes a new pod once it's genuinely serving (generic TCP check — we don't know
            // each app's health path). This is what makes the preserve-and-revert work.
            readinessProbe: { tcpSocket: { port }, initialDelaySeconds: 3, periodSeconds: 5, failureThreshold: 3 },
            resources: { requests: { cpu, memory }, limits: { cpu, memory } },
            securityContext: {
              allowPrivilegeEscalation: false,
              readOnlyRootFilesystem: true,
              runAsNonRoot: true,
              capabilities: { drop: ['ALL'] },
            },
            volumeMounts: WRITABLE_MOUNTS.map((m) => ({ name: m.name, mountPath: m.path })),
          }],
          volumes: WRITABLE_MOUNTS.map((m) => ({ name: m.name, emptyDir: { sizeLimit: m.sizeLimit } })),
        },
      },
    },
  };
}

// The per-app env Secret name (referenced by the Deployment's envFrom).
const ENV_SECRET_NAME = (name) => `${name}-env`;

// A per-app Opaque Secret holding the user's env (name→value). Applied by the workload
// reconciler in the tenant namespace; the Deployment consumes it via envFrom. Returns null
// when there's no env (no Secret needed).
function envSecretManifest({ tenantId, name, env, owner }) {
  const list = normalizeEnv(env);
  if (!list.length) return null;
  const stringData = {};
  for (const e of list) stringData[e.name] = e.value;
  const ann = OWNER_ANN(owner);
  const metadata = { name: ENV_SECRET_NAME(name), namespace: NS(tenantId), labels: LABELS(tenantId, { 'rachbase.io/service': name }) };
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: Object.keys(ann).length ? { ...metadata, annotations: ann } : metadata,
    type: 'Opaque',
    stringData,
  };
}

function serviceManifest({ tenantId, name, port = 8080, owner }) {
  const ann = OWNER_ANN(owner);
  const metadata = { name, namespace: NS(tenantId), labels: LABELS(tenantId, { 'rachbase.io/service': name }) };
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: Object.keys(ann).length ? { ...metadata, annotations: ann } : metadata,
    spec: { selector: { app: name }, ports: [{ port, targetPort: port }] },
  };
}

// Public Ingress for an app: `<host>` → the app's ClusterIP Service. Host is validated by the
// reconciler (must be `*.rachbase.app` or a verified custom domain); annotations are a FIXED
// server template (no tenant input) to prevent annotation injection. TLS is terminated by the
// ingress controller's default wildcard cert (`*.rachbase.app`) — no per-namespace TLS secret,
// so the wildcard private key never lands in a tenant namespace.
function ingressManifest({ tenantId, name, host, port = 8080 }) {
  // Bind the app router to HTTPS (websecure) only when ACME is on — otherwise a :80 (web) router
  // for the host intercepts `/.well-known/acme-challenge/` and returns the app's 404, breaking
  // HTTP-01 issuance. Leaving :80 to Traefik lets its challenge handler answer. Without ACME,
  // keep web so plain http still routes.
  const entrypoints = INGRESS_CERTRESOLVER ? 'websecure' : 'websecure,web';
  const annotations = { 'traefik.ingress.kubernetes.io/router.entrypoints': entrypoints };
  // Automatic per-host Let's Encrypt via Traefik's ACME (HTTP-01) resolver (when configured).
  if (INGRESS_CERTRESOLVER) {
    annotations['traefik.ingress.kubernetes.io/router.tls'] = 'true';
    annotations['traefik.ingress.kubernetes.io/router.tls.certresolver'] = INGRESS_CERTRESOLVER;
  }
  const spec = {
    ingressClassName: INGRESS_CLASS,
    rules: [{
      host,
      http: { paths: [{ path: '/', pathType: 'Prefix', backend: { service: { name, port: { number: port } } } }] },
    }],
  };
  // `spec.tls` (no secretName) tells the ACME resolver which host to issue a cert for.
  if (INGRESS_CERTRESOLVER) spec.tls = [{ hosts: [host] }];
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: { name, namespace: NS(tenantId), labels: LABELS(tenantId, { 'rachbase.io/service': name }), annotations },
    spec,
  };
}

// Allow ingress from the ingress CONTROLLER only (namespace + pod label), not all of the
// controller's namespace. Added to the tenant only when self-ingress is enabled.
function allowIngressControllerNetworkPolicyManifest(tenantId) {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: 'allow-ingress-controller', namespace: NS(tenantId), labels: LABELS(tenantId) },
    spec: {
      podSelector: {},
      policyTypes: ['Ingress'],
      ingress: [{
        from: [{
          namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': INGRESS_NS } },
          podSelector: { matchLabels: { [INGRESS_POD_LABEL_KEY]: INGRESS_POD_LABEL_VAL } },
        }],
      }],
    },
  };
}

// All tenant boundary objects for a namespace (what the tenant reconciler applies).
function tenantObjects(tenantId, quota) {
  return [
    namespaceManifest(tenantId),
    resourceQuotaManifest(tenantId, quota),
    limitRangeManifest(tenantId),
    defaultDenyNetworkPolicyManifest(tenantId),
    allowDnsNetworkPolicyManifest(tenantId),            // approved DNS egress (§9.5 step 6)
    allowGatewayIngressNetworkPolicyManifest(tenantId), // ingress only from the site gateway
    ...(SELF_INGRESS ? [allowIngressControllerNetworkPolicyManifest(tenantId)] : []), // + ingress controller
    allowEgressNetworkPolicyManifest(tenantId),         // entitled egress (internet, not cluster/metadata)
    serviceAccountManifest(tenantId),        // tokenless runtime SA (§9.5 step 4)
    workloadRoleManifest(tenantId),          // per-tenant workload Role (§9.5 step 7)
    workloadRoleBindingManifest(tenantId),   // → binds the workload reconciler's SA
    registryBoundaryManifest(tenantId),      // opaque registry reference (§9.5 step 9)
  ];
}

module.exports = {
  NS,
  CONTROLLER_NS,
  WORKLOAD_SA,
  RUNTIME_SA,
  namespaceManifest,
  resourceQuotaManifest,
  limitRangeManifest,
  defaultDenyNetworkPolicyManifest,
  allowDnsNetworkPolicyManifest,
  allowGatewayIngressNetworkPolicyManifest,
  allowEgressNetworkPolicyManifest,
  serviceAccountManifest,
  workloadRoleManifest,
  workloadRoleBindingManifest,
  registryBoundaryManifest,
  REGISTRY_REF,
  BUILD_NS,
  BUILD_SA,
  BUILD_RUNNER_SA,
  buildNamespaceManifest,
  buildResourceQuotaManifest,
  buildLimitRangeManifest,
  buildDefaultDenyNetworkPolicyManifest,
  buildServiceAccountManifest,
  buildRoleManifest,
  buildRoleBindingManifest,
  buildObjects,
  deploymentManifest,
  serviceManifest,
  ingressManifest,
  allowIngressControllerNetworkPolicyManifest,
  SELF_INGRESS,
  APPS_DOMAIN,
  envSecretManifest,
  ENV_SECRET_NAME,
  tenantObjects,
};
