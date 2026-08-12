'use strict';

/**
 * Agent Runtime Contract (RachBase side).
 *
 * Implements the /internal/agent-runtime/* endpoints that RachDev's
 * agentRuntimeClient calls to run a published agent spec on RachBase-managed
 * infrastructure. All routes are gated by serviceAuth (shared token) — the
 * caller (RachDev) has already authenticated the end user and passes tenant_id.
 *
 * This first version registers the spec as a running instance and keeps a run
 * log; the container/execution engine that actually serves traffic is a
 * follow-up that plugs in behind this same contract (deploy returns a handle,
 * status/logs/stop operate on it) without changing RachDev.
 */

const crypto = require('crypto');
const { pool } = require('@rach/core');

const newHandle = () => `art_${crypto.randomBytes(12).toString('hex')}`;

async function addLog(handle, tenantId, level, message) {
  await pool.query(
    'INSERT INTO agent_runtime_logs (handle, tenant_id, level, message) VALUES ($1,$2,$3,$4)',
    [handle, tenantId, level, message]
  );
}

async function findInstance(handle, tenantId) {
  const { rows } = await pool.query(
    'SELECT * FROM agent_runtime_instances WHERE handle = $1 AND tenant_id = $2',
    [handle, tenantId]
  );
  return rows[0] || null;
}

// POST /internal/agent-runtime/deploy  { tenant_id, agent_key, version, spec }
// Registers (or updates) a running instance. Idempotent per (tenant, agent_key).
exports.deploy = async (req, res) => {
  const { tenant_id, agent_key, version, spec } = req.body || {};
  if (!tenant_id || !agent_key || !spec) {
    return res.status(400).json({ error: 'tenant_id, agent_key and spec are required' });
  }
  const existing = await pool.query(
    'SELECT handle FROM agent_runtime_instances WHERE tenant_id = $1 AND agent_key = $2',
    [tenant_id, agent_key]
  );
  let handle;
  if (existing.rows.length) {
    handle = existing.rows[0].handle;
    await pool.query(
      "UPDATE agent_runtime_instances SET version = $1, spec = $2::jsonb, status = 'running', updated_at = NOW() WHERE handle = $3",
      [version || 1, JSON.stringify(spec), handle]
    );
  } else {
    handle = newHandle();
    await pool.query(
      "INSERT INTO agent_runtime_instances (handle, tenant_id, agent_key, version, spec, status) VALUES ($1,$2,$3,$4,$5::jsonb,'running')",
      [handle, tenant_id, agent_key, version || 1, JSON.stringify(spec)]
    );
  }
  await addLog(handle, tenant_id, 'info', `Deployed ${agent_key} v${version || 1} — agent is live on RachBase.`);
  res.json({ handle, status: 'running', endpoint: null });
};

// POST /internal/agent-runtime/status  { tenant_id, handle }
exports.status = async (req, res) => {
  const { tenant_id, handle } = req.body || {};
  const inst = await findInstance(handle, tenant_id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  res.json({ status: inst.status, version: inst.version, updated_at: inst.updated_at });
};

// POST /internal/agent-runtime/metrics  { tenant_id, handle }
exports.metrics = async (req, res) => {
  const { tenant_id, handle } = req.body || {};
  const inst = await findInstance(handle, tenant_id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM agent_runtime_logs WHERE handle = $1', [handle]);
  const uptimeS = Math.max(0, Math.floor((Date.now() - new Date(inst.created_at).getTime()) / 1000));
  res.json({ status: inst.status, uptime_s: uptimeS, log_events: rows[0].n, requests: 0 });
};

// POST /internal/agent-runtime/logs  { tenant_id, handle, limit }
exports.logs = async (req, res) => {
  const { tenant_id, handle } = req.body || {};
  const limit = Math.min(Number(req.body && req.body.limit) || 100, 500);
  const inst = await findInstance(handle, tenant_id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  const { rows } = await pool.query(
    'SELECT level, message, created_at FROM agent_runtime_logs WHERE handle = $1 ORDER BY created_at DESC LIMIT $2',
    [handle, limit]
  );
  // Chronological for display.
  const logs = rows.reverse().map((r) => ({ ts: r.created_at, level: r.level, message: r.message }));
  res.json({ logs });
};

// POST /internal/agent-runtime/stop  { tenant_id, handle }
exports.stop = async (req, res) => {
  const { tenant_id, handle } = req.body || {};
  const inst = await findInstance(handle, tenant_id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  await pool.query("UPDATE agent_runtime_instances SET status = 'stopped', updated_at = NOW() WHERE handle = $1", [handle]);
  await addLog(handle, tenant_id, 'info', 'Agent stopped.');
  res.json({ status: 'stopped' });
};
