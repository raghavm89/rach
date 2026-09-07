'use strict';

/**
 * Projects / Services API — the Railway-style Project → Service → Environment model.
 *
 * Billing is PAY-PER-UNIT on a subscription: a Service is created free as a *draft*
 * with 0 units; it goes online only after the first Service Unit ($15/mo, 0.5 vCPU /
 * 0.5 GB / 0.5 GB) is paid for. "Add power" buys another unit and scales live.
 *
 * Quota is enforced against *active paid units*, not the number of service rows —
 * a tenant may hold up to their plan's unit allotment across all services.
 */

const { pool } = require('@rach/core');
const { proPricing, paymentSecurity, issueInvoiceForPayment } = require('@rach/billing');
const { Project, Environment, Service, Deployment } = require('../models/project');
const containerBilling = require('../services/containerBilling');
const baasBilling = require('../services/baasBilling');
const proSubscription = require('../services/proSubscription');
const proTax = require('../services/proTax');
const billingProfile = require('../services/billingProfile');
const { assertOrderPaid } = require('../services/paymentVerify');
const { assertContainerImageAllowed } = require('../lib/statefulImage');
const hostRegistry = require('../services/hostRegistry');
const appDetect = require('../services/appDetect');
const { enqueueAppDelete } = require('../services/siteApp');
const quota = require('../lib/quota');
const { getTenantPlan, isShared, isPro } = require('../lib/plan');
const tenantSuspend = require('../lib/tenantSuspend');
const { vmBelongsToTenant } = require('../lib/tenantVms');

// ── Projects ─────────────────────────────────────────────────────────────────

exports.listProjects = async (req, res) => {
  const projects = await Project.listByTenant(req.user.tenant_id);
  res.json({ projects });
};

exports.createProject = async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required' });
  const project = await Project.create({ tenantId: req.user.tenant_id, name: name.trim(), createdBy: req.user.id });
  res.status(201).json({ project });
};

exports.getProject = async (req, res) => {
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const [services, environments] = await Promise.all([
    Service.listByProject(project.id),
    Environment.listByProject(project.id),
  ]);
  res.json({ project, services, environments });
};

// ── Services ─────────────────────────────────────────────────────────────────

exports.listServices = async (req, res) => {
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({ services: await Service.listByProject(project.id) });
};

// Creating a service is free — it starts as a DRAFT. Source is a GitHub repo (repo
// required), a Docker image (image required), or Postgres (managed, no source).
exports.createService = async (req, res) => {
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { name, source_type, repo_full_name, branch, image, compute_target, vm_id } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Service name is required' });

  // Source-specific required inputs (mirrors the create-service form).
  if (source_type === 'github_repo' && !(repo_full_name && String(repo_full_name).trim())) {
    return res.status(400).json({ error: 'A GitHub repository (owner/repo) is required for a GitHub-repo service.' });
  }
  if (source_type === 'docker_image' && !(image && String(image).trim())) {
    return res.status(400).json({ error: 'A container image is required for a Docker-image service.' });
  }
  // Container path has no persistent storage yet — refuse database/stateful images that would
  // silently lose their data on restart (go-live audit P0 #1). VM path + managed Postgres are fine.
  try {
    assertContainerImageAllowed({ image, computeTarget: compute_target, sourceType: source_type });
  } catch (e) {
    if (e.code === 'stateful_image_not_supported') return res.status(400).json({ error: e.message, code: e.code, details: e.details });
    throw e;
  }

  // Cross-tenant guard: if a VM target is supplied, it must belong to the
  // caller's tenant (same class as the deployment path — audit T1/T3).
  if (vm_id && !(await vmBelongsToTenant(req.user.tenant_id, vm_id))) {
    return res.status(403).json({ error: 'VM is not assigned to your tenant' });
  }

  let service;
  try {
    service = await Service.create({
      projectId: project.id,
      name: name.trim(),
      sourceType: source_type,
      repoFullName: repo_full_name,
      branch,
      image,
      computeTarget: compute_target,
      vmId: vm_id,
      createdBy: req.user.id,
    });
  } catch (err) {
    // unique_violation on (project_id, name)
    if (err.code === '23505') {
      return res.status(409).json({ error: `A service named "${name.trim()}" already exists in this project.` });
    }
    throw err;
  }

  // Smart default: for a GitHub-repo service, decode the app type from the repo and prefill
  // the deploy image from the Docker Hub map. Best-effort — failures never block creation.
  if (source_type === 'github_repo' && repo_full_name && !(image && String(image).trim())) {
    try {
      const det = await appDetect.detectRepoImage({ tenantId: req.user.tenant_id, repoFullName: repo_full_name, branch });
      if (det && (det.type || det.image)) {
        service = await Service.setDetected(service.id, { appType: det.type, image: det.image });
      }
    } catch { /* best-effort detection */ }
  }

  res.status(201).json({ service });
};

exports.getService = async (req, res) => {
  const service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  const deployments = await Deployment.listByService(service.id);
  // Is the tenant already placed on a site? The frontend uses this to skip the (idempotent but
  // chatty) reconcileTenant call on every deploy once placement is settled.
  const { rows } = await pool.query('SELECT site_tenant_ref FROM tenants WHERE id = $1', [req.user.tenant_id]);
  const placed = Boolean(rows[0]?.site_tenant_ref);
  res.json({ service, deployments, host: Service.hostFor(service), placed });
};

