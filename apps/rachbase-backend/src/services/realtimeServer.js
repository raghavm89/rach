'use strict';

/**
 * Realtime WebSocket server (Supabase-style channels) at ws(s)://<host>/realtime/v1.
 *
 * Connect with ?ref=<project-ref>&token=<credential>. Accepted credentials (realtime audit
 * finding #2 — this used to accept ONLY legacy HS256 JWTs, rejecting every token the
 * dashboard and SDK actually send):
 *   • ES256 user session tokens (what baas-auth mints today) — verified with the project's
 *     stored public key, issuer-bound to the ref;
 *   • opaque API keys (rb_publishable_… / rb_secret_…) — introspected against the
 *     control-plane store (revocable, so signature-verification alone can't decide);
 *   • legacy HS256 anon/service JWTs — verified with the project secret (transition path).
 *
 * Channels:
 *   • postgres_changes — row INSERT/UPDATE/DELETE via LISTEN/NOTIFY (authenticated only;
 *     `table: '*'` is refused, and `old` values are redacted for non-service subscribers)
 *   • broadcast        — ephemeral pub/sub between clients on a topic
 *   • presence         — who's-online state per topic (keys are owned by the connection
 *     that tracked them; nobody can untrack or overwrite someone else's key)
 *
 * WIRING (audit finding #1): this WSS is `noServer` — it must be dispatched from ONE shared
 * `'upgrade'` router in server.js. Two path-scoped WSS on one HTTP server each try to handle
 * every upgrade in ws@8: realtime handshakes got a 400 from the terminal's WSS and the
 * terminal's accepted sockets were then corrupted by realtime's 400 — realtime had never
 * completed a handshake against the real topology.
 *
 * LIMITS (audit finding #4): payload, connection, subscription, and presence caps + a
 * bufferedAmount backpressure guard — this rides on the CONTROL-PLANE server, so one noisy
 * project must not be able to take the dashboard/API down for every tenant.
 *
 * SECURITY NOTE (v1): postgres_changes are NOT per-row RLS-filtered — a matching change is
 * delivered to every AUTHENTICATED subscriber of that table (anon connections never get
 * changes), with `old` values withheld unless the subscriber is service_role. Only enable
 * realtime on tables whose row changes are safe to share among the project's authenticated
 * clients. Per-subscriber RLS is a later hardening (needs the WAL/CDC path).
 */

const { WebSocketServer } = require('ws');
const { realtime, signing, apikeys, verifyToken } = require('@rach/baas');
const { Project } = require('../models/project');
const realtimeDb = require('./realtimeDb');

const HEARTBEAT_MS = 30 * 1000;
const MAX_PAYLOAD = Number(process.env.REALTIME_MAX_PAYLOAD_BYTES) || 64 * 1024; // ws default is 100 MiB(!)
const MAX_CONNS_TOTAL = Number(process.env.REALTIME_MAX_CONNS) || 2000;
const MAX_CONNS_PER_REF = Number(process.env.REALTIME_MAX_CONNS_PER_PROJECT) || 200;
const MAX_SUBS_PER_CONN = Number(process.env.REALTIME_MAX_SUBS_PER_CONN) || 100;
const MAX_LISTENERS = Number(process.env.REALTIME_MAX_LISTENERS) || 100; // concurrent LISTEN PG conns
const MAX_PRESENCE_KEYS_PER_CONN_TOPIC = 8;
const MAX_PRESENCE_KEY_LEN = 128;
const MAX_PRESENCE_STATE_BYTES = 8 * 1024;
const BUFFERED_DROP_BYTES = 1 * 1024 * 1024;      // slow consumer: drop fan-out messages
const BUFFERED_KILL_BYTES = 4 * 1024 * 1024;      // pathological: terminate the socket
const RECONNECT_MIN_MS = 1000, RECONNECT_MAX_MS = 30 * 1000;

// Per-ref LISTEN connections (shared across that project's connections).
const listeners = new Map();   // ref → { client, owners:Set(conn), connected, retryMs, timer, gone }
const connsByRef = new Map();  // ref → Set(conn)
const topics = new Map();      // tkey → Set(conn)  (broadcast/presence fanout)
const presence = new Map();    // tkey → Map(presenceKey → { state, owner:conn })

