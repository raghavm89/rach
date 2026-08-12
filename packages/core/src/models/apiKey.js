'use strict';

const crypto = require('crypto');
const pool = require('../config/db');

/**
 * ApiKey — workspace API keys for programmatic agent access (migration 090).
 * The plaintext secret is returned ONLY at creation; we persist a SHA-256 hash.
 * `verify` looks a presented key up by hash and (if live) bumps last_used.
 */

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

const ApiKey = {
  /** Create a key. Returns the row PLUS the one-time plaintext `key`. */
  async create(tenantId, { name = 'API key', userId = null } = {}) {
    const secret = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const prefix = secret.slice(0, 14); // 'sk_live_' + 6 chars
    const { rows } = await pool.query(
      `INSERT INTO agent_api_keys (tenant_id, name, key_hash, prefix, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, tenant_id, name, prefix, created_at, last_used_at, revoked_at`,
      [tenantId, name, sha256(secret), prefix, userId]
    );
    return { ...rows[0], key: secret };
  },

  /** List a tenant's keys (never the secret). */
  async list(tenantId) {
    const { rows } = await pool.query(
      `SELECT id, name, prefix, created_at, last_used_at, revoked_at
         FROM agent_api_keys WHERE tenant_id = $1 ORDER BY id DESC`,
      [tenantId]
    );
    return rows;
  },

  /** Verify a presented secret → { id, tenant_id } if live, else null. Bumps last_used. */
  async verify(secret) {
    if (!secret) return null;
    const { rows } = await pool.query(
      'SELECT id, tenant_id FROM agent_api_keys WHERE key_hash = $1 AND revoked_at IS NULL',
      [sha256(secret)]
    );
    const row = rows[0];
    if (!row) return null;
    pool.query('UPDATE agent_api_keys SET last_used_at = NOW() WHERE id = $1', [row.id]).catch(() => {});
    return { id: row.id, tenant_id: row.tenant_id };
  },

  /** Revoke (soft) a key. Tenant-scoped. */
  async revoke(tenantId, id) {
    const { rowCount } = await pool.query(
      'UPDATE agent_api_keys SET revoked_at = NOW() WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL',
      [id, tenantId]
    );
    return rowCount > 0;
  },
};

module.exports = ApiKey;