// ── BaaS (Phase 3) — enable a project's backend primitives + fetch its keys ─────
// Container-based, gated to the shared container tiers (starter/pro) and the `baas` flag.
const { flags } = require('@rach/core');
const baasEnabled = () => flags.isEnabled('baas');

async function baasGate(req, res) {
  if (!baasEnabled()) { res.status(404).json({ error: 'Not found' }); return false; }
  const plan = await getTenantPlan(req.user.tenant_id);
  if (!isShared(plan)) { res.status(402).json({ error: 'BaaS is available on the Starter and Pro plans.' }); return false; }
  return true;
}

const { limitFor, functionDeployBlocked } = require('../lib/baasLimits');

// GET /baas/overview → tenant-level list of BaaS projects + plan limits/usage.
exports.baasOverview = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const plan = await getTenantPlan(req.user.tenant_id);
  const [projects, used] = await Promise.all([
    Project.listBaas(req.user.tenant_id),
    Project.countBaasEnabled(req.user.tenant_id),
  ]);
  res.json({ plan, limits: limitFor(plan), used: { projects: used }, projects });
};

// POST /:id/baas/enable → provision ref + per-project secret; returns the config (ref + keys + url).
exports.enableBaas = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!require('../services/keyCrypto').isConfigured()) return res.status(503).json({ error: 'Key encryption not configured (RACHBASE_KEY_ENC_SECRET)' });

  // Plan limit: count enabling a NEW project against the tenant's allowance (re-enabling one
  // that's already on is free). 402 with the limit when over.
  if (!project.baas_enabled) {
    const plan = await getTenantPlan(req.user.tenant_id);
    const limit = limitFor(plan).projects;
    const used = await Project.countBaasEnabled(req.user.tenant_id);
    if (used >= limit) {
      return res.status(402).json({ error: 'baas_project_limit', message: `Your ${plan} plan includes ${limit} backend project${limit === 1 ? '' : 's'}. Upgrade to add more.`, limit, used });
    }
  }
  let updated = await Project.enableBaas(project.id);
  // Mint the default publishable key (opaque, public) if the project doesn't have one yet.
  await Project.ensurePublishableKey(updated.id);

  // Provision the per-project database on the managed BaaS Postgres cluster (idempotent). Only
  // when a cluster is configured — without it the backend deploys but Auth/Data have no DB yet.
  const baasDb = require('../services/baasDb');
  if (baasDb.isConfigured() && !Project.dbUrl(updated)) {
    try {
      const { connectionString } = await baasDb.provisionProjectDb({ ref: updated.ref });
      updated = await Project.setDbUrl(updated.id, connectionString);
    } catch (e) {
      return res.status(502).json({ error: 'db_provision_failed', message: e.message });
    }
  }
  // Best-effort: deploy the backend bundle now. Defers cleanly if the tenant isn't placed on a
  // site yet or no primitive images are configured (fire later via POST /baas/deploy).
  let deploy = { deferred: 'not_attempted' };
  try { deploy = await deployProjectBundle(updated); } catch (e) { deploy = { error: e.message }; }

  const cfg = Project.baasConfig(updated);
  const keys = await Project.listApiKeys(updated.id);
  const publishable = keys.find((k) => k.type === 'publishable' && !k.revoked_at) || null;
  res.status(201).json({
    baas: { ref: cfg.ref, url: cfg.url, publishable_key: publishable?.key || null },
    keys, db_ready: Boolean(Project.dbUrl(updated)), deploy,
  });
};

// Shared bundle-deploy for a project row (used by enable + the explicit deploy endpoint).
async function deployProjectBundle(project) {
  const { deployBundle } = require('../services/baasDeploy');
  return deployBundle({
    tenantId: project.tenant_id,
    ref: project.ref,
    secret: Project.baasSecret(project),
    databaseUrl: Project.dbUrl(project),
    signing: Project.signingKeypair(project),
    authEnv: Project.authEnv(project),
    storageEnv: Project.storageEnv(project),
    computeSize: Project.baasComputeSize(project),
    ownerName: null,
  });
}

// ── Auth configuration (Supabase-parity) — control-plane, works before deploy ─────
// GET /:id/baas/auth/config → the project's full Auth config (defaults ⊕ stored, secrets masked).
exports.getAuthConfig = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.baas_enabled) return res.status(400).json({ error: 'Enable BaaS for this project first.' });
  res.json({ config: await Project.authConfig(project.id) });
};

// PUT /:id/baas/auth/config { ...patch } → deep-merge + persist; returns the merged config.
exports.setAuthConfig = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.baas_enabled) return res.status(400).json({ error: 'Enable BaaS for this project first.' });
  res.json({ config: await Project.setAuthConfig(project.id, req.body || {}) });
};

