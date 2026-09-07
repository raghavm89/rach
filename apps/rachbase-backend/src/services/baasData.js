'use strict';

/**
 * BaaS Data console (Phase 3) — runs SQL against a PROJECT's own database (the isolated DB
 * provisioned by baasDb), for the dashboard SQL editor + table browser. Connects with a
 * short-lived client using the project's connection string; `connect` is injectable for tests.
 *
 * This is the tenant operating their OWN database (like Supabase's SQL editor) — full SQL is
 * intentional. It does NOT touch the RachBase control-plane DB.
 */

async function withClient({ databaseUrl }, { connect } = {}, fn) {
  if (connect) return fn(await connect());
  const { Client } = require('pg');
  const c = new Client({ connectionString: databaseUrl, statement_timeout: 15000 });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

async function runQuery({ databaseUrl, sql }, opts = {}) {
  if (!sql || !String(sql).trim()) throw new Error('empty_sql');
  return withClient({ databaseUrl }, opts, async (c) => {
    const r = await c.query(sql);
    const res = Array.isArray(r) ? r[r.length - 1] : r; // multi-statement → last result
    return { fields: (res.fields || []).map((f) => f.name), rows: res.rows || [], rowCount: res.rowCount ?? (res.rows ? res.rows.length : 0) };
  });
}

async function listTables({ databaseUrl }, opts = {}) {
  return withClient({ databaseUrl }, opts, async (c) => {
    const { rows } = await c.query(`
      SELECT table_schema, table_name,
             (SELECT COUNT(*) FROM information_schema.columns col WHERE col.table_schema = t.table_schema AND col.table_name = t.table_name)::int AS columns
        FROM information_schema.tables t
       WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')
       ORDER BY table_schema, table_name`);
    return { tables: rows };
  });
}

module.exports = { runQuery, listTables };
