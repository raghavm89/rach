'use strict';

/** Bucket registry — in the PROJECT database (like Auth's user table). `ensureSchema` is
 * idempotent so the service self-bootstraps. Object bytes live in SeaweedFS; only bucket
 * metadata (name + visibility) lives here. Any pg-like client with `.query`. */

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/; // DNS-ish bucket names

function makeStore(pool) {
  return {
    async ensureSchema() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS storage_buckets (
          name        TEXT PRIMARY KEY,
          visibility  TEXT NOT NULL DEFAULT 'private',
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    },
    async createBucket(name, visibility = 'private') {
      if (!NAME_RE.test(name)) throw new Error('invalid_bucket_name');
      const vis = visibility === 'public' ? 'public' : 'private';
      const { rows } = await pool.query(
        `INSERT INTO storage_buckets (name, visibility) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET visibility = EXCLUDED.visibility RETURNING *`, [name, vis]);
      return rows[0];
    },
    async getBucket(name) {
      const { rows } = await pool.query('SELECT * FROM storage_buckets WHERE name = $1', [name]);
      return rows[0] || null;
    },
    async listBuckets() {
      const { rows } = await pool.query('SELECT name, visibility, created_at FROM storage_buckets ORDER BY name');
      return rows;
    },
  };
}

module.exports = { makeStore, NAME_RE };