// ── Observability (Pro plan) — metrics summary + series ───────────────────────────
const baasMetrics = require('../services/baasMetrics');
async function baasObsGate(req, res) {
  if (!baasEnabled()) { res.status(404).json({ error: 'Not found' }); return false; }
  const plan = await getTenantPlan(req.user.tenant_id);
  if (!isShared(plan)) { res.status(402).json({ error: 'baas_pro_only', message: 'BaaS is available on the Starter and Pro plans.' }); return false; }
  if (!isPro(plan)) { res.status(402).json({ error: 'observability_pro_only', message: 'Observability is available on the Pro plan.' }); return false; }
  return true;
}
const OBS_METRICS = ['cpu', 'memory', 'disk_io', 'net_in', 'net_out', 'requests.total', 'requests.gateway', 'requests.rest', 'requests.auth', 'requests.storage', 'requests.functions', 'response.errors', 'response.ms'];
exports.getObsSummary = async (req, res) => {
  if (!(await baasObsGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({ metrics: await baasMetrics.latest(project.id, OBS_METRICS) });
};
exports.getObsSeries = async (req, res) => {
  if (!(await baasObsGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const metric = String(req.query.metric || '');
  if (!baasMetrics.METRIC_RE.test(metric)) return res.status(400).json({ error: 'invalid_metric' });
  const minutes = Math.min(1440, Math.max(5, Number(req.query.minutes) || 60));
  res.json({ series: await baasMetrics.series(project.id, { metric, minutes }) });
};

// ── BaaS management proxy (dashboard console) — service_role stays server-side ────
const baasAdmin = require('../services/baasAdmin');

async function baasBackend(req, res) {
  if (!(await baasGate(req, res))) return null;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return null; }
  if (!project.baas_enabled) { res.status(400).json({ error: 'Enable BaaS for this project first.' }); return null; }
  return { ref: project.ref, secret: Project.baasSecret(project) };
}
// Reachability errors (backend not deployed) → 503 with a clear state, not a 500.
async function baasProxy(res, fn) {
  try { const r = await fn(); return res.status(r.status || 200).json(r.body ?? {}); }
  catch { return res.status(503).json({ error: 'backend_not_deployed', message: "Deploy this project's backend to manage it." }); }
}

exports.baasUsers = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; return baasProxy(res, () => baasAdmin.listUsers(p, { limit: Number(req.query.limit) || 50, offset: Number(req.query.offset) || 0 })); };
exports.baasCreateUser = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; return baasProxy(res, () => baasAdmin.createUser(p, req.body)); };
exports.baasDeleteUser = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; if (!/^\d+$/.test(String(req.params.uid))) return res.status(400).json({ error: 'invalid_user_id' }); return baasProxy(res, () => baasAdmin.deleteUser(p, req.params.uid)); };
exports.baasOAuthApps = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; return baasProxy(res, () => baasAdmin.listOAuthApps(p)); };
exports.baasCreateOAuthApp = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; return baasProxy(res, () => baasAdmin.createOAuthApp(p, req.body)); };
exports.baasDeleteOAuthApp = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; if (!/^[\w-]+$/.test(String(req.params.clientId))) return res.status(400).json({ error: 'invalid_client_id' }); return baasProxy(res, () => baasAdmin.deleteOAuthApp(p, req.params.clientId)); };
exports.baasFunctions = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; return baasProxy(res, () => baasAdmin.listFunctions(p)); };
exports.baasGetFunction = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; if (!/^[a-z0-9][a-z0-9-]{0,61}$/.test(String(req.params.name))) return res.status(400).json({ error: 'invalid_name' }); return baasProxy(res, () => baasAdmin.getFunction(p, req.params.name)); };
exports.baasDeployFunction = async (req, res) => {
  const p = await baasBackend(req, res); if (!p) return;
  // Plan cap: a NEW function counts against the per-backend allowance; re-deploying an existing
  // one (same name) is a free update. Best-effort — if the backend is unreachable, fall through
  // and let the deploy proxy return its own 503.
  const plan = await getTenantPlan(req.user.tenant_id);
  const limit = limitFor(plan).functions;
  const targetName = String(req.body?.name || '');
  try {
    const listed = await baasAdmin.listFunctions(p);
    const existingNames = Array.isArray(listed?.body?.functions) ? listed.body.functions.map((f) => f.name) : [];
    if (functionDeployBlocked({ existingNames, targetName, limit })) {
      return res.status(402).json({ error: 'baas_function_limit', message: `Your ${plan} plan includes ${limit} function${limit === 1 ? '' : 's'} per backend. Delete one or upgrade to add more.`, limit, used: existingNames.length });
    }
  } catch { /* backend unreachable — the deploy proxy below returns backend_not_deployed */ }
  return baasProxy(res, () => baasAdmin.deployFunction(p, req.body));
};
exports.baasDeleteFunction = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; if (!/^[a-z0-9][a-z0-9-]{0,61}$/.test(String(req.params.name))) return res.status(400).json({ error: 'invalid_name' }); return baasProxy(res, () => baasAdmin.deleteFunction(p, req.params.name)); };
// Test/invoke a deployed function — always 200 with the wrapped { status, body } so the editor's
// Test panel can show any response (incl. the function's own 4xx/5xx), not just successes.
exports.baasInvokeFunction = async (req, res) => {
  const p = await baasBackend(req, res); if (!p) return;
  if (!/^[a-z0-9][a-z0-9-]{0,61}$/.test(String(req.params.name))) return res.status(400).json({ error: 'invalid_name' });
  try { const r = await baasAdmin.invokeFunction(p, req.params.name, req.body); return res.json({ status: r.status, body: r.body }); }
  catch { return res.status(503).json({ error: 'backend_not_deployed', message: "Deploy this project's backend to test functions." }); }
};
exports.baasFunctionSecrets = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; return baasProxy(res, () => baasAdmin.listFunctionSecrets(p)); };
exports.baasSetFunctionSecrets = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; return baasProxy(res, () => baasAdmin.setFunctionSecrets(p, req.body)); };
exports.baasDeleteFunctionSecret = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(String(req.params.name))) return res.status(400).json({ error: 'invalid_name' }); return baasProxy(res, () => baasAdmin.deleteFunctionSecret(p, req.params.name)); };
exports.baasBuckets = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; return baasProxy(res, () => baasAdmin.listBuckets(p)); };
exports.baasCreateBucket = async (req, res) => { const p = await baasBackend(req, res); if (!p) return; return baasProxy(res, () => baasAdmin.createBucket(p, req.body)); };