const tkey = (ref, topic) => `${ref} ${topic}`;

// Backpressure-aware send: never let one slow consumer buffer the process into the ground.
function send(ws, obj) {
  try {
    if (ws.bufferedAmount > BUFFERED_KILL_BYTES) return ws.terminate();
    if (ws.bufferedAmount > BUFFERED_DROP_BYTES) return; // drop for this consumer; others unaffected
    ws.send(JSON.stringify(obj));
  } catch { /* socket gone */ }
}

// ── Auth (injectable for tests via _internal.db) ────────────────────────────────
const db = {
  findByRef: (ref) => Project.findByRef(ref),
  introspectKey: (ref, key) => Project.introspectKey(ref, key),
};

async function authenticate(req) {
  const u = new URL(req.url, 'http://x');
  const ref = u.searchParams.get('ref');
  const token = u.searchParams.get('token') || u.searchParams.get('apikey');
  if (!ref || !token) return null;
  const project = await db.findByRef(ref);
  if (!project || !project.baas_enabled) return null;

  // Opaque API keys (the current key model) → control-plane introspection.
  if (apikeys.typeOfKey(token)) {
    try {
      const r = await db.introspectKey(ref, token);
      if (r && r.valid) return { ref, role: r.role || 'anon', exp: null };
    } catch { /* fall through to reject */ }
    return null;
  }
  // JWTs: ES256 user session tokens first (what auth mints), then legacy HS256.
  if (project.sign_pub) {
    try {
      const c = signing.verifyTokenAsym(project.sign_pub, token, { ref });
      return { ref, role: c.role || 'authenticated', exp: c.exp || null };
    } catch { /* not ES256 → try legacy */ }
  }
  const secret = Project.baasSecret(project);
  if (!secret) return null;
  try {
    const c = verifyToken(secret, token, { ref });
    return { ref, role: c.role || 'anon', exp: c.exp || null };
  } catch { return null; }
}

// ── LISTEN pool (audit finding #5: ownership by connection, reconnect w/ backoff) ─
// `makeClient` is injectable for tests (no live Postgres there).
let makeClient = (ref) => {
  const { Client } = require('pg');
  return new Client({ connectionString: realtimeDb.dbUrlFor(ref) });
};

async function connectListener(ref, entry) {
  const client = makeClient(ref);
  entry.client = client;
  client.on('notification', (msg) => onNotify(ref, msg.payload));
  client.on('error', (e) => {
    console.error(`[realtime] LISTEN error for ${ref}:`, e.message);
    entry.connected = false;
    try { client.end(); } catch { /* ignore */ }
    scheduleReconnect(ref, entry);
  });
  await client.connect();
  await client.query(`LISTEN ${realtimeDb.CHANNEL}`);
  entry.connected = true;
  entry.retryMs = RECONNECT_MIN_MS;
}

function scheduleReconnect(ref, entry) {
  if (entry.gone || entry.timer) return;
  entry.timer = setTimeout(async () => {
    entry.timer = null;
    if (entry.gone || !entry.owners.size) return teardownListener(ref);
    try {
      await connectListener(ref, entry);
      console.log(`[realtime] LISTEN reconnected for ${ref}`);
    } catch (e) {
      console.error(`[realtime] LISTEN reconnect failed for ${ref}:`, e.message);
      entry.retryMs = Math.min(entry.retryMs * 2, RECONNECT_MAX_MS);
      scheduleReconnect(ref, entry);
    }
  }, entry.retryMs);
  entry.timer.unref?.();
}

// Acquire for a CONNECTION (idempotent per conn — a Set, not a bare refcount, so the
// teardown/re-acquire interleavings that corrupted counts can't underflow). Awaited by the
// subscribe path so `subscribed` isn't acked before LISTEN is actually established.
async function acquireListener(ref, conn) {
  let entry = listeners.get(ref);
  if (!entry) {
    if (listeners.size >= MAX_LISTENERS) throw Object.assign(new Error('too many active projects'), { code: 'listener_cap' });
    entry = { client: null, owners: new Set(), connected: false, retryMs: RECONNECT_MIN_MS, timer: null, gone: false };
    listeners.set(ref, entry);
  }
  entry.owners.add(conn);
  if (entry.connected) return;
  try {
    await connectListener(ref, entry);
  } catch (e) {
    console.error(`[realtime] could not LISTEN for ${ref}:`, e.message);
    scheduleReconnect(ref, entry); // keep trying while owners remain — self-healing
    throw Object.assign(new Error('changes temporarily unavailable'), { code: 'listen_failed' });
  }
}

