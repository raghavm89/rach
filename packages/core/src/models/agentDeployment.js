'use strict';

const pool = require('../config/db');

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
};

module.exports = AgentDeployment;