// ── Storage configuration (Settings + S3) — control-plane, works pre-deploy ──
exports.getStorageConfig = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.baas_enabled) return res.status(400).json({ error: 'Enable BaaS for this project first.' });
  const cfg = await Project.storageConfig(project.id);
  const url = Project.baasConfig(project)?.url || '';
  res.json({ config: cfg, s3: { endpoint: url ? `${url}/storage/v1/s3` : '', region: cfg.region }, keys: await Project.listS3Keys(project.id) });
};
exports.setStorageConfig = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.baas_enabled) return res.status(400).json({ error: 'Enable BaaS for this project first.' });
  res.json({ config: await Project.setStorageConfig(project.id, req.body || {}) });
};
exports.createS3Key = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.baas_enabled) return res.status(400).json({ error: 'Enable BaaS for this project first.' });
  res.status(201).json({ key: await Project.createS3Key(project.id, req.body?.name) });
};
exports.deleteS3Key = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!/^\d+$/.test(String(req.params.kid))) return res.status(400).json({ error: 'invalid_key_id' });
  const ok = await Project.deleteS3Key(project.id, Number(req.params.kid));
  res.status(ok ? 200 : 404).json({ deleted: ok });
};

// ── Data console — SQL against the project's OWN database (not the control plane) ──
const baasData = require('../services/baasData');
async function projectDbUrl(req, res) {
  if (!(await baasGate(req, res))) return null;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return null; }
  if (!project.baas_enabled) { res.status(400).json({ error: 'Enable BaaS for this project first.' }); return null; }
  const databaseUrl = Project.dbUrl(project);
  if (!databaseUrl) { res.status(503).json({ error: 'database_not_provisioned', message: 'The project database is not provisioned yet.' }); return null; }
  return databaseUrl;
}
exports.baasTables = async (req, res) => {
  const databaseUrl = await projectDbUrl(req, res); if (!databaseUrl) return;
  try { return res.json(await baasData.listTables({ databaseUrl })); }
  catch { return res.status(503).json({ error: 'database_unreachable' }); }
};
exports.baasQuery = async (req, res) => {
  const databaseUrl = await projectDbUrl(req, res); if (!databaseUrl) return;
  try { return res.json(await baasData.runQuery({ databaseUrl, sql: req.body?.sql })); }
  catch (e) {
    if (/database_unreachable|ECONNREFUSED|ENOTFOUND|timeout/i.test(e.message)) return res.status(503).json({ error: 'database_unreachable' });
    return res.status(400).json({ error: 'query_error', message: e.message }); // SQL errors → 400 with the message
  }
};

// POST /:id/baas/deploy → (re)deploy the backend bundle. Fire once SpaceArk + images are ready.
exports.deployBaas = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.baas_enabled) return res.status(400).json({ error: 'Enable BaaS for this project first.' });
  try { return res.status(202).json({ deploy: await deployProjectBundle(project) }); }
  catch (e) { return res.status(502).json({ error: 'deploy_failed', message: e.message }); }
};

// GET /:id/baas → the project's BaaS config: ref, url, the public publishable key, and the
// list of API keys (opaque publishable/secret, Supabase's current model). 404 if off.
exports.getBaas = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const cfg = Project.baasConfig(project);
  if (!cfg) return res.status(404).json({ error: 'BaaS is not enabled for this project.' });
  await Project.ensurePublishableKey(project.id);          // heal older projects that predate keys
  const keys = await Project.listApiKeys(project.id);
  const publishable = keys.find((k) => k.type === 'publishable' && !k.revoked_at) || null;
  res.json({
    baas: { ref: cfg.ref, url: cfg.url, publishable_key: publishable?.key || null },
    keys,
    compute: baasComputeInfo(Project.baasComputeSize(project)),
    capabilities: { vector: true }, // pgvector enabled on the project DB at provision time
  });
};

// Backend compute (nano/micro/small) applied to all 3 containers, with the per-backend price.
const BAAS_CONTAINERS = 3;
function baasComputeInfo(size) {
  const s = proPricing.sizeSpec(size);
  return {
    size: s.size,
    containers: BAAS_CONTAINERS,
    per_container: { cpu: s.cpu, memory_mb: s.memory_mb },
    monthly_delta_cents: proPricing.computeDeltaCents(s.size) * BAAS_CONTAINERS, // vs nano, across the bundle
    sizes: Object.keys(proPricing.COMPUTE_SIZES),
  };
}