function releaseListener(ref, conn) {
  const e = listeners.get(ref);
  if (!e) return;
  e.owners.delete(conn);
  if (!e.owners.size) teardownListener(ref);
}

function teardownListener(ref) {
  const e = listeners.get(ref);
  if (!e) return;
  e.gone = true;
  if (e.timer) { clearTimeout(e.timer); e.timer = null; }
  listeners.delete(ref);
  try { if (e.client) e.client.end(); } catch { /* ignore */ }
}

function onNotify(ref, payloadStr) {
  const change = realtime.parseNotifyPayload(payloadStr);
  if (!change) return;
  const conns = connsByRef.get(ref);
  if (!conns) return;
  // Redaction (audit finding #3, minimal v1): `old` row values go only to service_role —
  // for everyone else an UPDATE's previous values are withheld.
  let full = null, redacted = null;
  for (const conn of conns) {
    if (conn.role === 'anon') continue; // changes require an authenticated subscriber
    for (const [topic, config] of conn.subs) {
      if (!realtime.changeMatchesSubscription(change, config)) continue;
      if (conn.role === 'service_role') {
        if (!full) full = realtime.buildChangeMessage(topic, change);
        send(conn.ws, { ...full, topic });
      } else {
        if (!redacted) redacted = realtime.buildChangeMessage(topic, { ...change, old: null });
        send(conn.ws, { ...redacted, topic });
      }
    }
  }
}

// ── Topic membership (broadcast/presence) ──────────────────────────────────────
function joinTopic(conn, topic) {
  const k = tkey(conn.ref, topic);
  if (!topics.has(k)) topics.set(k, new Set());
  topics.get(k).add(conn);
}

// Remove ALL of this connection's presence keys on a topic (audit finding #6: the old code
// remembered only the LAST key, orphaning earlier ones in the shared map forever).
function dropPresence(conn, topic) {
  const k = tkey(conn.ref, topic);
  const keys = conn.presence.get(topic);
  const pmap = presence.get(k);
  if (keys && pmap) {
    const leaves = {};
    for (const pkey of keys) {
      const entry = pmap.get(pkey);
      if (entry && entry.owner === conn) { leaves[pkey] = entry.state; pmap.delete(pkey); }
    }
    if (Object.keys(leaves).length) fanout(conn.ref, topic, { type: 'presence_diff', topic, joins: {}, leaves });
    if (!pmap.size) presence.delete(k);
  }
  conn.presence.delete(topic);
}

function leaveTopic(conn, topic) {
  const k = tkey(conn.ref, topic);
  const set = topics.get(k);
  if (set) { set.delete(conn); if (!set.size) topics.delete(k); }
  dropPresence(conn, topic);
}

function fanout(ref, topic, msg, except = null) {
  const set = topics.get(tkey(ref, topic));
  if (!set) return;
  for (const conn of set) if (conn !== except) send(conn.ws, msg);
}

const presenceState = (k) => {
  const pmap = presence.get(k);
  if (!pmap || !pmap.size) return null;
  return Object.fromEntries(Array.from(pmap, ([pk, e]) => [pk, e.state]));
};

