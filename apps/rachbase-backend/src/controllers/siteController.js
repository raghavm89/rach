'use strict';

/**
 * BFF site endpoints (RachBase side of the SpaceArk contract).
 *
 * POST /api/site/tenants/:tenantId/reconcile
 *   Opens a transaction, writes product desired-state (site placement + SpaceArk
 *   tenant ref) AND enqueues the operation + outbox row in the SAME transaction,
 *   then returns 202 from central state. It does NOT wait for site reconciliation.
 *
 * GET /api/site/operations/:operationId
 *   Normalized operation status (no raw internals).
 *
 * Behind the `pro_tier` flag (invisible until flipped). Delivery to the site is done
 * asynchronously by the outbox worker.
 */

const { pool, flags } = require('@rach/core');
const { proPricing, paymentSecurity, issueInvoiceForPayment } = require('@rach/billing');
const outbox = require('../services/siteOutbox');
const { Service, Deployment } = require('../models/project');
const proSubscription = require('../services/proSubscription');
const containerBilling = require('../services/containerBilling');
const billingProfile = require('../services/billingProfile');
const siteTeardown = require('../services/siteTeardown');
const { setTenantPlan, getTenantPlan, isShared } = require('../lib/plan');
const { enqueueTenantReconcile, newTenantRef, productToSitePlan } = require('../services/siteTenant');
const { enqueueAppUpsert, enqueueRelease, enqueueTenantSuspend, enqueueTenantResume } = require('../services/siteApp');
const siteCapabilities = require('../services/siteCapabilities');
const godaddy = require('../services/godaddy');

// Auto-manage the `<sub>.rachbase.app` A record on deploy (mirrors the VM auto-domain path).
// The ingress IP is PER SITE (sites.ingress_ip), resolved from the tenant's site; SITE_INGRESS_IP
// is only a single-site fallback. Best-effort + idempotent; platform subdomains only (custom
// domains are CNAME'd by the user). No-op unless GoDaddy is configured and an IP is known.
async function autoDnsUpsert(host, siteId) {
  const site = siteId ? await require('../services/siteRegistry').resolveSite(siteId).catch(() => null) : null;
  const ip = (site && site.ingressIp) || process.env.SITE_INGRESS_IP;
  if (!host || !ip || !godaddy.isConfigured()) return;
  const suffix = `.${(process.env.APPS_DOMAIN || 'rachbase.app').toLowerCase()}`;
  if (!host.toLowerCase().endsWith(suffix)) return; // custom domain → user points their own CNAME
  const sub = host.slice(0, -suffix.length);
  godaddy.upsertARecord(sub, ip).catch((e) => console.warn(`[deploy] auto-dns upsert ${host} failed:`, e.message));
}
const tenantSuspend = require('../lib/tenantSuspend');
const appDetect = require('../services/appDetect');

// Resolve the k8s resources a shared app should get from the PAID compute size of the
// backing service (appId = a-svc<serviceId>). Server-side authority: a deploy can't
// request more than was paid for. Falls back to nano for non-service-backed app ids.
async function resourcesForApp(tenantId, appId) {
  const m = /^a-svc0*(\d+)$/.exec(String(appId || ''));
  let size = proPricing.DEFAULT_COMPUTE_SIZE;
  if (m) {
    const { rows } = await pool.query(
      `SELECT s.compute_size FROM services s JOIN projects p ON p.id = s.project_id
        WHERE p.tenant_id = $1 AND s.id = $2`,
      [tenantId, Number(m[1])],
    );
    if (rows[0]?.compute_size && proPricing.isValidSize(rows[0].compute_size)) size = rows[0].compute_size;
  }
  return proPricing.resourcesForSize(size);
}

const SITE_ID = process.env.SITE_ID || 'site1';

const proEnabled = () => flags.isEnabled('pro_tier');

// Admin sees all; a tenant_admin may act on their own tenant only.
function mayActOnTenant(user, tenantId) {
  if (user.role === 'admin') return true;
  return user.role === 'tenant_admin' && user.tenant_id === tenantId;
}

// Mutation gate (§9.10): reject product mutations while the tenant is suspended. Returns
// true (and sends 409) when blocked, so callers do `if (await suspendedBlock(res, id)) return;`.
async function suspendedBlock(res, tenantId) {
  const mode = await tenantSuspend.getSuspendMode(tenantId);
  if (mode) { res.status(409).json({ error: `Tenant is suspended (${mode}). Resume it to make changes.`, code: 'TENANT_SUSPENDED' }); return true; }
  return false;
}

