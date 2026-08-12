'use strict';

const pool = require('../config/db');
const { encryptJson, decryptJson } = require('../services/secretbox');

/**
 * Integration — per-tenant connector connections (migration 084).
 * Credentials are encrypted at rest; `list` never returns them, only the
 * runtime `getCredentials` decrypts (server-side) for tool execution.
 */
const Integration = {
  /** Connect (or re-connect) a connector. Omit credentials to keep existing ones. */
  async connect(tenantId, connector, { credentials, config = {}, userId = null } = {}) {
    const hasCreds = credentials && Object.keys(credentials).length > 0;
    const enc = hasCreds ? encryptJson(credentials) : null;
    const { rows } = await pool.query(
      `INSERT INTO tenant_integrations (tenant_id, connector, status, credentials_encrypted, config, created_by)
       VALUES ($1, $2, 'connected', $3, $4::jsonb, $5)
       ON CONFLICT (tenant_id, connector) DO UPDATE SET
         status = 'connected',
         credentials_encrypted = COALESCE(EXCLUDED.credentials_encrypted, tenant_integrations.credentials_encrypted),
         config = EXCLUDED.config,
         updated_at = NOW()
       RETURNING id, tenant_id, connector, status, config, created_at, updated_at`,
      [tenantId, connector, enc, JSON.stringify(config || {}), userId]
    );
    return rows[0]; // never includes credentials
  },

  /** Connected/disconnected status + non-secret config for a tenant. No secrets. */
  async list(tenantId) {
    const { rows } = await pool.query(
      'SELECT id, connector, status, config, updated_at FROM tenant_integrations WHERE tenant_id = $1 ORDER BY connector',
      [tenantId]
    );
    return rows;
  },

  /** Server-side only: decrypt credentials for runtime tool execution. */
  async getCredentials(tenantId, connector) {
    const { rows } = await pool.query(
      'SELECT credentials_encrypted, config, status FROM tenant_integrations WHERE tenant_id = $1 AND connector = $2',
      [tenantId, connector]
    );
    const row = rows[0];
    if (!row || row.status !== 'connected') return null;
    const credentials = row.credentials_encrypted ? decryptJson(row.credentials_encrypted) : {};
    return { credentials, config: row.config || {} };
  },

  async disconnect(tenantId, connector) {
    await pool.query(
      "UPDATE tenant_integrations SET status = 'disconnected', credentials_encrypted = NULL, updated_at = NOW() WHERE tenant_id = $1 AND connector = $2",
      [tenantId, connector]
    );
  },
};

module.exports = Integration;