// Apply a (already-authorized) new backend size: persist + redeploy the bundle.
async function applyBaasCompute(project, tenantId, size) {
  await Project.setBaasComputeSize(project.id, size);
  const updated = await Project.findScoped(project.id, tenantId);
  let deploy = { deferred: 'not_attempted' };
  try { deploy = await deployProjectBundle(updated); } catch (e) { deploy = { error: e.message }; }
  return deploy;
}

// POST /:id/baas/compute { compute_size } — PAY-FIRST resize of all 3 backend containers.
//   • same size            → no-op.
//   • downsize / to nano   → cheaper, applied immediately (no charge).
//   • upsize (more $)      → collect the one-time delta first; parked until /verify.
exports.setBaasCompute = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.baas_enabled) return res.status(400).json({ error: 'Enable BaaS for this project first.' });

  const size = String(req.body?.compute_size || '');
  if (!proPricing.isValidSize(size)) return res.status(400).json({ error: 'invalid_compute_size', message: `Choose one of: ${Object.keys(proPricing.COMPUTE_SIZES).join(', ')}.` });

  const current = Project.baasComputeSize(project);
  if (size === current) return res.json({ unchanged: true, message: 'No change.', compute: baasComputeInfo(size) });

  // Persist checkout billing details first, and refuse to price for an unknown country —
  // GST applies to every India-billed buyer, GSTIN or not (see services/billingProfile.js).
  try {
    await billingProfile.persistForUser(req.user.id, req.body?.billing);
    await billingProfile.assertBillableCountry(req.user.id);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message, code: e.code });
  }

  const currency = await baasBilling.billingCurrencyFor(req.user.tenant_id);
  const deltaCents = baasBilling.resizeDeltaCents({ fromSize: current, toSize: size, containers: BAAS_CONTAINERS, currency });

  // Downsize (or move to a cheaper size) — apply now, no payment.
  if (deltaCents <= 0) {
    await Project.clearBaasResize(project.id); // drop any stale parked upsize
    const deploy = await applyBaasCompute(project, req.user.tenant_id, size);
    return res.json({ resized: true, message: 'Compute size updated.', compute: baasComputeInfo(size), deploy });
  }

  // Upsize — collect the one-time delta before applying. Backend stays at its current size.
  // Charge the delta GST-inclusive (the invoice on verify re-adds the same GST to reconcile).
  const { grossCents } = await proTax.grossUpFor({ userId: req.user.id, subtotalCents: deltaCents, currency, description: 'RachBase BaaS backend resize' });
  const order = await baasBilling.createResizeOrder({ tenantId: req.user.tenant_id, projectId: project.id, amountCents: grossCents, currency });
  await Project.beginBaasResize(project.id, { orderId: order.id, size });
  return res.status(201).json({
    resize_checkout: true,
    message: 'Upgrade requires a one-time payment. Open Razorpay checkout, then POST the result to /baas/compute/verify.',
    order_id: order.id,
    razorpay_key_id: process.env.RAZORPAY_KEY_ID,
    amount: grossCents,
    currency,
    compute_size: size,
    compute: baasComputeInfo(current), // still the old size until verified
  });
};

// POST /:id/baas/compute/verify { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// On a verified payment, apply the parked size + redeploy.
exports.verifyBaasCompute = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!project.baas_pending_resize_order_id) {
    return res.status(200).json({ message: 'No pending resize.', compute: baasComputeInfo(Project.baasComputeSize(project)) }); // idempotent replay
  }
  if (project.baas_pending_resize_order_id !== razorpay_order_id) {
    return res.status(404).json({ error: 'No pending resize matching this order' });
  }
  // Verify captured payment for our resize order (amount from the order we created).
  try {
    await assertOrderPaid({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message, code: e.code });
  }

  const size = project.baas_pending_resize_size || Project.baasComputeSize(project);
  // EX-GST delta for the invoice line, computed from the still-current size before applying.
  const currency = await baasBilling.billingCurrencyFor(req.user.tenant_id);
  const deltaExGst = Math.max(0, baasBilling.resizeDeltaCents({ fromSize: Project.baasComputeSize(project), toSize: size, containers: BAAS_CONTAINERS, currency }));

  const deploy = await applyBaasCompute(project, req.user.tenant_id, size);
  await Project.clearBaasResize(project.id);

  // GST tax invoice for the one-time resize delta (idempotent on payment id; never throws).
  if (deltaExGst > 0) {
    await issueInvoiceForPayment({
      userId: req.user.id,
      currency,
      lines: [{ description: `RachBase BaaS backend resize — ${size}`, quantity: 1, unit_price_minor: deltaExGst }],
      payment: { razorpay_order_id, razorpay_payment_id },
    });
  }
  res.json({ message: 'Payment verified. Compute size updated.', compute: baasComputeInfo(size), deploy });
};

// ── BaaS API keys (opaque, revocable) — control-plane managed, no deploy required ──
// GET /:id/baas/keys → list the project's keys (publishable + secret; secrets show last4 only).
exports.baasApiKeys = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.baas_enabled) return res.status(400).json({ error: 'Enable BaaS for this project first.' });
  await Project.ensurePublishableKey(project.id);
  res.json({ keys: await Project.listApiKeys(project.id) });
};

