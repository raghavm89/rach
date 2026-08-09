'use strict';

/**
 * Deployment controller — the run-time side of the build/operate seam.
 *
 * Deploys a PUBLISHED agent version through the Agent Runtime Contract
 * (services/agentRuntimeClient). Agent verbs only — no VM ids, no shell. The
 * runtime target (RachBase / on-prem / BYOC) comes from the published spec.
 * Contract: docs/RACHDEV_RUNTIME_CONTRACT.md.
 */

const { AgentDefinition, AgentDeployment } = require('@rach/core');
const runtime = require('../services/agentRuntimeClient');

// ── POST /api/agent/definitions/:id/deploy ───────────────────────────────────
// Deploy the agent's current published version to its runtime target.
exports.deploy = async (req, res) => {
  const def = await AgentDefinition.findById(req.params.id);
  if (!def || def.tenant_id !== req.user.tenant_id) {
    return res.status(404).json({ error: 'Definition not found' });
  }

  // A deployment must reference an immutable published version.
  const spec = await AgentDefinition.getVersion(req.user.tenant_id, def.key, def.version);
  if (!spec) {
    return res.status(409).json({ error: 'Publish the agent before deploying', code: 'not_published' });
  }

  const target = spec.runtime_target || { type: 'rachbase' };
  try {
    const result = await runtime.deploy({ tenantId: req.user.tenant_id, spec });
    const deployment = await AgentDeployment.upsert({
      tenant_id: req.user.tenant_id,
      agent_key: def.key,
      version: spec.version,
      runtime_target: target,
      runtime_handle: result.handle,
      status: result.status,
      endpoint: result.endpoint,
      created_by: req.user.id,
    });
    // Reflect the deployed state on the definition.
    await AgentDefinition.update(def.id, { status: 'deployed' });
    return res.status(result.status === 'pending' ? 202 : 201).json({ deployment });
  } catch (err) {
    // Record the failure so the dashboard shows why, then surface it.
    const deployment = await AgentDeployment.upsert({
      tenant_id: req.user.tenant_id,
      agent_key: def.key,
      version: spec.version,
      runtime_target: target,
      status: 'failed',
      last_error: err.message,
      created_by: req.user.id,
    });
    return res.status(err.status || 502).json({ error: err.message, deployment });
  }
};

// ── GET /api/agent/deployments ───────────────────────────────────────────────
exports.list = async (req, res) => {
  const deployments = await AgentDeployment.listForTenant(req.user.tenant_id);
  res.json({ deployments });
};

async function loadDeployment(req, res) {
  const d = await AgentDeployment.findForTenant(req.user.tenant_id, req.params.id);
  if (!d) { res.status(404).json({ error: 'Deployment not found' }); return null; }
  return d;
}

// ── GET /api/agent/deployments/:id/status ────────────────────────────────────
exports.status = async (req, res) => {
  const d = await loadDeployment(req, res); if (!d) return;
  const info = await runtime.status({ tenantId: req.user.tenant_id, handle: d.runtime_handle, target: d.runtime_target });
  // Persist the latest metadata snapshot.
  if (info.status) await AgentDeployment.updateStatus(d.id, { status: info.status, endpoint: info.endpoint });
  res.json({ deployment_id: d.id, ...info });
};

// ── GET /api/agent/deployments/:id/metrics ───────────────────────────────────
exports.metrics = async (req, res) => {
  const d = await loadDeployment(req, res); if (!d) return;
  const info = await runtime.metrics({ tenantId: req.user.tenant_id, handle: d.runtime_handle, target: d.runtime_target });
  res.json({ deployment_id: d.id, ...info });
};

// ── GET /api/agent/deployments/:id/logs ──────────────────────────────────────
exports.logs = async (req, res) => {
  const d = await loadDeployment(req, res); if (!d) return;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const info = await runtime.logs({ tenantId: req.user.tenant_id, handle: d.runtime_handle, target: d.runtime_target, limit });
  res.json({ deployment_id: d.id, ...info });
};

// ── POST /api/agent/deployments/:id/stop ─────────────────────────────────────
exports.stop = async (req, res) => {
  const d = await loadDeployment(req, res); if (!d) return;
  const info = await runtime.stop({ tenantId: req.user.tenant_id, handle: d.runtime_handle, target: d.runtime_target });
  const deployment = await AgentDeployment.updateStatus(d.id, { status: info.status || 'stopped' });
  res.json({ deployment });
};
