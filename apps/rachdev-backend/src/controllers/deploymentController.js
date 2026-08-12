'use strict';

/**
 * Deployment controller — the run-time side of the build/operate seam.
 *
 * Deploys a PUBLISHED agent version through the Agent Runtime Contract
 * (services/agentRuntimeClient). Agent verbs only — no VM ids, no shell. The
 * runtime target (RachBase / on-prem / BYOC) comes from the published spec.
 * Contract: docs/RACHDEV_RUNTIME_CONTRACT.md.
 */

const { AgentDefinition, AgentDeployment, Settings } = require('@rach/core');
const runtime = require('../services/agentRuntimeClient');

const rachbaseReady = () => !!(process.env.RACHBASE_API_URL && process.env.RACHBASE_SERVICE_TOKEN);

// Public run surface for a managed (RachBase) agent — where it answers, + embed.
function runSurface(req, token) {
  const apiBase = process.env.PUBLIC_API_BASE || `${req.protocol}://${req.get('host')}`;
  const widgetUrl = `${apiBase}/api/public/agent/${token}/widget.js`;
  return {
    publicToken: token,
    widgetUrl,
    messageUrl: `${apiBase}/api/public/agent/${token}/message`,
    embed: `<script src="${widgetUrl}" async></script>`,
  };
}

// Self-host bundle: the config to run elsewhere + a short setup guide.
function selfHostBundle(spec, req) {
  const apiBase = process.env.PUBLIC_API_BASE || `${req.protocol}://${req.get('host')}`;
  return {
    config: spec, // downloadable JSON — prompts, tools, guardrails, model policy
    instructions: {
      steps: [
        'Download the agent config (JSON) below.',
        'Run the RachDev runtime agent (or your own) pointed at this config — it pulls the spec and streams telemetry back.',
        'Point your channel/webhook at your own runtime. Guardrails, prompts, and evals travel with the config.',
      ],
      docs_url: `${apiBase}/docs`,
    },
  };
}

// Resolve the effective target: explicit choice (Ship it dialog) → workspace
// default (Settings) → null. The agent spec's runtime_target is a hardcoded
// default, not user intent, so it does not drive the choice here.
async function resolveTarget(req) {
  const body = req.body && req.body.target;
  if (body === 'rachbase' || body === 'self_hosted') return body;
  const v = await Settings.get(req.user.tenant_id, 'deploy').catch(() => null);
  if (v && (v.target === 'rachbase' || v.target === 'self_hosted')) return v.target;
  return null;
}

// ── POST /api/agent/definitions/:id/deploy ───────────────────────────────────
// Deploy the agent's current published version to the chosen runtime target.
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

  const target = await resolveTarget(req);
  if (!target) {
    // Guard: nothing configured → tell the user to choose, don't fail obscurely.
    return res.status(400).json({ code: 'no_target', error: 'Choose where this agent runs — pick a deployment target in the Ship it dialog or under Settings → Deployment.' });
  }

  // ── Self-hosted: no push (avoids the RachBase round-trip). Records a pull-based
  //    deployment and returns the export bundle + setup instructions. ──
  if (target === 'self_hosted') {
    const effectiveSpec = { ...spec, runtime_target: { type: 'byoc' } };
    const result = await runtime.deploy({ tenantId: req.user.tenant_id, spec: effectiveSpec });
    const deployment = await AgentDeployment.upsert({
      tenant_id: req.user.tenant_id, agent_key: def.key, version: spec.version,
      runtime_target: { type: 'byoc' }, runtime_handle: result.handle, status: result.status,
      endpoint: result.endpoint, created_by: req.user.id,
    });
    await AgentDefinition.update(def.id, { status: 'deployed' });
    return res.status(202).json({ mode: 'self_hosted', deployment, ...selfHostBundle(spec, req) });
  }

  // ── Managed (RachBase): guard if not wired, else push. ──
  if (!rachbaseReady()) {
    return res.status(409).json({ code: 'target_unconfigured', error: "RachBase deployment isn't set up for this workspace yet. Configure it under Settings → Deployment, or choose Self-hosted." });
  }
  const effectiveSpec = { ...spec, runtime_target: { type: 'rachbase' } };
  try {
    const result = await runtime.deploy({ tenantId: req.user.tenant_id, spec: effectiveSpec });
    const deployment = await AgentDeployment.upsert({
      tenant_id: req.user.tenant_id, agent_key: def.key, version: spec.version,
      runtime_target: { type: 'rachbase' }, runtime_handle: result.handle, status: result.status,
      endpoint: result.endpoint, created_by: req.user.id,
    });
    await AgentDefinition.update(def.id, { status: 'deployed' });
    const token = await AgentDefinition.ensurePublicToken(def.id);
    return res.status(result.status === 'pending' ? 202 : 201).json({ mode: 'rachbase', deployment, ...runSurface(req, token) });
  } catch (err) {
    const deployment = await AgentDeployment.upsert({
      tenant_id: req.user.tenant_id, agent_key: def.key, version: spec.version,
      runtime_target: { type: 'rachbase' }, status: 'failed', last_error: err.message, created_by: req.user.id,
    });
    return res.status(err.status || 502).json({ mode: 'rachbase', error: err.message, deployment });
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
  // Always return the deployment's own status + last error; runtime logs are
  // best-effort (the runtime may be unreachable, esp. right after a failed deploy).
  const meta = {
    deployment_id: d.id,
    agent_key: d.agent_key,
    version: d.version,
    status: d.status,
    target: d.runtime_target && d.runtime_target.type,
    last_error: d.last_error || null,
    last_status_at: d.last_status_at || null,
  };
  try {
    const info = await runtime.logs({ tenantId: req.user.tenant_id, handle: d.runtime_handle, target: d.runtime_target, limit });
    res.json({ ...meta, logs: Array.isArray(info.logs) ? info.logs : [], note: info.note || null });
  } catch (err) {
    res.json({ ...meta, logs: [], note: `Runtime logs unavailable: ${err.message}` });
  }
};

// ── POST /api/agent/deployments/:id/stop ─────────────────────────────────────
exports.stop = async (req, res) => {
  const d = await loadDeployment(req, res); if (!d) return;
  const info = await runtime.stop({ tenantId: req.user.tenant_id, handle: d.runtime_handle, target: d.runtime_target });
  const deployment = await AgentDeployment.updateStatus(d.id, { status: info.status || 'stopped' });
  res.json({ deployment });
};