// POST /:id/baas/keys { name } → mint a new secret key. The plaintext is returned ONCE.
exports.baasCreateSecretKey = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.baas_enabled) return res.status(400).json({ error: 'Enable BaaS for this project first.' });
  const created = await Project.createSecretKey(project.id, req.body?.name);
  res.status(201).json({ key: created });   // includes plaintext `key` — shown once
};

// DELETE /:id/baas/keys/:kid → revoke a key. A revoked publishable key is auto-replaced.
exports.baasRevokeApiKey = async (req, res) => {
  if (!(await baasGate(req, res))) return;
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!/^\d+$/.test(String(req.params.kid))) return res.status(400).json({ error: 'invalid_key_id' });
  const ok = await Project.revokeApiKey(project.id, Number(req.params.kid));
  if (!ok) return res.status(404).json({ error: 'key_not_found' });
  await Project.ensurePublishableKey(project.id);          // never leave a project without a publishable key
  res.json({ revoked: true, keys: await Project.listApiKeys(project.id) });
};

// DELETE /:id/services/:sid/deployments/:did — remove a deploy history entry (e.g. a stale
// queued one). Scoped to the tenant's service; a deploy already applied on the cluster is
// unaffected (this only clears the product-side history row).
exports.deleteDeployment = async (req, res) => {
  const service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  const ok = await Deployment.deleteScoped(req.params.did, service.id);
  if (!ok) return res.status(404).json({ error: 'Deployment not found' });
  res.json({ ok: true, id: Number(req.params.did) });
};

// ── Per-service env vars + run command (shared containers) ──────────────────────
// Parity with the VM path: env is encrypted at rest; is_secret only masks in the UI;
// start_command is the run command (empty → the image's built-in ENTRYPOINT/CMD runs).

// GET /:id/services/:sid/env → { vars: [{ key, value, is_secret }], start_command }
exports.getServiceEnv = async (req, res) => {
  const service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  const vars = await Service.getEnvMasked(service.id);
  res.json({ vars, start_command: service.start_command || null });
};

// PUT /:id/services/:sid/env  { vars: [{ key, value, is_secret }] } — replaces the whole set.
exports.setServiceEnv = async (req, res) => {
  const service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  if (!require('../services/keyCrypto').isConfigured()) {
    return res.status(503).json({ error: 'Env encryption not configured (RACHBASE_KEY_ENC_SECRET)' });
  }
  if (!Array.isArray(req.body.vars)) return res.status(400).json({ error: 'vars must be an array' });
  const count = await Service.setEnv(service.id, req.body.vars);
  res.json({ ok: true, count });
};

// PATCH /:id/services/:sid/config  { start_command?, custom_domain? } — update the run
// command and/or the public domain. Empty clears each (run command → image default; domain →
// the platform's <slug>.rachbase.app). Redeploy to apply on the cluster.
exports.updateServiceConfig = async (req, res) => {
  let service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  if (req.body.start_command !== undefined) service = await Service.setStartCommand(service.id, req.body.start_command);
  if (req.body.port !== undefined) {
    const p = req.body.port === null || req.body.port === '' ? null : Number(req.body.port);
    if (p !== null && (!Number.isInteger(p) || p < 1 || p > 65535)) {
      return res.status(400).json({ error: 'Port must be an integer between 1 and 65535' });
    }
    service = await Service.setPort(service.id, p);
  }
  if (req.body.custom_domain !== undefined) {
    const d = String(req.body.custom_domain || '').trim();
    if (d && !/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(d.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))) {
      return res.status(400).json({ error: 'Enter a valid domain, e.g. app.example.com' });
    }
    // setCustomDomain also rejects rachbase.app subdomains + reserved/platform hosts (security).
    try { service = await Service.setCustomDomain(service.id, d); }
    catch (e) { return res.status(400).json({ error: e.message }); }
  }
  res.json({ service, host: Service.hostFor(service) });
};

// DELETE /:id/services/:sid — remove a service/container. Cancels its recurring
// subscription (promoting a survivor to base if this was the included container), then
// deletes the row (deployments cascade). Idempotent.
exports.deleteService = async (req, res) => {
  const service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });

  await proSubscription.cancelForService({ tenantId: req.user.tenant_id, service });

  // SpaceArk teardown for a placed shared container that got past draft (an App CRD may
  // exist). Enqueued in a txn like the deploy path; delivery is idempotent site-side.
  if (service.compute_target === 'shared' && !['draft', 'pending_payment'].includes(service.status)) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT site_id, site_tenant_ref FROM tenants WHERE id = $1 FOR UPDATE', [req.user.tenant_id]);
      const t = rows[0];
      if (t?.site_tenant_ref) {
        const appId = `a-svc${String(service.id).padStart(8, '0')}`;
        await enqueueAppDelete(client, { tenantRef: t.site_tenant_ref, appId, tenantId: req.user.tenant_id, siteId: t.site_id, reason: 'service deleted' });
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }

  // Remove the auto-managed `<sub>.rachbase.app` DNS record (best-effort; custom domains and
  // absent hosts are skipped). Mirrors the deploy-time auto-DNS.
  try {
    const godaddy = require('../services/godaddy');
    const suffix = `.${(process.env.APPS_DOMAIN || 'rachbase.app').toLowerCase()}`;
    if (service.public_host && service.public_host.toLowerCase().endsWith(suffix) && godaddy.isConfigured()) {
      await godaddy.deleteARecord(service.public_host.slice(0, -suffix.length)).catch(() => {});
    }
  } catch { /* dns cleanup is best-effort */ }

  await Service.delete(service.id);
  // Free this service's global host reservations (container slug + any custom domain) so the names
  // become available again (audit P0 #7).
  await hostRegistry.releaseByRef({ kind: 'container', ref: service.id }).catch(() => {});
  await hostRegistry.releaseByRef({ kind: 'custom', ref: service.id }).catch(() => {});
  res.json({ message: `Service "${service.name}" deleted.`, id: service.id });
};

