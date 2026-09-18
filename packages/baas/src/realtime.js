'use strict';

/**
 * Realtime protocol — PURE helpers shared by the WS server and tested in isolation.
 *
 * Wire protocol (JSON over WebSocket):
 *   client → server: subscribe | unsubscribe | broadcast | presence | ping
 *   server → client: subscribed | error | postgres_changes | broadcast |
 *                     presence_state | presence_diff | pong
 *
 * "Postgres Changes" ride on LISTEN/NOTIFY: a table trigger emits a JSON payload on the
 * `rb_realtime` channel; the server parses it here and matches it against each subscription.
 */

const CLIENT_TYPES = new Set(['subscribe', 'unsubscribe', 'broadcast', 'presence', 'ping']);
const CHANGE_EVENTS = new Set(['INSERT', 'UPDATE', 'DELETE']);
const FILTER_OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'in']);
const NOTIFY_CHANNEL = 'rb_realtime';

// ── Client message parsing ─────────────────────────────────────────────────────
function parseClientMessage(raw) {
  let m;
  try { m = JSON.parse(raw); } catch { return { type: 'error', error: 'invalid_json' }; }
  if (!m || typeof m !== 'object' || !CLIENT_TYPES.has(m.type)) return { type: 'error', error: 'unknown_type' };
  if (m.type !== 'ping' && (!m.topic || typeof m.topic !== 'string')) return { type: 'error', error: 'topic_required' };
  return m;
}

// ── Filters ("column=op.value", PostgREST-ish) ─────────────────────────────────
function parseFilter(filter) {
  if (!filter || typeof filter !== 'string') return null;
  const m = /^([a-zA-Z_][a-zA-Z0-9_]*)=([a-z]+)\.(.*)$/.exec(filter);
  if (!m) return null;
  const [, column, op, value] = m;
  if (!FILTER_OPS.has(op)) return null;
  return { column, op, value };
}

function applyFilter(record, filter) {
  if (!filter) return true;
  if (!record || !(filter.column in record)) return false;
  const actual = record[filter.column];
  const want = filter.value;
  const bothNum = actual != null && want !== '' && !Number.isNaN(Number(actual)) && !Number.isNaN(Number(want));
  const a = bothNum ? Number(actual) : actual;
  const b = bothNum ? Number(want) : want;
  switch (filter.op) {
    case 'eq': return String(actual) === String(want);
    case 'neq': return String(actual) !== String(want);
    case 'gt': return a > b;
    case 'gte': return a >= b;
    case 'lt': return a < b;
    case 'lte': return a <= b;
    case 'like': return typeof actual === 'string' && new RegExp('^' + String(want).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$').test(actual);
    case 'in': return String(want).split(',').map((s) => s.trim()).includes(String(actual));
    default: return false;
  }
}

// ── NOTIFY payload → change object ──────────────────────────────────────────────
function parseNotifyPayload(raw) {
  let p;
  try { p = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  if (!p || !CHANGE_EVENTS.has(p.type) || !p.table) return null;
  return {
    schema: p.schema || 'public',
    table: p.table,
    type: p.type,
    record: p.record || null,
    old: p.old || null,
    truncated: Boolean(p.truncated),
  };
}

// ── Subscription matching ──────────────────────────────────────────────────────
// subConfig.postgres_changes = [{ event, schema?, table, filter? }]. Returns the matching
// binding (so the caller knows it matched) or null.
function changeMatchesSubscription(change, subConfig) {
  const bindings = (subConfig && Array.isArray(subConfig.postgres_changes)) ? subConfig.postgres_changes : [];
  const row = change.record || change.old;
  for (const b of bindings) {
    const eventOk = !b.event || b.event === '*' || b.event === change.type;
    const schemaOk = (b.schema || 'public') === change.schema;
    const tableOk = b.table === '*' || b.table === change.table;
    if (eventOk && schemaOk && tableOk && applyFilter(row, parseFilter(b.filter))) return b;
  }
  return null;
}

function buildChangeMessage(topic, change) {
  return {
    type: 'postgres_changes', topic,
    event: change.type, schema: change.schema, table: change.table,
    new: change.record || null, old: change.old || null,
    ...(change.truncated ? { truncated: true } : {}),
  };
}

// ── Presence ───────────────────────────────────────────────────────────────────
// prev/next are maps of presenceKey → state. Returns { joins, leaves } keyed maps.
function presenceDiff(prev = {}, next = {}) {
  const joins = {}, leaves = {};
  for (const k of Object.keys(next)) if (!(k in prev)) joins[k] = next[k];
  for (const k of Object.keys(prev)) if (!(k in next)) leaves[k] = prev[k];
  return { joins, leaves };
}

module.exports = {
  NOTIFY_CHANNEL, CHANGE_EVENTS, FILTER_OPS,
  parseClientMessage, parseFilter, applyFilter, parseNotifyPayload,
  changeMatchesSubscription, buildChangeMessage, presenceDiff,
};