// POST /api/site/tenants/:tenantId/reconcile
exports.reconcileTenant = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const tenantId = req.params.tenantId; // parseId() made this a positive int
  if (!mayActOnTenant(req.user, tenantId)) return res.status(403).json({ error: 'Forbidden' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT id, plan, site_id, site_tenant_ref FROM tenants WHERE id = $1 FOR UPDATE',
      [tenantId],
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Tenant not found' }); }
    const t = rows[0];

    // Product desired-state: home site + stable SpaceArk ref (idempotent).
    const tenantRef = t.site_tenant_ref || newTenantRef();
    const siteId = t.site_id || SITE_ID;
    const sitePlan = productToSitePlan(t.plan);
    await client.query(
      'UPDATE tenants SET site_id = $1, site_tenant_ref = $2, updated_at = NOW() WHERE id = $3',
      [siteId, tenantRef, tenantId],
    );

    // Operation + outbox in the SAME transaction.
    const envelope = await enqueueTenantReconcile(client, {
      tenantRef, tenantId, siteId, customerRef: `c-${tenantId}`, plan: sitePlan,
    });

    await client.query('COMMIT');
    return res.status(202).json(envelope);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// GET /api/site/pro/quote?tier=starter|pro — the base amount for a tier (no side effects).
exports.proBaseQuote = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const tenantId = req.user.tenant_id;
  if (tenantId == null) return res.status(400).json({ error: 'No tenant' });
  const tier = proPricing.isValidTier(req.query.tier) ? req.query.tier : proPricing.DEFAULT_TIER;
  const currency = await containerBilling.billingCurrencyFor(tenantId);
  const currentPlan = await getTenantPlan(tenantId);
  return res.json({
    kind: 'base', tier,
    amount: proPricing.baseSubscriptionCents(tier, 'nano', currency),
    currency,
    current_plan: currentPlan,
    already_pro: isShared(currentPlan), // already on a shared tier
  });
};

// GET /api/site/tenants/:tenantId/deploy-quote?serviceId=&size= — the marginal amount to
// bring a container online at `size` (no side effects; for the checkout page). `free`
// means the Pro base allowance covers it (no charge).
exports.deployQuote = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const tenantId = req.params.tenantId;
  if (!mayActOnTenant(req.user, tenantId)) return res.status(403).json({ error: 'Forbidden' });
  const serviceId = Number(req.query.serviceId);
  const size = String(req.query.size || proPricing.DEFAULT_COMPUTE_SIZE);
  if (!proPricing.isValidSize(size)) return res.status(400).json({ error: 'invalid size' });

  const service = serviceId ? await Service.findScoped(serviceId, tenantId) : null;
  const currency = await containerBilling.billingCurrencyFor(tenantId);
  // Allowance depends on the tenant's TIER (starter = 1 free, pro = 3 free).
  const base = await proSubscription.ProSub.baseForTenant(tenantId);
  const tier = base?.tier || proPricing.DEFAULT_TIER;

  // RESIZE of an already-online container that has an active (billable) subscription: quote
  // the marginal cost. An UPSIZE quotes the one-time DELTA (paid now, recurring bumped on
  // verify); a same/cheaper change is free (applied inline, no payment).
  const live = serviceId ? await proSubscription.ProSub.liveForService(serviceId) : null;
  if (service && service.status === 'online' && live && live.status === 'active') {
    const newAmount = proPricing.containerSubscriptionCents(size, live.currency); // billable: $10 + compute
    const delta = newAmount - live.amount_cents;
    if (delta > 0) {
      return res.json({ kind: 'container', amount: delta, currency: live.currency, free: false, mode: 'upsize', recurring: newAmount, size, service_name: service.name });
    }
    return res.json({ kind: 'container', amount: 0, currency: live.currency, free: true, mode: 'downsize', recurring: newAmount, size, service_name: service.name });
  }

  // A free (no-sub) container that's already online occupies an allowance slot → an upsize
  // costs the compute delta only (fee waived). Otherwise it's a new deploy priced by count.
  const isFreeSlot = Boolean(service && service.status === 'online');
  const existingCount = isFreeSlot ? 0 : await Service.countBillableShared(tenantId, serviceId || 0);
  const amount = proPricing.deployChargeCents(tier, existingCount, size, currency);
  return res.json({ kind: 'container', amount, currency, free: amount === 0, size, service_name: service?.name || null });
};