// ── Container pay-to-online (per-container billing) ─────────────────────────────

// POST /:id/services/:sid/checkout
// Recurring pay-to-online. The first container funds the tenant's monthly BASE
// subscription ($15 + its compute); each later container is its own $10+delta monthly
// subscription. Resizing an already-online container reprices its subscription in
// place (no checkout — the mandate exists). New subscriptions return a subscription_id
// for Razorpay checkout, then /verify.
exports.checkoutContainer = async (req, res) => {
  const service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  if (service.compute_target !== 'shared') {
    return res.status(400).json({ error: 'Container billing applies to shared (Pro) services; dedicated uses the Max/VM path.' });
  }
  // Belt-and-suspenders: never bring a stateful DB image online on the ephemeral container path,
  // even if the image was set/changed after creation (P0 #1). Skip GitHub-repo builds.
  try {
    assertContainerImageAllowed({ image: service.image, computeTarget: service.compute_target, sourceType: service.source_type });
  } catch (e) {
    if (e.code === 'stateful_image_not_supported') return res.status(400).json({ error: e.message, code: e.code, details: e.details });
    throw e;
  }

  const size = String(req.body.compute_size || service.compute_size || proPricing.DEFAULT_COMPUTE_SIZE);
  if (!proPricing.isValidSize(size)) {
    return res.status(400).json({ error: `Invalid compute size "${size}". Choose one of: ${Object.keys(proPricing.COMPUTE_SIZES).join(', ')}.` });
  }

  // Shared-tier gate — deploying containers requires an active Starter/Pro base subscription.
  const plan = await getTenantPlan(req.user.tenant_id);
  if (!isShared(plan)) {
    return res.status(402).json({ error: 'Subscribe to a plan to deploy containers.', needs_pro: true });
  }
  try { await tenantSuspend.assertActive(req.user.tenant_id); }
  catch (e) { return res.status(e.status || 409).json({ error: e.message, code: e.code }); }

  // Plan quota — enforced only when bringing a NEW container online (drafts/free +
  // resizes of an already-online container are exempt).
  const isNewOnline = ['draft', 'pending_payment'].includes(service.status);
  if (isNewOnline) {
    const currentCount = await Service.countBillableShared(req.user.tenant_id, service.id);
    if (quota.exceedsCap({ plan, currentCount })) {
      const cap = quota.containerCapForPlan(plan);
      return res.status(402).json({ error: `You've reached your plan's container limit (${cap}). Delete a container to add another, or contact support to raise your limit.`, cap });
    }
  }

  // Persist any billing details sent with this checkout, and require a resolvable billing
  // country before pricing — GST applies to every India-billed buyer, with or without a
  // GSTIN, and "country unknown → no tax" must never be reachable from a paid checkout.
  // (The buyer here is the CALLER: beginOnline bills the sub to req.user.id.)
  try {
    await billingProfile.persistForUser(req.user.id, req.body?.billing);
    await billingProfile.assertBillableCountry(req.user.id);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message, code: e.code });
  }

  const currency = await containerBilling.billingCurrencyFor(req.user.tenant_id);
  const out = await proSubscription.beginOnline({ tenantId: req.user.tenant_id, service, size, currency, userId: req.user.id });

  // Resize of an already-billed container to the SAME or a CHEAPER size — no payment,
  // mandate reused (or dropped when it falls to the free nano allowance). Applied now.
  if (out.resized) {
    const updated = await Service.markOnline(service.id, size);
    return res.status(200).json({ resized: true, message: out.unchanged ? 'No change.' : 'Compute size updated.', service: updated });
  }

  // UPSIZE to a more expensive size — collect a one-time DELTA payment first. The service
  // stays online at its OLD size; the target is parked until /verify-resize clears it.
  if (out.resizeCheckout) {
    const updated = await Service.beginResize(service.id, { orderId: out.orderId, size });
    return res.status(201).json({
      resize_checkout: true,
      message: 'Upgrade requires a one-time payment. Open Razorpay checkout, then POST the result to /verify-resize.',
      order_id: out.orderId,
      razorpay_key_id: process.env.RAZORPAY_KEY_ID,
      amount: out.deltaCents,
      currency: out.currency,
      recurring_amount: out.newAmountCents,
      compute_size: size,
      service: updated,
    });
  }

  // Free container (first, nano) — included in the Pro base, so straight online, no checkout.
  if (out.free) {
    const updated = await Service.markOnline(service.id, size);
    return res.status(200).json({ free: true, message: 'Included in your Pro base — no charge. Service is online.', service: updated });
  }

  // New subscription — client opens Razorpay subscription checkout, then /verify.
  const updated = await Service.beginCheckout(service.id, { orderId: out.subscriptionId, computeSize: size });
  res.status(201).json({
    message: 'Subscription created. Open Razorpay checkout, then POST the result to /verify.',
    subscription_id: out.subscriptionId,
    razorpay_key_id: process.env.RAZORPAY_KEY_ID,
    amount: out.amountCents,
    currency,
    compute_size: size,
    kind: out.kind,
    service: updated,
  });
};

