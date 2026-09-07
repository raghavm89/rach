'use strict';

/**
 * Realtime enablement on a project's managed Postgres DB (LISTEN/NOTIFY path).
 *
 * A shared trigger function rb_realtime_notify() emits a compact JSON payload on the
 * `rb_realtime` channel for every INSERT/UPDATE/DELETE on a table that has been opted in.
 * Enabling realtime on a table attaches that trigger; the WS server LISTENs on the channel
 * and fans matching changes to subscribers.
 *
 * pg_notify has an ~8KB payload limit — the function truncates the row (keeps a compact form
 * + sets truncated=true) when the JSON would exceed a safe bound, so a large row never breaks
 * the notification.
 *
 * Connects to baas_<ref> on the managed cluster (BAAS_PG_ADMIN_URL, dbname swapped). `connect`
 * is injectable for tests.
 */

const { URL } = require('url');
const { realtime } = require('@rach/baas');
const baasDb = require('./baasDb');

const CHANNEL = realtime.NOTIFY_CHANNEL; // 'rb_realtime'
const TRIGGER_PREFIX = 'rb_realtime_';
const isValidIdent = (s) => /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(String(s || ''));

// The trigger function: build a payload, drop the row body if it's too big for NOTIFY.
const NOTIFY_FN_SQL = `
CREATE OR REPLACE FUNCTION public.rb_realtime_notify() RETURNS trigger AS $$
DECLARE
  payload json;
  rec json;
  old_json json;
BEGIN
  rec := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW) END;
  old_json := CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)
                   WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END;
  payload := json_build_object('schema', TG_TABLE_SCHEMA, 'table', TG_TABLE_NAME,
                               'type', TG_OP, 'record', rec, 'old', old_json);
  IF octet_length(payload::text) > 7500 THEN
    -- Too big for NOTIFY: send a truncated marker with primary-key-ish minimal info.
    payload := json_build_object('schema', TG_TABLE_SCHEMA, 'table', TG_TABLE_NAME,
                                 'type', TG_OP, 'record', NULL, 'old', NULL, 'truncated', true);
  END IF;
  PERFORM pg_notify('${CHANNEL}', payload::text);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Realtime is best-effort: a pg_notify failure (async queue full while the listener is
  -- stalled, etc.) must NEVER abort the customer's INSERT/UPDATE/DELETE (realtime audit #9).
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;`;

function dbUrlFor(ref) {
  if (!baasDb.dbName) throw new Error('baasDb unavailable');
  const u = new URL(process.env.BAAS_PG_ADMIN_URL);
  u.pathname = '/' + baasDb.dbName(ref);
  return u.toString();
}

async function withDb(ref, fn, { connect } = {}) {
  if (connect) return fn(await connect());
  const { Client } = require('pg');
  const c = new Client({ connectionString: dbUrlFor(ref) });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

// Postgres silently truncates identifiers at 63 bytes — two long-named tables could collide
// on the truncated trigger name, so disabling one would drop the other's trigger (realtime
// audit #10). Long combinations get a deterministic hash-suffixed name instead; short ones
// keep the readable form (and both start with the prefix listRealtimeTables matches on).
const crypto = require('crypto');
function triggerName(schema, table) {
  const plain = `${TRIGGER_PREFIX}${schema}_${table}`;
  if (plain.length <= 63) return plain;
  return `${TRIGGER_PREFIX}${crypto.createHash('sha256').update(`${schema}.${table}`).digest('hex').slice(0, 24)}`;
}

async function ensureFunction(client) {
  await client.query(NOTIFY_FN_SQL);
}

// Enable realtime on schema.table — creates the shared function (idempotent) + a row trigger.
async function enableTableRealtime(ref, table, schema = 'public', deps = {}) {
  if (!isValidIdent(table) || !isValidIdent(schema)) throw new Error('invalid table/schema');
  return withDb(ref, async (c) => {
    await ensureFunction(c);
    const tg = triggerName(schema, table);
    await c.query(`DROP TRIGGER IF EXISTS "${tg}" ON "${schema}"."${table}"`);
    await c.query(
      `CREATE TRIGGER "${tg}" AFTER INSERT OR UPDATE OR DELETE ON "${schema}"."${table}"
         FOR EACH ROW EXECUTE FUNCTION public.rb_realtime_notify()`
    );
    return { schema, table, enabled: true };
  }, deps);
}

async function disableTableRealtime(ref, table, schema = 'public', deps = {}) {
  if (!isValidIdent(table) || !isValidIdent(schema)) throw new Error('invalid table/schema');
  return withDb(ref, async (c) => {
    await c.query(`DROP TRIGGER IF EXISTS "${triggerName(schema, table)}" ON "${schema}"."${table}"`);
    return { schema, table, enabled: false };
  }, deps);
}

// List tables that currently have the realtime trigger attached.
async function listRealtimeTables(ref, deps = {}) {
  return withDb(ref, async (c) => {
    // Escape the prefix's underscores — `_` is a LIKE wildcard, so the raw prefix would also
    // match unrelated triggers named e.g. rbXrealtimeY… (realtime audit #10).
    const { rows } = await c.query(
      `SELECT event_object_schema AS schema, event_object_table AS table
         FROM information_schema.triggers
        WHERE trigger_name LIKE $1 ESCAPE '\\'
        GROUP BY 1,2 ORDER BY 1,2`, [TRIGGER_PREFIX.replace(/_/g, '\\_') + '%']
    );
    return rows;
  }, deps);
}

module.exports = {
  CHANNEL, isValidIdent, triggerName, dbUrlFor,
  enableTableRealtime, disableTableRealtime, listRealtimeTables,
  NOTIFY_FN_SQL,
};
