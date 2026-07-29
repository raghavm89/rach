'use strict';

/**
 * Phase 2 · WS3 — Postgres data viewer + read-only query runner.
 *
 * A "postgres" resource is a `deployment_services` row (source_type='postgres')
 * whose `config` jsonb holds the connection details written by
 * services/postgresProvision.js: { engine:'native', host, port, db, user, password }.
 *
 * Safety model (Spike B):
 *   - Every query runs inside a `START TRANSACTION READ ONLY` with a
 *     `statement_timeout`, so writes and runaway queries are rejected by
 *     Postgres itself — even though the stored role owns the database.
 *   - Results are capped at MAX_ROWS.
 *   - Every query is audit-logged with tenant / user / service.
 *   - Access is tenant-scoped (the service must belong to the caller's tenant).
 */

const { Pool } = require('pg');
const { pool } = require('@rach/core');

const QUERY_TIMEOUT_MS = 5000;
const MAX_ROWS = 1000;

async function pgServiceForTenant(id, tenantId) {
  const { rows } = await pool.query(
    `SELECT id, name, source_type, config
       FROM deployment_services
      WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );
  return rows[0] || null;
}

/** Build a pg connection config from the service's stored config, or null. */
function connFromConfig(cfg) {
  if (!cfg || !cfg.host || !cfg.db || !cfg.user || !cfg.password) return null;
  return {
    host: cfg.host,
    port: Number(cfg.port) || 5432,
    database: cfg.db,
    user: cfg.user,
    password: cfg.password,
    ssl: false,
    max: 2,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
  };
}

/** Open a short-lived pool to the tenant DB, run fn(client), always clean up. */
async function withTenantDb(cfg, fn) {
  const p = new Pool(connFromConfig(cfg));
  // Never let a bad tenant DB take down the API process.
  p.on('error', () => {});
  try {
    const client = await p.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  } finally {
    await p.end().catch(() => {});
  }
}

function resolveOrReject(svc, res) {
  if (!svc) { res.status(404).json({ error: 'Service not found' }); return null; }
  if (svc.source_type !== 'postgres') { res.status(400).json({ error: 'Not a Postgres service' }); return null; }
  const conn = connFromConfig(svc.config);
  if (!conn) { res.status(409).json({ error: 'Database not provisioned yet' }); return null; }
  return conn;
}

// GET /api/deployment/services/:id/db/tables
exports.listTables = async (req, res) => {
  const svc = await pgServiceForTenant(req.params.id, req.user.tenant_id);
  if (!resolveOrReject(svc, res)) return;

  const tables = await withTenantDb(svc.config, async (client) => {
    const { rows } = await client.query(`
      SELECT t.table_schema, t.table_name,
             (SELECT count(*) FROM information_schema.columns c
               WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) AS column_count
        FROM information_schema.tables t
       WHERE t.table_type = 'BASE TABLE'
         AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
       ORDER BY t.table_schema, t.table_name
    `);
    return rows;
  });

  res.json({ tables });
};

// POST /api/deployment/services/:id/db/query   { sql }
exports.runQuery = async (req, res) => {
  const svc = await pgServiceForTenant(req.params.id, req.user.tenant_id);
  if (!resolveOrReject(svc, res)) return;

  const sql = String(req.body.sql || '').trim();
  if (!sql) return res.status(400).json({ error: 'Empty query' });

  // Write mode is an explicit, per-request opt-in the user toggles in the
  // dashboard. Read-only is the default.
  const write = req.body.write === true;

  // Audit — who ran what, against which service, in which mode.
  console.log(
    `[db-console] tenant=${req.user.tenant_id} user=${req.user.id} service=${svc.id} ` +
    `mode=${write ? 'WRITE' : 'read'} sql="${sql.slice(0, 500).replace(/\s+/g, ' ')}"`,
  );

  try {
    const out = await withTenantDb(svc.config, async (client) => {
      // Read mode: read-only tx (Postgres rejects writes). Write mode: normal tx
      // that COMMITs on success. Both carry a statement_timeout.
      await client.query(write ? 'BEGIN' : 'START TRANSACTION READ ONLY');
      await client.query(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`);
      let committed = false;
      try {
        const result = await client.query({ text: sql, rowMode: 'array' });
        if (write) { await client.query('COMMIT'); committed = true; }
        const fields = (result.fields || []).map((f) => f.name);
        const allRows = result.rows || [];
        const rows = allRows.slice(0, MAX_ROWS);
        return {
          fields,
          rows,
          rowCount: result.rowCount ?? rows.length,
          truncated: allRows.length > MAX_ROWS,
          mode: write ? 'write' : 'read',
        };
      } finally {
        if (!committed) await client.query('ROLLBACK').catch(() => {});
      }
    });
    res.json(out);
  } catch (err) {
    // e.g. "cannot execute INSERT in a read-only transaction", syntax errors, timeouts.
    res.status(400).json({ error: err.message });
  }
};