// ── Message handling ────────────────────────────────────────────────────────────
async function handle(conn, raw) {
  const m = realtime.parseClientMessage(raw);
  if (m.type === 'error') return send(conn.ws, m);
  switch (m.type) {
    case 'ping': return send(conn.ws, { type: 'pong' });
    case 'subscribe': {
      if (conn.subs.size >= MAX_SUBS_PER_CONN && !conn.subs.has(m.topic)) {
        return send(conn.ws, { type: 'error', topic: m.topic, error: 'too_many_subscriptions' });
      }
      const config = (m.config && typeof m.config === 'object') ? m.config : {};
      const bindings = Array.isArray(config.postgres_changes) ? config.postgres_changes : [];
      const wantsChanges = bindings.length > 0;
      if (wantsChanges && conn.role === 'anon') {
        return send(conn.ws, { type: 'error', topic: m.topic, error: 'postgres_changes require an authenticated token' });
      }
      // A table wildcard turns one subscription into a firehose of EVERY enabled table —
      // refused outright (audit finding #3). Subscribe per table.
      if (bindings.some((b) => b && (b.table === '*' || b.table == null))) {
        return send(conn.ws, { type: 'error', topic: m.topic, error: 'table_wildcard_not_allowed' });
      }
      conn.subs.set(m.topic, config);
      joinTopic(conn, m.topic);
      if (wantsChanges) {
        conn.usesChanges.add(m.topic);
        try {
          await acquireListener(conn.ref, conn); // awaited: no `subscribed` ack before LISTEN is up
        } catch (e) {
          // Still subscribed for broadcast/presence; changes will self-heal via reconnect.
          send(conn.ws, { type: 'error', topic: m.topic, error: e.code || 'listen_failed', retrying: e.code !== 'listener_cap' });
        }
      }
      send(conn.ws, { type: 'subscribed', topic: m.topic });
      const state = presenceState(tkey(conn.ref, m.topic));
      if (state) send(conn.ws, { type: 'presence_state', topic: m.topic, state });
      return;
    }
    case 'unsubscribe': {
      if (conn.subs.has(m.topic)) {
        conn.subs.delete(m.topic);
        if (conn.usesChanges.delete(m.topic) && !conn.usesChanges.size) releaseListener(conn.ref, conn);
        leaveTopic(conn, m.topic);
      }
      return send(conn.ws, { type: 'unsubscribed', topic: m.topic });
    }
    case 'broadcast': {
      if (!conn.subs.has(m.topic)) return send(conn.ws, { type: 'error', topic: m.topic, error: 'not_subscribed' });
      return fanout(conn.ref, m.topic, { type: 'broadcast', topic: m.topic, event: m.event, payload: m.payload }, conn);
    }
    case 'presence': {
      if (!conn.subs.has(m.topic)) return send(conn.ws, { type: 'error', topic: m.topic, error: 'not_subscribed' });
      const k = tkey(conn.ref, m.topic);
      const pkey = String(m.key || conn.id);
      if (pkey.length > MAX_PRESENCE_KEY_LEN) return send(conn.ws, { type: 'error', topic: m.topic, error: 'presence_key_too_long' });
      if (!presence.has(k)) presence.set(k, new Map());
      const pmap = presence.get(k);
      const existing = pmap.get(pkey);
      // Presence keys are OWNED by the connection that tracked them (audit finding #6):
      // nobody can overwrite or untrack another connection's entry.
      if (existing && existing.owner !== conn) {
        return send(conn.ws, { type: 'error', topic: m.topic, error: 'presence_key_taken' });
      }
      if (m.event === 'untrack') {
        if (existing) {
          pmap.delete(pkey);
          conn.presence.get(m.topic)?.delete(pkey);
          fanout(conn.ref, m.topic, { type: 'presence_diff', topic: m.topic, joins: {}, leaves: { [pkey]: existing.state } });
          if (!pmap.size) presence.delete(k);
        }
      } else { // track / update
        const state = m.state || {};
        try { if (JSON.stringify(state).length > MAX_PRESENCE_STATE_BYTES) throw new Error('big'); }
        catch { return send(conn.ws, { type: 'error', topic: m.topic, error: 'presence_state_too_large' }); }
        let keys = conn.presence.get(m.topic);
        if (!keys) conn.presence.set(m.topic, (keys = new Set()));
        if (!keys.has(pkey) && keys.size >= MAX_PRESENCE_KEYS_PER_CONN_TOPIC) {
          return send(conn.ws, { type: 'error', topic: m.topic, error: 'too_many_presence_keys' });
        }
        keys.add(pkey);
        pmap.set(pkey, { state, owner: conn });
        fanout(conn.ref, m.topic, { type: 'presence_diff', topic: m.topic, joins: { [pkey]: state }, leaves: {} });
      }
      return;
    }
    default: return send(conn.ws, { type: 'error', error: 'unhandled' });
  }
}

