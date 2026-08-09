'use strict';

const pool = require('../config/db');

/**
 * Settings — generic per-tenant JSONB config (tenant_settings, migration 055).
 * One value blob per (tenant_id, key). Used e.g. for HR workspace settings.
 */
const Settings = {
  async get(tenantId, key) {
    const { rows } = await pool.query(
      'SELECT value FROM tenant_settings WHERE tenant_id = $1 AND key = $2',
      [tenantId, key]
    );
    return rows[0] ? rows[0].value : null;
  },

  /** Upsert the whole value blob for a key. */
  async set(tenantId, key, value) {
    const { rows } = await pool.query(
      `INSERT INTO tenant_settings (tenant_id, key, value)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (tenant_id, key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING value`,
      [tenantId, key, JSON.stringify(value ?? {})]
    );
    return rows[0].value;
  },
};

module.exports = Settings;