// POST /api/site/pro/subscribe {tier} — subscribe to a shared tier: create its monthly base
// subscription (starter $15 / pro $30). Client opens Razorpay checkout, then POSTs to
// /pro/verify. On an already-active base it just ensures the plan reflects that tier.
exports.subscribePro = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const tenantId = req.user.tenant_id;
  if (tenantId == null) return res.status(400).json({ error: 'No tenant to subscribe' });
  const tier = proPricing.isValidTier(req.body.tier) ? req.body.tier : proPricing.DEFAULT_TIER;

  // Save the billing details submitted with this checkout BEFORE quoting/charging, then
  // require a resolvable billing country. GST applies to every India-billed customer with
  // or without a GSTIN — but only if we know they're in India; "country unknown" used to
  // silently mean zero tax and USD pricing for a new Indian user whose typed address was
  // never persisted.
  try {
    await billingProfile.persistForUser(req.user.id, req.body.billing);
    await billingProfile.assertBillableCountry(req.user.id);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message, code: e.code });
  }

  const currency = await containerBilling.billingCurrencyFor(tenantId);
  const out = await proSubscription.beginProBase({ tenantId, tier, currency, userId: req.user.id });
  if (out.alreadyActive) {
    await setTenantPlan(tenantId, out.tier).catch(() => {});
    return res.status(200).json({ already: true, plan: out.tier });
  }
  // In-place tier UPGRADE on an active base (mandate reused, next renewal bills the new
  // amount) — previously this silently no-opped at the old tier while the UI showed success.
  if (out.upgraded) {
    return res.status(200).json({
      upgraded: true, plan: out.tier, amount: out.amountCents, currency: out.currency,
      promoted_containers: out.promotedContainers,
      message: `Upgraded to ${out.tier}. Your allowance is active now; the next renewal bills the new amount.`,
    });
  }
  if (out.downgradeUnsupported) {
    return res.status(400).json({
      error: `You're on ${out.tier}; downgrading to ${out.requestedTier} isn't self-serve (it would start billing containers your current plan includes). Cancel and re-subscribe, or contact support.`,
      code: 'downgrade_unsupported', plan: out.tier,
    });
  }
  return res.status(201).json({
    message: 'Subscription created. Open Razorpay checkout, then POST the result to /pro/verify.',
    subscription_id: out.subscriptionId,
    razorpay_key_id: process.env.RAZORPAY_KEY_ID,
    amount: out.amountCents,
    currency: out.currency ?? currency, // resumed checkout keeps its original currency
    tier: out.tier,
  });
};

// POST /api/site/pro/verify — verify the base subscription payment, activate it, and flip
// the tenant to the subscription's TIER. Idempotent.
exports.verifyProSubscription = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const tenantId = req.user.tenant_id;
  const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = req.body;
  try {
    paymentSecurity.verifySubscriptionPayment({ razorpay_subscription_id, razorpay_payment_id, razorpay_signature });
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  const row = await proSubscription.ProSub.findByRazorpaySub(razorpay_subscription_id);
  if (!row || row.tenant_id !== tenantId || row.kind !== 'base') {
    return res.status(404).json({ error: 'No pending subscription for this tenant' });
  }
  // TERMINAL/DUNNING states cannot be verified back to life (audit #3, F1b): the signature
  // triple from the ORIGINAL checkout stays valid forever, so without this guard a customer
  // could unsubscribe and then replay their old /pro/verify body to flip the cancelled row
  // active and reopen the plan gate with no live mandate behind it (no renewal would ever
  // charge). A halted base likewise must not be "verified" active without money moving —
  // recovery is the charged webhook (real payment) or a fresh re-subscribe.
  if (row.status === 'cancelled' || row.status === 'halted') {
    return res.status(409).json({ error: 'This subscription is no longer pending. Subscribe again to reactivate.', code: 'subscription_not_pending' });
  }
  const tier = row.tier || proPricing.DEFAULT_TIER;
  const alreadyActive = row.status === 'active';
  await proSubscription.activate(razorpay_subscription_id);
  await setTenantPlan(tenantId, tier);
  // First verified payment LOCKS the tenant's billing currency (migration 130): every later
  // container/resize charge uses this, immune to billing-address edits (audit M1).
  await containerBilling.lockBillingCurrency(tenantId, row.currency);
  // Lift any site-level suspension: a re-subscribe after unsubscribe used to leave the
  // tenant's workloads force-scaled to 0 forever because nothing ever enqueued the resume
  // (audit #3, F1). Idempotent on the site; best-effort by contract.
  await siteTeardown.enqueueTenantResumeOp(tenantId, 'subscription_activated');

  // Issue the first-cycle GST tax invoice. The line is the EX-GST base amount; the invoice
  // engine re-adds the same GST from the buyer's profile, so its total equals what Razorpay
  // charged (gross). Idempotent on the payment id (a replayed verify won't double-issue) and
  // never throws — a paid customer must not be stranded if PDF/email hiccups. Skip on an
  // idempotent replay of an already-active base.
  const label = tier === 'pro' ? 'Pro' : 'Starter';
  if (!alreadyActive) {
    await issueInvoiceForPayment({
      userId: row.created_by || req.user.id,
      currency: row.currency,
      lines: [{ description: `RachBase ${label} — monthly base`, quantity: 1, unit_price_minor: row.amount_cents }],
      payment: { razorpay_subscription_id, razorpay_payment_id },
    });
  }
  return res.json({ message: `${label} active.`, plan: tier });
};

