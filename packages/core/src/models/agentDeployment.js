'use strict';

const crypto = require('crypto');
const pool = require('../config/db');

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// A deployment is considered "live" if it phoned home within this window.
const HEARTBEAT_STALE_MS = 3 * 60 * 1000;

/**
 * AgentDeployment — the current deployment of an agent (run-time side of the
 * build/operate seam). One row per (tenant_id, agent_key), pinned to a published
 * version. Redeploying upserts. Contract: docs/RACHDEV_RUNTIME_CONTRACT.md.
 *
 * Holds METADATA only (handle, status, endpoint, timestamps) — never
 * conversation content, so the same dashboard is safe for on-prem deployments.
 */
const AgentDeployment = {
  /** Upsert the current deployment for (tenant, agent_key). */
  async upsert({
    tenant_id,
    agent_key,
    version,
    runtime_target = { type: 'rachbase' },
    runtime_handle = null,
    status = 'pending',
    endpoint = null,
    last_error = null,
    created_by = null,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO agent_deployments
         (tenant_id, agent_key, version, runtime_target, runtime_handle,
          status, endpoint, last_error, last_status_at, created_by)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7::jsonb,$8,NOW(),$9)
       ON CONFLICT (tenant_id, agent_key) DO UPDATE SET
         version        = EXCLUDED.version,
         runtime_target = EXCLUDED.runtime_target,
         runtime_handle = EXCLUDED.runtime_handle,
         status         = EXCLUDED.status,
         endpoint       = EXCLUDED.endpoint,
         last_error     = EXCLUDED.last_error,
         last_status_at = NOW(),
         updated_at     = NOW()
       RETURNING *`,
      [
        tenant_id, agent_key, version,
        JSON.stringify(runtime_target), runtime_handle,
        status, endpoint == null ? null : JSON.stringify(endpoint),
        last_error, created_by,
      ]
    );
    return rows[0];
  },

  async listForTenant(tenantId) {
    const { rows } = await pool.query(
      `SELECT * FROM agent_deployments WHERE tenant_id = $1 ORDER BY agent_key`,
      [tenantId]
    );
    return rows;
  },

  async findForTenant(tenantId, id) {
    const { rows } = await pool.query(
      `SELECT * FROM agent_deployments WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return rows[0] || null;
  },

  /** Update the last-known status/telemetry snapshot (metadata only). */
  async updateStatus(id, { status, endpoint, last_error = null }) {
    const { rows } = await pool.query(
      `UPDATE agent_deployments
         SET status = COALESCE($2, status),
             endpoint = COALESCE($3::jsonb, endpoint),
             last_error = $4,
             last_status_at = NOW(),
             updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status ?? null, endpoint == null ? null : JSON.stringify(endpoint), last_error]
    );
    return rows[0] || null;
  },

  // ── Pull-based runtime (on-prem / BYOC): token + telemetry ──────────────────

  /** Mint (or rotate) the per-deployment runtime token. Returns plaintext ONCE. */
  async mintRuntimeToken(id, { placement = null } = {}) {
    const secret = `rt_${crypto.randomBytes(24).toString('hex')}`;
    const prefix = secret.slice(0, 11); // 'rt_' + 8 chars
    const { rows } = await pool.query(
      `UPDATE agent_deployments
          SET runtime_token_hash = $2, runtime_token_prefix = $3,
              placement = COALESCE($4, placement), updated_at = NOW()
        WHERE id = $1
        RETURNING id`,
      [id, sha256(secret), prefix, placement]
    );
    if (!rows[0]) return null;
    return { token: secret, prefix };
  },

  /** Verify a presented runtime token → the deployment row (or null). */
  async verifyRuntimeToken(secret) {
    if (!secret || !String(secret).startsWith('rt_')) return null;
    const { rows } = await pool.query(
      `SELECT * FROM agent_deployments WHERE runtime_token_hash = $1`,
      [sha256(secret)]
    );
    return rows[0] || null;
  },

  /** Record a metadata-only telemetry snapshot from a phoning-home runtime. */
  async recordTelemetry(id, { status = null, telemetry = null, runtime_version = null, endpoint = null } = {}) {
    const { rows } = await pool.query(
      `UPDATE agent_deployments
          SET status          = COALESCE($2, status),
              telemetry       = COALESCE($3::jsonb, telemetry),
              runtime_version = COALESCE($4, runtime_version),
              endpoint        = COALESCE($5::jsonb, endpoint),
              last_heartbeat_at = NOW(),
              last_status_at    = NOW(),
              updated_at        = NOW()
        WHERE id = $1
        RETURNING *`,
      [
        id, status,
        telemetry == null ? null : JSON.stringify(telemetry),
        runtime_version,
        endpoint == null ? null : JSON.stringify(endpoint),
      ]
    );
    return rows[0] || null;
  },

  /** Bump only the heartbeat (e.g. on a spec pull). */
  async touchHeartbeat(id) {
    await pool.query('UPDATE agent_deployments SET last_heartbeat_at = NOW() WHERE id = $1', [id]).catch(() => {});
  },

  /**
   * Derive live health for a pull-based deployment from its last heartbeat.
   *   never phoned home → 'pending'; recent → the reported status (or 'running');
   *   stale → 'unreachable'.
   */
  health(row) {
    if (!row) return { status: 'unknown', live: false, last_heartbeat_at: null };
    const hb = row.last_heartbeat_at ? new Date(row.last_heartbeat_at).getTime() : 0;
    if (!hb) return { status: 'pending', live: false, last_heartbeat_at: null };
    const live = (Date.now() - hb) < HEARTBEAT_STALE_MS;
    return {
      status: live ? (row.status || 'running') : 'unreachable',
      live,
      last_heartbeat_at: row.last_heartbeat_at,
      runtime_version: row.runtime_version || null,
    };
  },

  HEARTBEAT_STALE_MS,
};

module.exports = AgentDeployment;
