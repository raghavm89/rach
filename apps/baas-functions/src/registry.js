'use strict';

/** Function registry (Phase 3, slice 5) — deployed function code + secrets in the PROJECT DB.
 * The Deno runner executes the code; this is the control plane (deploy/list/get/delete). Any
 * pg-like client with `.query`. `ensureSchema` is idempotent (self-bootstrap). */

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,61}$/;
const SECRET_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const crypto = require('crypto');
const digestOf = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

function makeRegistry(pool) {
  return {
    async ensureSchema() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS functions (
          name       TEXT PRIMARY KEY,
          code       TEXT NOT NULL,
          secrets    JSONB NOT NULL DEFAULT '{}'::jsonb,
          version    INTEGER NOT NULL DEFAULT 1,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      // Project-level function secrets (env available to every function). Value stored in the
      // project's own DB; only the SHA-256 digest is shown in the dashboard, never the value.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS function_secrets (
          name       TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          digest     TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    },

    // ── Project-level secrets ──
    async setSecrets(pairs) {
      const clean = (Array.isArray(pairs) ? pairs : []).filter((p) => SECRET_NAME_RE.test(String(p?.name || '')) && p.value != null).slice(0, 200);
      if (!clean.length) throw new Error('no_valid_secrets');
      for (const p of clean) {
        await pool.query(
          `INSERT INTO function_secrets (name, value, digest) VALUES ($1, $2, $3)
           ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, digest = EXCLUDED.digest, updated_at = NOW()`,
          [p.name, String(p.value), digestOf(p.value)]);
      }
      return clean.length;
    },
    async listSecrets() {
      const { rows } = await pool.query('SELECT name, digest, updated_at FROM function_secrets ORDER BY name');
      return rows;
    },
    async deleteSecret(name) {
      const { rowCount } = await pool.query('DELETE FROM function_secrets WHERE name = $1', [name]);
      return rowCount > 0;
    },
    async secretsMap() {
      const { rows } = await pool.query('SELECT name, value FROM function_secrets');
      return Object.fromEntries(rows.map((r) => [r.name, r.value]));
    },
    async deploy({ name, code, secrets }) {
      if (!NAME_RE.test(String(name || ''))) throw new Error('invalid_function_name');
      if (!code || typeof code !== 'string') throw new Error('code_required');
      const sec = secrets && typeof secrets === 'object' ? JSON.stringify(secrets) : '{}';
      const { rows } = await pool.query(
        `INSERT INTO functions (name, code, secrets) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code, secrets = EXCLUDED.secrets,
           version = functions.version + 1, updated_at = NOW()
         RETURNING name, version, updated_at`, [name, code, sec]);
      return rows[0];
    },
    async get(name) {
      const { rows } = await pool.query('SELECT name, code, secrets, version FROM functions WHERE name = $1', [name]);
      return rows[0] || null;
    },
    async list() {
      const { rows } = await pool.query('SELECT name, version, updated_at FROM functions ORDER BY name');
      return rows;
    },
    async remove(name) {
      const { rowCount } = await pool.query('DELETE FROM functions WHERE name = $1', [name]);
      return rowCount > 0;
    },
  };
}

module.exports = { makeRegistry, NAME_RE };