// POST /:id/services/:sid/verify
// Verifies the Razorpay SUBSCRIPTION signature, matches it to this service, activates
// the subscription and brings the container online. Idempotent.
exports.verifyContainer = async (req, res) => {
  const service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });

  const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = req.body;
  try {
    paymentSecurity.verifySubscriptionPayment({ razorpay_subscription_id, razorpay_payment_id, razorpay_signature });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }

  if (service.status === 'online' && !service.pending_order_id) {
    return res.status(200).json({ message: 'Service already online.', service }); // idempotent replay
  }
  if (service.pending_order_id !== razorpay_subscription_id) {
    return res.status(404).json({ error: 'No pending subscription matching this service' });
  }

  await proSubscription.activate(razorpay_subscription_id);
  const updated = await Service.markOnline(service.id, service.compute_size);

  // First-cycle GST tax invoice for this container subscription. Line is the EX-GST recurring
  // amount from the sub row; the invoice engine re-adds GST to match the gross Razorpay charge.
  // Idempotent on payment id; never throws.
  const subRow = await proSubscription.ProSub.findByRazorpaySub(razorpay_subscription_id);
  if (subRow) {
    await issueInvoiceForPayment({
      userId: subRow.created_by || req.user.id,
      currency: subRow.currency,
      lines: [{ description: `RachBase container — ${service.name} (${subRow.compute_size})`, quantity: 1, unit_price_minor: subRow.amount_cents }],
      payment: { razorpay_subscription_id, razorpay_payment_id },
    });
  }
  res.json({ message: 'Subscription active. Service is online.', service: updated });
};

// POST /:id/services/:sid/verify-resize
// Verifies the one-time UPSIZE delta payment (order signature), reprices the container's
// recurring subscription up, and applies the new compute size. Idempotent.
exports.verifyResize = async (req, res) => {
  const service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!service.pending_resize_order_id) {
    return res.status(200).json({ message: 'No pending resize.', service }); // idempotent replay
  }
  if (service.pending_resize_order_id !== razorpay_order_id) {
    return res.status(404).json({ error: 'No pending resize matching this order' });
  }
  // Verify the payment is real, captured, and for our resize order (amount read from the order
  // we created). Replaces a signature-only check that HMAC'd with an empty-string key fallback.
  try {
    await assertOrderPaid({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message, code: e.code });
  }

  const size = service.pending_resize_size || service.compute_size;
  const currency = await containerBilling.billingCurrencyFor(req.user.tenant_id);

  // Capture the EX-GST delta BEFORE commitResize reprices the row: new recurring − old recurring.
  const liveBefore = await proSubscription.ProSub.liveForService(service.id);
  const oldAmount = liveBefore ? liveBefore.amount_cents : 0;
  const newRecurring = proPricing.containerSubscriptionCents(size, currency);
  const deltaExGst = Math.max(0, newRecurring - oldAmount);

  await proSubscription.commitResize({ tenantId: req.user.tenant_id, service, size, currency });
  await Service.clearResize(service.id);
  const updated = await Service.markOnline(service.id, size);

  // Invoice the one-time upsize delta (EX-GST line; engine re-adds GST to match the gross
  // order charged). Idempotent on payment id; never throws.
  if (deltaExGst > 0) {
    await issueInvoiceForPayment({
      userId: (liveBefore && liveBefore.created_by) || req.user.id,
      currency,
      lines: [{ description: `RachBase container resize — ${size}`, quantity: 1, unit_price_minor: deltaExGst }],
      payment: { razorpay_order_id, razorpay_payment_id },
    });
  }
  res.json({ message: 'Payment verified. Compute size updated.', service: updated });
};

// POST /:id/services/:sid/deploy — records a deployment. Gated on the container being
// paid/online first (pay-to-online). Real build/run is handed to the orchestrator.
exports.deployService = async (req, res) => {
  const service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  if (service.compute_target === 'shared' && !isShared(await getTenantPlan(req.user.tenant_id))) {
    return res.status(402).json({ error: 'Subscribe to a plan to deploy containers.', needs_pro: true });
  }
  if (['draft', 'pending_payment'].includes(service.status)) {
    return res.status(402).json({ error: 'Bring the container online first (complete checkout), then deploy.' });
  }

  const envs = await Environment.listByProject(service.project_id);
  const target = envs.find((e) => e.is_default) || envs[0] || null;

  const deployment = await Deployment.create({
    serviceId: service.id,
    environmentId: target ? target.id : null,
    commitSha: req.body.commit_sha,
    imageTag: req.body.image_tag,
    triggeredBy: 'manual',
  });
  await pool.query('UPDATE services SET status = $1, updated_at = NOW() WHERE id = $2', ['deploying', service.id]);
  res.status(202).json({ message: 'Deployment queued', deployment });
};