function cleanup(conn) {
  for (const topic of Array.from(conn.subs.keys())) leaveTopic(conn, topic);
  conn.subs.clear();
  if (conn.usesChanges.size) { conn.usesChanges.clear(); releaseListener(conn.ref, conn); }
  const set = connsByRef.get(conn.ref);
  if (set) { set.delete(conn); if (!set.size) connsByRef.delete(conn.ref); }
}

let totalConns = 0;
let idc = 0;
let wssRef = null;

/**
 * Create the realtime WSS. `noServer` — server.js owns the single 'upgrade' router that
 * dispatches /realtime/v1 here and /ws/terminal to the terminal WSS (audit finding #1:
 * two path-scoped WSS on one server break each other in ws@8).
 */
function attach() {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
  wssRef = wss;
  wss.on('connection', async (ws, req) => {
    ws._rbAlive = true;
    ws.on('pong', () => { ws._rbAlive = true; });

    const auth = await authenticate(req).catch(() => null);
    if (!auth) { send(ws, { type: 'error', error: 'unauthorized' }); return ws.close(1008, 'unauthorized'); }
    // Connection caps — this WSS shares the control-plane process with the dashboard/API.
    const refConns = connsByRef.get(auth.ref)?.size || 0;
    if (totalConns >= MAX_CONNS_TOTAL || refConns >= MAX_CONNS_PER_REF) {
      send(ws, { type: 'error', error: 'too_many_connections' });
      return ws.close(1013, 'try again later');
    }

    const conn = {
      id: `c${++idc}`, ws, ref: auth.ref, role: auth.role,
      exp: auth.exp || null, // epoch seconds; enforced by the heartbeat sweep
      subs: new Map(), usesChanges: new Set(), presence: new Map(),
    };
    totalConns += 1;
    if (!connsByRef.has(auth.ref)) connsByRef.set(auth.ref, new Set());
    connsByRef.get(auth.ref).add(conn);
    send(ws, { type: 'connected', role: auth.role });
    ws.on('message', (data) => { handle(conn, data.toString()).catch((e) => send(ws, { type: 'error', error: e.message })); });
    ws.on('close', () => { totalConns -= 1; cleanup(conn); });
    ws.on('error', () => { /* 'close' always follows; cleanup happens there */ });
    ws._rbConn = conn;
  });

  const hb = setInterval(() => {
    const nowSec = Date.now() / 1000;
    wss.clients.forEach((ws) => {
      if (ws.readyState !== ws.OPEN) return;
      // Token expiry is enforced for the LIFETIME of the connection, not just at upgrade
      // (audit finding #7): an expired credential stops streaming within one sweep.
      if (ws._rbConn?.exp && nowSec >= ws._rbConn.exp) return ws.close(1008, 'token_expired');
      if (ws._rbAlive === false) return ws.terminate();
      ws._rbAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_MS);
  hb.unref?.();
  wss.on('close', () => clearInterval(hb));

  console.log('[realtime] WS server ready for /realtime/v1 (routed via the shared upgrade handler)');
  return wss;
}

/** Close every connection + the LISTEN client for one project (suspension/deletion). */
function closeProject(ref) {
  const set = connsByRef.get(ref);
  if (set) for (const conn of Array.from(set)) { try { conn.ws.close(1001, 'project_unavailable'); } catch { /* ignore */ } }
  teardownListener(ref);
}

/** Graceful shutdown: close all sockets and LISTEN clients (audit finding #7). */
function shutdown() {
  if (wssRef) { for (const ws of wssRef.clients) { try { ws.close(1001, 'server_shutdown'); } catch { /* ignore */ } } try { wssRef.close(); } catch { /* ignore */ } }
  for (const ref of Array.from(listeners.keys())) teardownListener(ref);
}

module.exports = {
  attach, closeProject, shutdown,
  _internal: {
    onNotify, handle, listeners, connsByRef, topics, presence, db,
    setClientFactory: (fn) => { makeClient = fn; },
  },
};
