'use strict';

/**
 * Application Workload Monitoring — user-defined HTTP health-check endpoints.
 *
 * Sold per-endpoint (catalog id 'mon'): a tenant may keep at most `purchasedQty`
 * enabled+disabled endpoints. Creation is quota-gated. A background prober
 * (services/endpointProber.js) probes each endpoint and records status/alerts.
 */

const pool = require('@rach/core').pool;
const asyncHandler = require('@rach/core').asyncHandler;
const { purchasedQty } = require('../lib/entitlements');

const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']);

function validUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch { return false; }
}

function sanitize(body) {
  const name = String(body.name || '').trim().slice(0, 120);
  const url  = String(body.url || '').trim();
  const method = String(body.method || 'GET').toUpperCase();
  const expected = Number(body.expected_status);
  const interval = Number(body.interval_seconds);
  return {
    name,
    url,
    method: METHODS.has(method) ? method : 'GET',
    expected_status: (expected >= 100 && expected <= 599) ? expected : 200,
    // Clamp interval to a sane range: 1 min … 24 h.
    interval_seconds: Math.min(Math.max(Number.isFinite(interval) ? interval : 300, 60), 86400),
    enabled: body.enabled !== false,
    service_id: body.service_id != null ? Number(body.service_id) : null,
  };
}

async function usedCount(tenantId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM monitored_endpoints WHERE tenant_id = $1', [tenantId]
  );
  return rows[0].n;
}

// GET /api/endpoints/quota — tenant's own purchased vs used
async function getQuota(req, res) {
  const tid = req.user.tenant_id;
  if (!tid) return res.json({ quota: null, used: 0, unlimited: true });
  const [quota, used] = await Promise.all([purchasedQty(tid, 'mon'), usedCount(tid)]);
  res.json({ quota, used, unlimited: false });
}

// GET /api/endpoints  (optionally ?service_id=)
async function listEndpoints(req, res) {
  const tid = req.user.tenant_id;
  const params = [tid];
  let where = 'tenant_id = $1';
  if (req.query.service_id) { params.push(Number(req.query.service_id)); where += ` AND service_id = $${params.length}`; }
  const { rows } = await pool.query(
    `SELECT id, service_id, name, url, method, expected_status, interval_seconds, enabled,
            last_status, last_code, last_latency_ms, last_checked_at, last_error, consecutive_failures, created_at
     FROM monitored_endpoints WHERE ${where} ORDER BY created_at DESC`,
    params
  );
  res.json({ endpoints: rows });
}

// POST /api/endpoints  — quota-gated
async function createEndpoint(req, res) {
  const tid = req.user.tenant_id;
  if (!tid) return res.status(400).json({ error: 'Endpoints are created per tenant' });

  const e = sanitize(req.body);
  if (!e.name) return res.status(400).json({ error: 'name is required' });
  if (!validUrl(e.url)) return res.status(400).json({ error: 'A valid http(s) URL is required' });

  const [quota, used] = await Promise.all([purchasedQty(tid, 'mon'), usedCount(tid)]);
  if (used >= quota) {
    return res.status(402).json({
      error: quota === 0
        ? 'Application Workload Monitoring is a paid add-on. Purchase at least one endpoint slot to add monitors.'
        : `Endpoint quota reached (${used}/${quota}). Buy more monitoring slots or delete an existing endpoint.`,
      feature: 'mon', quota, used,
    });
  }

  // If a service_id is given, it must belong to the tenant.
  if (e.service_id != null) {
    const { rows: s } = await pool.query(
      'SELECT 1 FROM deployment_services WHERE id = $1 AND tenant_id = $2', [e.service_id, tid]
    );
    if (!s.length) return res.status(400).json({ error: 'service_id does not belong to your tenant' });
  }

  const { rows } = await pool.query(
    `INSERT INTO monitored_endpoints
       (tenant_id, service_id, name, url, method, expected_status, interval_seconds, enabled, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [tid, e.service_id, e.name, e.url, e.method, e.expected_status, e.interval_seconds, e.enabled, req.user.id]
  );
  res.status(201).json({ endpoint: rows[0] });
}

// PATCH /api/endpoints/:id
async function updateEndpoint(req, res) {
  const tid = req.user.tenant_id;
  const { rows: own } = await pool.query(
    'SELECT id FROM monitored_endpoints WHERE id = $1 AND tenant_id = $2', [req.params.id, tid]
  );
  if (!own.length) return res.status(404).json({ error: 'Endpoint not found' });

  const e = sanitize({ ...req.body });
  const sets = [];
  const params = [];
  const set = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

  if (req.body.name !== undefined) { if (!e.name) return res.status(400).json({ error: 'name cannot be empty' }); set('name', e.name); }
  if (req.body.url !== undefined) { if (!validUrl(e.url)) return res.status(400).json({ error: 'A valid http(s) URL is required' }); set('url', e.url); }
  if (req.body.method !== undefined) set('method', e.method);
  if (req.body.expected_status !== undefined) set('expected_status', e.expected_status);
  if (req.body.interval_seconds !== undefined) set('interval_seconds', e.interval_seconds);
  if (req.body.enabled !== undefined) set('enabled', e.enabled);
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id, tid);
  const { rows } = await pool.query(
    `UPDATE monitored_endpoints SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *`,
    params
  );
  res.json({ endpoint: rows[0] });
}

// DELETE /api/endpoints/:id
async function deleteEndpoint(req, res) {
  const { rowCount } = await pool.query(
    'DELETE FROM monitored_endpoints WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenant_id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Endpoint not found' });
  res.json({ ok: true, id: Number(req.params.id) });
}

// GET /api/endpoints/:id/checks — recent history
async function getChecks(req, res) {
  const { rows: own } = await pool.query(
    'SELECT id FROM monitored_endpoints WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenant_id]
  );
  if (!own.length) return res.status(404).json({ error: 'Endpoint not found' });
  const { rows } = await pool.query(
    `SELECT checked_at, ok, status_code, latency_ms, error
     FROM endpoint_checks WHERE endpoint_id = $1 ORDER BY checked_at DESC LIMIT 50`,
    [req.params.id]
  );
  res.json({ checks: rows });
}

module.exports = {
  getQuota:       asyncHandler(getQuota),
  listEndpoints:  asyncHandler(listEndpoints),
  createEndpoint: asyncHandler(createEndpoint),
  updateEndpoint: asyncHandler(updateEndpoint),
  deleteEndpoint: asyncHandler(deleteEndpoint),
  getChecks:      asyncHandler(getChecks),
};
