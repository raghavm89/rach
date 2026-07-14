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
const { Project, Environment, Service, ServiceUnit, Deployment } = require('../models/project');
const serviceBilling = require('../services/serviceBilling');

// Plan unit quota. TODO: derive from the tenant's subscribed plan; env default for now.
const DEFAULT_UNIT_QUOTA = parseInt(process.env.SERVICE_UNIT_QUOTA || process.env.SERVICE_QUOTA || '10', 10);

async function unitQuotaFor(_tenantId) {
  // Placeholder: every tenant gets DEFAULT_UNIT_QUOTA until plan-linked quotas land.
  return DEFAULT_UNIT_QUOTA;
}

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

// Creating a service is free — it starts as a DRAFT with 0 units. Sizing is fixed
// per unit (0.5/0.5/0.5); the only source options are a GitHub repo or Postgres.
exports.createService = async (req, res) => {
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { name, source_type, repo_full_name, branch, image, compute_target, vm_id } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Service name is required' });

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
  res.status(201).json({ service });
};

exports.getService = async (req, res) => {
  const service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  const [deployments, units] = await Promise.all([
    Deployment.listByService(service.id),
    ServiceUnit.listByService(service.id),
  ]);
  res.json({ service, deployments, units });
};

// ── Service Units (pay-to-online + live scaling) ───────────────────────────────

// POST /:id/services/:sid/units/checkout
// Creates a Razorpay order for one unit and a pending ledger row. The client opens
// checkout with the returned order, then calls /units/verify. Used both to bring a
// draft online (first unit) and to "Add power" (each extra unit).
exports.checkoutUnit = async (req, res) => {
  const service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });

  // Quota is on active *units* across the tenant.
  const [used, quota] = await Promise.all([
    ServiceUnit.countActiveByTenant(req.user.tenant_id),
    unitQuotaFor(req.user.tenant_id),
  ]);
  if (used >= quota) {
    return res.status(402).json({
      error: `Unit quota reached for your plan (${quota}). Upgrade your plan to add more units.`,
      quota, used,
    });
  }

  const order = await serviceBilling.createUnitOrder({ tenantId: req.user.tenant_id, serviceId: service.id });
  const unit = await ServiceUnit.createPending({
    serviceId: service.id,
    tenantId: req.user.tenant_id,
    orderId: order.id,
    priceCents: serviceBilling.UNIT_PRICE_CENTS,
    currency: serviceBilling.UNIT_CURRENCY,
  });

  // Draft → pending_payment while the customer completes checkout.
  if (service.status === 'draft') await Service.setStatus(service.id, 'pending_payment');

  res.status(201).json({
    message: 'Order created. Open Razorpay checkout, then POST the result to /units/verify.',
    unit_id: unit.id,
    razorpay_order_id: order.id,
    razorpay_key_id: process.env.RAZORPAY_KEY_ID,
    amount: serviceBilling.UNIT_PRICE_CENTS,
    currency: serviceBilling.UNIT_CURRENCY,
  });
};

// POST /:id/services/:sid/units/verify
// Verifies the checkout signature, activates the unit, and applies it to the service
// (+1 unit; a draft/pending service comes online). Idempotent per order.
exports.verifyUnit = async (req, res) => {
  const service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const ok = serviceBilling.verifyPayment({
    orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature,
  });
  if (!ok) return res.status(400).json({ error: 'Payment signature verification failed' });

  const pending = await ServiceUnit.findPendingByOrder(razorpay_order_id);
  if (!pending || pending.service_id !== service.id) {
    return res.status(404).json({ error: 'No pending unit for this order' });
  }

  const activated = await ServiceUnit.activate({ unitId: pending.id, paymentId: razorpay_payment_id });
  if (!activated) return res.status(409).json({ error: 'Unit already activated' });

  const updated = await Service.applyActivatedUnit(service.id);
  res.json({
    message: updated.units === 1 ? 'Service is online.' : `Scaled to ${updated.units} units.`,
    service: updated,
    unit: activated,
  });
};

// POST /:id/services/:sid/deploy — records a deployment. Real build/run is handed to the
// orchestrator (k3s) once it exists; for now this creates the versioned deployment row.
exports.deployService = async (req, res) => {
  const service = await Service.findScoped(req.params.sid, req.user.tenant_id);
  if (!service) return res.status(404).json({ error: 'Service not found' });

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
