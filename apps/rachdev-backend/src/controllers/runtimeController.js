'use strict';

/**
 * Runtime phone-home API (`/api/runtime/v1`) — the control-plane side of the
 * on-prem / BYOC contract.
 *
 * A customer runs the RachDev runtime agent inside their own network/cloud. It
 * makes ONLY outbound calls here, authenticated with a per-deployment runtime
 * token (Authorization: Bearer rt_…, minted once at self-host deploy):
 *
 *   GET  /api/runtime/v1/spec       → pull the deployment's published AgentSpec
 *   POST /api/runtime/v1/telemetry  → push METADATA-ONLY telemetry (status,
 *                                      counts, latency, version) — never content
 *
 * We never open an inbound connection into the customer's network. Raw
 * conversation data stays on their premises; only aggregates reach the dashboard.
 */

const { AgentDefinition, AgentDeployment } = require('@rach/core');

// GET /api/runtime/v1/spec — the runtime agent pulls (or refreshes) its spec.
exports.spec = async (req, res) => {
  const d = req.deployment;
  const spec = await AgentDefinition.getVersion(d.tenant_id, d.agent_key, d.version);
  if (!spec) return res.status(404).json({ error: 'No published spec for this deployment' });
  await AgentDeployment.touchHeartbeat(d.id);
  res.json({
    deployment_id: d.id,
    agent_key: d.agent_key,
    version: d.version,
    // The spec the runtime executes: prompt, tools, guardrails, model policy,
    // channels. The customer supplies their own LLM key at the runtime — no
    // platform key or credits are involved for a self-hosted agent.
    spec,
    poll_interval_seconds: 300,
    telemetry_interval_seconds: 60,
  });
};

// POST /api/runtime/v1/telemetry — metadata-only heartbeat + aggregates.
exports.telemetry = async (req, res) => {
  const d = req.deployment;
  const body = req.body || {};

  // Whitelist metadata fields — defend against any content sneaking upward.
  const t = body.metrics && typeof body.metrics === 'object' ? body.metrics : {};
  const telemetry = {
    runs_total: Number(t.runs_total) || 0,
    runs_window: Number(t.runs_window) || 0,
    errors_total: Number(t.errors_total) || 0,
    p50_latency_ms: t.p50_latency_ms != null ? Number(t.p50_latency_ms) : null,
    p95_latency_ms: t.p95_latency_ms != null ? Number(t.p95_latency_ms) : null,
    tokens_in: Number(t.tokens_in) || 0,
    tokens_out: Number(t.tokens_out) || 0,
    reported_at: new Date().toISOString(),
  };
  const status = ['running', 'stopped', 'failed', 'pending'].includes(body.status) ? body.status : 'running';
  const runtimeVersion = typeof body.runtime_version === 'string' ? body.runtime_version.slice(0, 40) : null;
  // Endpoint is metadata only (e.g. the local URL the customer exposes) — optional.
  const endpoint = body.endpoint && typeof body.endpoint === 'object' ? body.endpoint : null;

  const updated = await AgentDeployment.recordTelemetry(d.id, { status, telemetry, runtime_version: runtimeVersion, endpoint });
  res.json({ ok: true, deployment_id: d.id, status: updated ? updated.status : status });
};
