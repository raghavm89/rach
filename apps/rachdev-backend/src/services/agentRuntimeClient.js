'use strict';

/**
 * AgentRuntimeClient — RachDev's client for the Agent Runtime Contract.
 *
 * This is the NEW seam (migration step #5). Unlike rachbaseClient, which speaks
 * infrastructure verbs (run-command, deploy a git service), this speaks AGENT
 * verbs — deploy(spec) / status / metrics / logs / stop — and never names a VM
 * or sends a shell command. RachBase decides internally which container on which
 * VM runs a published spec. Contract: docs/RACHDEV_RUNTIME_CONTRACT.md.
 *
 * Targets (from spec.runtime_target.type):
 *   • rachbase → push: call RachBase's internal agent-runtime API (service token)
 *   • onprem / byoc → pull: the customer's runtime agent fetches the spec and
 *     phones telemetry home. There is no push channel, so control calls return a
 *     'pending' metadata result rather than reaching into the customer's network.
 *
 * Env: RACHBASE_API_URL, RACHBASE_SERVICE_TOKEN.
 */

const BASE_URL = (process.env.RACHBASE_API_URL || 'http://localhost:8080').replace(/\/$/, '');
const SERVICE_TOKEN = process.env.RACHBASE_SERVICE_TOKEN || '';

async function post(pathname, body) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-service-token': SERVICE_TOKEN },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Agent runtime error (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function isPush(target) {
  return (target && target.type ? target.type : 'rachbase') === 'rachbase';
}

/** Deploy a published spec. Returns { handle, status, endpoint }. */
async function deploy({ tenantId, spec }) {
  const target = spec.runtime_target || { type: 'rachbase' };
  if (isPush(target)) {
    const r = await post('/internal/agent-runtime/deploy', {
      tenant_id: tenantId,
      agent_key: spec.key,
      version: spec.version,
      spec,
    });
    return { handle: r.handle ?? null, status: r.status || 'running', endpoint: r.endpoint ?? null };
  }
  // Pull-based target: nothing to push. The runtime agent will pick up the spec.
  return { handle: null, status: 'pending', endpoint: null, pull: true };
}

/** Current runtime status (metadata). */
async function status({ tenantId, handle, target }) {
  if (isPush(target)) {
    return post('/internal/agent-runtime/status', { tenant_id: tenantId, handle });
  }
  return { status: 'pending', note: 'pull-based target — status arrives via telemetry' };
}

/** Operational metrics (aggregates/counts — never conversation content). */
async function metrics({ tenantId, handle, target }) {
  if (isPush(target)) {
    return post('/internal/agent-runtime/metrics', { tenant_id: tenantId, handle });
  }
  return { metrics: {}, note: 'pull-based target — metrics arrive via telemetry' };
}

/** Operational logs (redaction-aware; metadata for pull targets). */
async function logs({ tenantId, handle, target, limit = 100 }) {
  if (isPush(target)) {
    return post('/internal/agent-runtime/logs', { tenant_id: tenantId, handle, limit });
  }
  return { logs: [], note: 'pull-based target — logs stay on the customer premises' };
}

/** Stop a running deployment. Returns { status }. */
async function stop({ tenantId, handle, target }) {
  if (isPush(target)) {
    const r = await post('/internal/agent-runtime/stop', { tenant_id: tenantId, handle });
    return { status: r.status || 'stopped' };
  }
  return { status: 'stopped', note: 'pull-based target — stop signalled on next check-in' };
}

module.exports = { deploy, status, metrics, logs, stop };
