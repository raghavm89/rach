'use strict';

/**
 * Site-API DTO builders + route helpers (contract §6/§7). The BFF sends the exact
 * documented DTO; the site clamps/validates. IDs match the contract patterns.
 */

const TENANT_RE = /^t-[a-z0-9]{8,32}$/;
const APP_RE = /^a-[a-z0-9]{8,15}$/;
const PLANS = ['free', 'pro', 'enterprise'];

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// PUT /v1/tenants/{tenantId}
function tenantPutDTO({ operationId, customerRef, plan, generation = 1, desiredState = 'ACTIVE' }) {
  assert(operationId, 'tenantPutDTO: operationId required');
  assert(customerRef, 'tenantPutDTO: customerRef required');
  assert(PLANS.includes(plan), `tenantPutDTO: plan must be one of ${PLANS.join('|')}`);
  return { operationId, customerRef, plan, desiredState, generation };
}

const tenantRoute = (tenantId) => {
  assert(TENANT_RE.test(tenantId), `invalid tenantId: ${tenantId}`);
  return `/v1/tenants/${tenantId}`;
};

const appRoute = (tenantId, appId) => {
  assert(TENANT_RE.test(tenantId), `invalid tenantId: ${tenantId}`);
  assert(APP_RE.test(appId), `invalid appId: ${appId}`);
  return `/v1/tenants/${tenantId}/apps/${appId}`;
};

const releaseRoute = (tenantId, appId) => `${appRoute(tenantId, appId)}/releases`;

// PUT /v1/tenants/{t}/apps/{a} — the app runtime spec. `image` (approved digest) is
// present for BYO/registry deploys; commit-built releases set it via the build path.
const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

// Normalize the user-supplied env into the §7.1 app-spec shape: [{ name, value }]. Drops
// entries with an invalid name; coerces values to strings. Returns [] when nothing valid.
function normalizeEnv(env) {
  if (!Array.isArray(env)) return [];
  const seen = new Set();
  const out = [];
  for (const e of env) {
    const name = String(e?.name ?? e?.key ?? '').trim();
    if (!ENV_NAME_RE.test(name) || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, value: String(e?.value ?? '') });
  }
  return out;
}

// Normalize a run command to an exec-form array. A string becomes ['sh','-c', str] so a
// shell command line works; an array is passed through (already exec form). Null → omitted
// downstream, so the container runs the image's built-in ENTRYPOINT/CMD.
function normalizeCommand(command) {
  if (command == null) return null;
  if (Array.isArray(command)) {
    const arr = command.map((s) => String(s)).filter((s) => s.length);
    return arr.length ? arr : null;
  }
  const str = String(command).trim();
  return str ? ['sh', '-c', str] : null;
}

// A public host: DNS labels + dots, no scheme/path/port. Returns null when invalid/empty.
const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
function normalizeHost(host) {
  if (!host) return null;
  const h = String(host).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  return HOST_RE.test(h) ? h : null;
}

function appPutDTO({ operationId, runtime = null, image = null, port = 8080, cpuRequestM = 100, cpuLimitM = 500, memRequestMiB = 128, memLimitMiB = 512, scaling = { min: 0, max: 1, concurrency: 80 }, health = { readyPath: '/health/ready' }, owner = null, env = null, command = null, host = null }) {
  assert(operationId, 'appPutDTO: operationId required');
  // `runtime` (e.g. "nodejs-22") is the §7.1 app-spec field; `image` stays optional for the
  // dev/BYO path (the contract sources the image from a release digest). `owner` = creating user.
  // `env`/`command` are the user's runtime inputs; command omitted → image default runs.
  // `host` = the app's public hostname (SpaceArk's edge routes it); invalid → omitted.
  const envN = normalizeEnv(env);
  const cmdN = normalizeCommand(command);
  const hostN = normalizeHost(host);
  return {
    operationId,
    ...(runtime ? { runtime: String(runtime) } : {}),
    image, port, resources: { cpuRequestM, cpuLimitM, memRequestMiB, memLimitMiB }, scaling, health,
    ...(owner ? { owner: String(owner) } : {}),
    ...(envN.length ? { env: envN } : {}),
    ...(cmdN ? { command: cmdN } : {}),
    ...(hostN ? { host: hostN } : {}),
  };
}