// POST /api/site/unsubscribe — cancel Pro for the caller's tenant: stop every shared
// container (halts further per-container billing) and cancel any live subscriptions.
// Best-effort per subscription so one Razorpay failure doesn't block the teardown.
exports.unsubscribePro = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const tenantId = req.user.tenant_id;
  if (tenantId == null) return res.status(400).json({ error: 'No tenant to unsubscribe' });

  const stopped = await Service.stopAllShared(tenantId);
  const cancelled = await proSubscription.cancelAllForTenant(tenantId); // base + all container subs
  await setTenantPlan(tenantId, 'max').catch(() => {}); // revert tier to the default
  // Actually stop the workloads on the site — the DB status flip above is not enough on its own
  // (the reconciler re-asserts desired state). Reversible via tenant.resume on re-subscribe.
  await siteTeardown.enqueueTenantStop(tenantId, 'unsubscribed');

  return res.json({
    message: 'Pro cancelled. Shared containers stopped and Pro subscriptions cancelled.',
    stopped_containers: stopped.length,
    cancelled_subscriptions: cancelled,
  });
};

// GET /api/site/tenants/:tenantId/registry/images — the tenant's approved registry
// images (for the "Browse registry" picker). Empty until the tenant is placed and the
// site exposes its registry listing.
exports.listRegistryImages = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const tenantId = req.params.tenantId;
  if (!mayActOnTenant(req.user, tenantId)) return res.status(403).json({ error: 'Forbidden' });
  const { rows } = await pool.query('SELECT site_id, site_tenant_ref FROM tenants WHERE id = $1', [tenantId]);
  const ref = rows[0]?.site_tenant_ref;
  if (!ref) return res.json({ images: [] });
  const siteClient = require('../services/siteClient');
  const out = await siteClient.fetchRegistryImages(ref, { siteId: rows[0].site_id });
  return res.json({ images: out.images || [] });
};

// ── Site registry admin (platform-level; admin role only) ───────────────────────
// Manage the `sites` table that replaced the global SITE_API_URL: which site-controllers
// the BFF can address. `ca_pem` is a public cert (safe to return); the partner mTLS/OAuth
// private keys are NOT stored here.

// GET /api/site/sites → list registered sites.
exports.listSites = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const sites = await require('../services/siteRegistry').listSites();
  return res.json({ sites });
};

// PUT /api/site/sites/:siteId  { api_url, audience?, issuer?, ca_pem?, enabled? } — upsert.
exports.upsertSite = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const siteId = String(req.params.siteId || '').trim();
  const apiUrl = String(req.body.api_url || '').trim();
  if (!siteId) return res.status(400).json({ error: 'siteId required' });
  if (!/^https?:\/\//.test(apiUrl)) return res.status(400).json({ error: 'api_url must be an http(s) URL' });
  const site = await require('../services/siteRegistry').upsertSite({
    siteId, apiUrl,
    audience: req.body.audience || null,
    issuer: req.body.issuer || null,
    caPem: req.body.ca_pem || null,
    ingressIp: req.body.ingress_ip || null, // per-site public ingress IP for auto-DNS
    enabled: req.body.enabled !== false,
  });
  return res.json({ site });
};

// POST /api/site/sites/:siteId/disable → soft-disable (keeps the row; stops routing to it).
exports.disableSite = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const reg = require('../services/siteRegistry');
  const siteId = String(req.params.siteId || '').trim();
  const [existing] = (await reg.listSites()).filter((s) => s.siteId === siteId);
  if (!existing) return res.status(404).json({ error: 'Site not found' });
  const site = await reg.upsertSite({
    siteId, apiUrl: existing.apiUrl, audience: existing.audience, issuer: existing.issuer, caPem: existing.ca, enabled: false,
  });
  return res.json({ site });
};

// GET /api/site/operations/:operationId
exports.getOperationStatus = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const op = await outbox.getOperation(req.params.operationId);
  if (!op) return res.status(404).json({ error: 'Operation not found' });
  if (op.tenant_id != null && !mayActOnTenant(req.user, op.tenant_id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json(outbox.normalizeOperation(op));
};

// Run fn inside a txn with the tenant's site placement (must be reconciled first).
async function withTenantPlacement(tenantId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id, site_id, site_tenant_ref FROM tenants WHERE id = $1 FOR UPDATE', [tenantId]);
    if (!rows.length || !rows[0].site_tenant_ref) { await client.query('ROLLBACK'); return { error: 404 }; }
    const out = await fn(client, rows[0]);
    await client.query('COMMIT');
    return { out };
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

// PUT /api/site/tenants/:tenantId/apps/:appId
exports.upsertApp = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const tenantId = req.params.tenantId;
  if (!mayActOnTenant(req.user, tenantId)) return res.status(403).json({ error: 'Forbidden' });
  const appId = String(req.params.appId || '');
  if (!/^a-[a-z0-9]{8,15}$/.test(appId)) return res.status(400).json({ error: 'invalid appId (a-...)' });
  if (await suspendedBlock(res, tenantId)) return;
  const resources = await resourcesForApp(tenantId, appId); // from the paid compute size
  const owner = req.user.name || req.user.email || null;    // server-side (never trust the client)
  const r = await withTenantPlacement(tenantId, (client, t) => enqueueAppUpsert(client, {
    tenantRef: t.site_tenant_ref, appId, tenantId, siteId: t.site_id, image: req.body.image || null, port: req.body.port || 8080, resources, owner,
  }));
  if (r.error === 404) return res.status(404).json({ error: 'Tenant not placed on a site yet (reconcile the tenant first)' });
  return res.status(202).json(r.out);
};

// POST /api/site/tenants/:tenantId/apps/:appId/releases
exports.createRelease = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const tenantId = req.params.tenantId;
  if (!mayActOnTenant(req.user, tenantId)) return res.status(403).json({ error: 'Forbidden' });
  const appId = String(req.params.appId || '');
  if (!/^a-[a-z0-9]{8,15}$/.test(appId)) return res.status(400).json({ error: 'invalid appId (a-...)' });
  if (await suspendedBlock(res, tenantId)) return;
  const r = await withTenantPlacement(tenantId, (client, t) => enqueueRelease(client, {
    tenantRef: t.site_tenant_ref, appId, tenantId, siteId: t.site_id,
    deploymentId: req.body.deploymentId, source: req.body.source || null, image: req.body.image || null,
    externalImage: req.body.externalImage || null,
  }));
  if (r.error === 404) return res.status(404).json({ error: 'Tenant not placed on a site yet' });
  return res.status(202).json(r.out);
};