// POST /v1/tenants/{t}/apps/{a}/releases — one of three deploy sources:
//   • source        — build from an EXACT commit (provider+commitSha), optionally on a
//                      customer `baseImage` (mode 2b). Built by SpaceArk → approved digest.
//   • externalImage — a prebuilt customer image (mode 2a); ARKA ingests (scan/sign) it.
//   • image         — an already-approved immutable digest (rollback / our registry).
function releasePostDTO({ operationId, deploymentId, applicationGeneration = 1, source = null, externalImage = null, image = null }) {
  assert(operationId, 'releasePostDTO: operationId required');
  assert(source || externalImage || image, 'releasePostDTO: source (commitSha), externalImage, or image (digest) required');
  if (source) assert(source.provider && source.commitSha, 'source needs provider + commitSha');
  return {
    operationId, deploymentId, applicationGeneration,
    source, image,
    ...(externalImage ? { externalImage: String(externalImage) } : {}),
  };
}

// GET /v1/tenants/{t}/registry/images — list the approved container images available to
// the tenant in the site registry (read-only; no body). The site returns normalized
// entries; SpaceArk owns the registry, so it fills the real listing.
const registryImagesRoute = (tenantId) => {
  assert(TENANT_RE.test(tenantId), `invalid tenantId: ${tenantId}`);
  return `/v1/tenants/${tenantId}/registry/images`;
};

// Normalize one registry image entry to the contract DTO. `ref` is the pullable
// reference (repository[:tag]@sha256:… or repository:tag); the rest is display metadata.
function registryImageDTO({ ref, repository = null, tag = null, digest = null, pushedAt = null, sizeBytes = null }) {
  assert(ref, 'registryImageDTO: ref required');
  return { ref, repository, tag, digest, pushedAt, sizeBytes };
}

// DELETE /v1/tenants/{t}/apps/{a} — decommission an app: tear down its managed runtime
// objects (Deployment + Service), then finalize. Declarative — the site converges to
// desiredState=DELETED and reports the operation. Idempotent (deleting an absent app
// still returns DELETED). Body carries only the operation id + an optional reason.
function appDeleteDTO({ operationId, reason = null }) {
  assert(operationId, 'appDeleteDTO: operationId required');
  return { operationId, desiredState: 'DELETED', reason };
}

// DELETE /v1/tenants/{t} — decommission a tenant: tear down the whole namespace
// (all workloads, quotas, RBAC). Terminal; a later reconcile re-creates a fresh tenant.
function tenantDeleteDTO({ operationId, reason = null }) {
  assert(operationId, 'tenantDeleteDTO: operationId required');
  return { operationId, desiredState: 'DELETED', reason };
}

// POST /v1/tenants/{t}:suspend — stop mutations; optionally disable routing/runtime by mode.
// Never deletes data. `mode` is one of the three approved modes; `reasonCode` is opaque.
const SUSPEND_MODES = Object.freeze(['MUTATIONS_BLOCKED', 'WORKLOADS_STOPPED', 'SECURITY_ISOLATED']);
const tenantSuspendRoute = (tenantId) => {
  assert(TENANT_RE.test(tenantId), `invalid tenantId: ${tenantId}`);
  return `/v1/tenants/${tenantId}:suspend`;
};
const tenantResumeRoute = (tenantId) => {
  assert(TENANT_RE.test(tenantId), `invalid tenantId: ${tenantId}`);
  return `/v1/tenants/${tenantId}:resume`;
};
function tenantSuspendDTO({ operationId, generation = 1, mode, reasonCode = null }) {
  assert(operationId, 'tenantSuspendDTO: operationId required');
  assert(SUSPEND_MODES.includes(mode), `tenantSuspendDTO: invalid mode ${mode}`);
  return { operationId, generation, mode, reasonCode, desiredState: 'SUSPENDED' };
}
function tenantResumeDTO({ operationId, generation = 1 }) {
  assert(operationId, 'tenantResumeDTO: operationId required');
  return { operationId, generation, desiredState: 'ACTIVE' };
}

module.exports = {
  TENANT_RE, APP_RE, PLANS, SUSPEND_MODES,
  tenantPutDTO, tenantRoute, appRoute, releaseRoute, appPutDTO, normalizeEnv, normalizeCommand, normalizeHost, releasePostDTO,
  appDeleteDTO, tenantDeleteDTO,
  tenantSuspendRoute, tenantResumeRoute, tenantSuspendDTO, tenantResumeDTO,
  registryImagesRoute, registryImageDTO,
};