// POST /api/site/tenants/:tenantId/apps/:appId/deploy-repo — IN-HOUSE build from the
// service's GitHub repo. Pins an EXACT commit (the caller's `commit_sha` for a redeploy/
// rollback, else the branch's latest), upserts the app spec, creates a release from SOURCE
// (built by SpaceArk), and records the deploy in history. Async → 202 + operation + commit.
exports.deployRepo = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const tenantId = req.params.tenantId;
  if (!mayActOnTenant(req.user, tenantId)) return res.status(403).json({ error: 'Forbidden' });
  const appId = String(req.params.appId || '');
  if (!/^a-[a-z0-9]{8,15}$/.test(appId)) return res.status(400).json({ error: 'invalid appId (a-...)' });

  if (await suspendedBlock(res, tenantId)) return;
  const serviceId = Number(req.body.service_id);
  const service = serviceId ? await Service.findScoped(serviceId, tenantId) : null;
  if (!service) return res.status(404).json({ error: 'Service not found' });
  if (service.source_type !== 'github_repo' || !service.repo_full_name) {
    return res.status(400).json({ error: 'This service has no GitHub repository to build from.' });
  }

  // The tenant's site (used by the preflight + auto-DNS). Fetched once.
  let deploySiteId = null;
  try { deploySiteId = (await pool.query('SELECT site_id FROM tenants WHERE id = $1', [tenantId])).rows[0]?.site_id || null; } catch { /* best-effort */ }

  // Preflight: refuse if ARKA's site can't accept our App spec (its CRD is behind), so the
  // deploy fails FAST with a clear message instead of a 500-at-apply that we can't undo.
  if (deploySiteId) {
    try {
      const pf = await siteCapabilities.preflightApp(deploySiteId);
      if (!pf.ok) return res.status(412).json({ error: 'site_schema_incompatible', message: pf.reason, missing: pf.missing || [] });
    } catch { /* preflight is best-effort — never block a deploy on the check itself failing */ }
  }

  // DEV/TEST: SpaceArk's build service isn't up, so `SITE_DIRECT_IMAGE_DEPLOY` lets Deploy
  // create a REAL container from a ready-to-run image instead of a (blocked) source build —
  // exercises tenant + workload reconcilers end-to-end. Value: `1` → use the service's
  // detected image (else nginx); or set it to an explicit image ref (e.g. `nginx:1.27-alpine`).
  const directFlag = process.env.SITE_DIRECT_IMAGE_DEPLOY;
  const directImage = directFlag
    ? (directFlag === '1' ? (service.image || 'nginx:1.27-alpine') : String(directFlag))
    : null;

  // Pin an exact commit (skipped in direct-image mode — there's no build).
  let commitSha = (req.body.commit_sha && String(req.body.commit_sha).trim()) || null;
  if (!directImage && !commitSha) {
    try {
      const gh = require('../services/githubApp');
      const installationId = await gh.installationIdForTenant(tenantId);
      if (!installationId) return res.status(400).json({ error: 'Connect GitHub to deploy from a repository.' });
      const token = await gh.installationToken(installationId);
      const [owner, repo] = String(service.repo_full_name).split('/');
      commitSha = await gh.latestCommit({ token, owner, repo, ref: service.branch || 'main' });
    } catch { return res.status(502).json({ error: 'Could not resolve the latest commit from GitHub.' }); }
    if (!commitSha) return res.status(502).json({ error: 'Could not resolve the latest commit from GitHub.' });
  }

  const resources = await resourcesForApp(tenantId, appId);
  const ownerName = req.user.name || req.user.email || null;
  const runtime = appDetect.runtimeFor(service.app_type); // §7.1 runtime id from the detected type
  const source = { provider: 'github', repositoryRef: service.repo_full_name, commitSha };

  // User runtime inputs: decrypted env + run command. When the user set no command we send
  // none, and the container runs the built image's ENTRYPOINT/CMD (else the detected default
  // is offered to the user as a suggestion in the UI, not forced here).
  let env = [];
  try { if (require('../services/keyCrypto').isConfigured()) env = await Service.getEnv(service.id); } catch { /* env optional */ }
  const command = service.start_command || null;
  // Claim a globally-unique public host (idempotent) so per-app ingress can never collide across
  // tenants — see lib/publicHost + Service.ensurePublicHost. Always sent to the site; the site
  // controller stores it as an annotation (schema-safe) and only writes spec.host when its CRD
  // supports it (SITE_APP_SPEC_HOST), so an older CRD no longer 500s on the field.
  const claimedHost = await Service.ensurePublicHost(service).catch(() => null);
  const host = Service.hostFor({ ...service, public_host: claimedHost });
  // Create the DNS A record BEFORE the app is enqueued, so it has a head start to propagate
  // before the workload reconciler creates the Ingress (which the reconciler defers until the
  // host resolves — together this removes the HTTP-01 DNS-propagation race for per-host records).
  await autoDnsUpsert(claimedHost, deploySiteId);
  const port = Service.portFor(service); // the app's listen port (default 8080)

  const r = await withTenantPlacement(tenantId, async (client, t) => {
    // Direct-image mode: set the App image so the workload reconciler deploys it now (no
    // release/build). Normal mode: image resolves from a SOURCE release built by SpaceArk.
    const up = await enqueueAppUpsert(client, { tenantRef: t.site_tenant_ref, appId, tenantId, siteId: t.site_id, image: directImage, runtime, port, resources, owner: ownerName, env, command, host });
    if (directImage) return up;
    return enqueueRelease(client, { tenantRef: t.site_tenant_ref, appId, tenantId, siteId: t.site_id, deploymentId: `d-${Date.now()}`, source });
  });
  if (r.error === 404) return res.status(404).json({ error: 'Tenant not placed on a site yet (reconcile the tenant first)' });

  if (directImage) console.warn(`[deploy] DIRECT IMAGE mode (SITE_DIRECT_IMAGE_DEPLOY): deploying ${directImage} for ${appId} without a build`);
  // Record deploy history: source builds keep the per-commit row (status 'queued' until the
  // build service resolves it); direct-image deploys record a per-image row marked deployed.
  if (commitSha) await Deployment.upsertForCommit({ serviceId: service.id, commitSha, triggeredBy: 'manual' }).catch(() => {});
  // Each direct-image deploy is a distinct event (its own success/failed outcome), so APPEND a
  // history row rather than upserting one — otherwise repeated deploys of the same image collapse
  // to a single entry. Linked to the app-upsert operation so its terminal outcome updates THIS
  // row; status starts 'deploying' and is corrected when the op reconciles (or dead-letters).
  else if (directImage) await Deployment.create({ serviceId: service.id, imageTag: directImage, triggeredBy: 'manual', status: 'deploying', operationId: r.out?.operationId || null }).catch(() => {});
  // Reflect the in-flight deploy on the service header too (online → deploying), so it matches
  // the deploy row until the app op reconciles to online/crashed.
  await Service.markDeploying(service.id).catch(() => {});
  return res.status(202).json({ ...r.out, ...(commitSha ? { commit_sha: commitSha } : {}), ...(directImage ? { image: directImage } : {}) });
};

// POST /api/site/tenants/:tenantId/suspend  body: { mode, reason_code? }
// Suspend the tenant (contract §9.10): set the product suspend state (blocks mutations
// immediately) and enqueue the site op. Never deletes data. Async → 202 + operation.
exports.suspendTenant = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const tenantId = req.params.tenantId;
  if (!mayActOnTenant(req.user, tenantId)) return res.status(403).json({ error: 'Forbidden' });
  const mode = String(req.body.mode || '');
  if (!tenantSuspend.isValidMode(mode)) {
    return res.status(400).json({ error: `Invalid mode. One of: ${tenantSuspend.SUSPEND_MODES.join(', ')}` });
  }
  const r = await withTenantPlacement(tenantId, (client, t) => enqueueTenantSuspend(client, {
    tenantRef: t.site_tenant_ref, tenantId, siteId: t.site_id, mode, reasonCode: req.body.reason_code || null,
  }));
  if (r.error === 404) return res.status(404).json({ error: 'Tenant not placed on a site yet' });
  await tenantSuspend.setSuspendMode(tenantId, mode); // product desired state → mutations blocked now
  return res.status(202).json({ ...r.out, mode });
};

// POST /api/site/tenants/:tenantId/resume — clear suspension + enqueue the site resume.
exports.resumeTenant = async (req, res) => {
  if (!proEnabled()) return res.status(404).json({ error: 'Not found' });
  const tenantId = req.params.tenantId;
  if (!mayActOnTenant(req.user, tenantId)) return res.status(403).json({ error: 'Forbidden' });
  const r = await withTenantPlacement(tenantId, (client, t) => enqueueTenantResume(client, {
    tenantRef: t.site_tenant_ref, tenantId, siteId: t.site_id,
  }));
  if (r.error === 404) return res.status(404).json({ error: 'Tenant not placed on a site yet' });
  await tenantSuspend.setSuspendMode(tenantId, null); // active again
  return res.status(202).json(r.out);
};
