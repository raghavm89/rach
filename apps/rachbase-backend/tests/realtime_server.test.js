'use strict';

/**
 * Realtime WS server — INTEGRATION tests over real WebSockets (the realtime audit found the
 * server had zero integration coverage, which is how a wiring bug that 400'd every handshake
 * shipped). Uses the same shared-upgrade-router pattern as server.js, a stubbed project
 * store (no control-plane DB), and a fake LISTEN client (no live Postgres).
 */

process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const WebSocket = require('ws');
const { WebSocketServer } = require('ws');
const baas = require('@rach/baas');
const realtimeServer = require('../src/services/realtimeServer');

const REF = 'p0123456789abcdef';
const KP = baas.signing.generateSigningKeypair();

// ── Harness ──────────────────────────────────────────────────────────────────────
let httpServer, port, terminalWss;

test.before(async () => {
  // Stub the control-plane lookups (no DB).
  realtimeServer._internal.db.findByRef = async (ref) =>
    ref === REF ? { ref: REF, baas_enabled: true, sign_pub: KP.publicPem, jwt_secret_enc: null } : null;
  realtimeServer._internal.db.introspectKey = async (ref, key) => {
    if (ref !== REF) return { valid: false };
    if (key === 'rb_secret_valid') return { valid: true, role: 'service_role', type: 'secret' };
    if (key === 'rb_publishable_valid') return { valid: true, role: 'anon', type: 'publishable' };
    return { valid: false };
  };
  // Fake LISTEN client: connect/query succeed instantly, no network.
  realtimeServer._internal.setClientFactory(() => ({
    connect: async () => {}, query: async () => {}, end: () => {}, on: () => {},
  }));

  // The EXACT topology server.js now uses: one HTTP server, one upgrade router, two
  // noServer WSS — the previous two-path-scoped-WSS wiring broke both features (finding #1).
  httpServer = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });
  terminalWss = new WebSocketServer({ noServer: true }); // stand-in for the terminal WSS
  terminalWss.on('connection', (ws) => ws.send('terminal-hello'));
  const realtimeWss = realtimeServer.attach();
  httpServer.on('upgrade', (req, socket, head) => {
    const path = (req.url || '').split('?')[0];
    const wss = path === '/ws/terminal' ? terminalWss : path === '/realtime/v1' ? realtimeWss : null;
    if (!wss) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); return socket.destroy(); }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));
  port = httpServer.address().port;
});

test.after(() => { realtimeServer.shutdown(); httpServer?.close(); });

const wsUrl = (token, ref = REF) => `ws://127.0.0.1:${port}/realtime/v1?ref=${ref}&token=${encodeURIComponent(token)}`;
const userToken = (sub = 'u1', extra = {}) => baas.signing.mintUserTokenAsym(KP.privatePem, REF, { sub, ...extra });

// Open a socket and collect messages; resolves with helpers.
function connect(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl(token));
    const inbox = [];
    const waiters = [];
    ws.on('message', (d) => {
      const msg = JSON.parse(d.toString());
      const i = waiters.findIndex((w) => w.pred(msg));
      if (i >= 0) waiters.splice(i, 1)[0].resolve(msg); else inbox.push(msg);
    });
    const next = (pred = () => true, ms = 3000) => {
      const j = inbox.findIndex(pred);
      if (j >= 0) return Promise.resolve(inbox.splice(j, 1)[0]);
      return new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('timeout waiting for message')), ms);
        waiters.push({ pred, resolve: (m) => { clearTimeout(t); res(m); } });
      });
    };
    ws.on('open', () => resolve({ ws, next, send: (o) => ws.send(JSON.stringify(o)) }));
    ws.on('error', reject);
  });
}
const closed = (ws) => new Promise((r) => ws.on('close', (code) => r(code)));

// ── The #1 regression: both WS features coexist on one server ────────────────────
test('realtime handshake COMPLETES and the terminal path still works beside it (audit #1)', async () => {
  const rt = await connect(userToken());
  assert.equal((await rt.next((m) => m.type === 'connected')).role, 'authenticated');

  const term = new WebSocket(`ws://127.0.0.1:${port}/ws/terminal`);
  const termMsg = await new Promise((res, rej) => { term.on('message', (d) => res(d.toString())); term.on('error', rej); });
  assert.equal(termMsg, 'terminal-hello'); // no RSV1/400 corruption from the realtime WSS

  const nowhere = new WebSocket(`ws://127.0.0.1:${port}/nope`);
  await new Promise((r) => nowhere.on('error', r)); // unknown path → clean refusal, not a hang

  rt.ws.close(); term.close();
});

// ── Auth matrix (audit #2) ───────────────────────────────────────────────────────
test('ES256 user tokens and opaque keys authenticate; garbage/expired/foreign are refused', async () => {
  // Opaque service key via introspection.
  const svc = await connect('rb_secret_valid');
  assert.equal((await svc.next((m) => m.type === 'connected')).role, 'service_role');
  svc.ws.close();
  // Opaque publishable key → anon.
  const anon = await connect('rb_publishable_valid');
  assert.equal((await anon.next((m) => m.type === 'connected')).role, 'anon');
  anon.ws.close();
  // Garbage, revoked-style opaque, expired ES256, wrong project → 1008.
  for (const bad of ['garbage', 'rb_secret_revoked', baas.signing.mintUserTokenAsym(KP.privatePem, REF, { sub: 'u9', ttlSec: -10 })]) {
    const ws = new WebSocket(wsUrl(bad));
    assert.equal(await closed(ws), 1008, `expected 1008 for ${bad.slice(0, 16)}`);
  }
  const foreign = new WebSocket(wsUrl(userToken(), 'pfedcba9876543210'));
  assert.equal(await closed(foreign), 1008);
});

// ── Changes: wildcard ban, anon ban, redaction (audit #3) ────────────────────────
test('table wildcard and anon changes are refused; `old` is redacted for non-service subscribers', async () => {
  const authed = await connect(userToken('u1'));
  await authed.next((m) => m.type === 'connected');
  const svc = await connect('rb_secret_valid');
  await svc.next((m) => m.type === 'connected');

  // Wildcard → refused.
  authed.send({ type: 'subscribe', topic: 'fire', config: { postgres_changes: [{ event: '*', table: '*' }] } });
  assert.equal((await authed.next((m) => m.type === 'error')).error, 'table_wildcard_not_allowed');

  // Anon (publishable key) may not subscribe to changes at all.
  const anon = await connect('rb_publishable_valid');
  await anon.next((m) => m.type === 'connected');
  anon.send({ type: 'subscribe', topic: 't', config: { postgres_changes: [{ event: '*', table: 'todos' }] } });
  assert.match((await anon.next((m) => m.type === 'error')).error, /authenticated/);
  anon.ws.close();

  // Both subscribe to a real table; a change fans out with `old` only for service_role.
  authed.send({ type: 'subscribe', topic: 'db', config: { postgres_changes: [{ event: '*', table: 'todos' }] } });
  await authed.next((m) => m.type === 'subscribed');
  svc.send({ type: 'subscribe', topic: 'db-admin', config: { postgres_changes: [{ event: '*', table: 'todos' }] } });
  await svc.next((m) => m.type === 'subscribed');

  realtimeServer._internal.onNotify(REF, JSON.stringify({
    schema: 'public', table: 'todos', type: 'UPDATE',
    record: { id: 1, title: 'new' }, old: { id: 1, title: 'SECRET-OLD' },
  }));
  const a = await authed.next((m) => m.type === 'postgres_changes');
  assert.equal(a.topic, 'db');
  assert.deepEqual(a.new, { id: 1, title: 'new' });
  assert.equal(a.old, null);                       // redacted for authenticated
  const s = await svc.next((m) => m.type === 'postgres_changes');
  assert.equal(s.topic, 'db-admin');
  assert.equal(s.old.title, 'SECRET-OLD');         // service_role sees old values
  authed.ws.close(); svc.ws.close();
});

// ── Broadcast + presence ownership (audit #6) ────────────────────────────────────
test('broadcast fans out to topic peers; presence keys are owned — no hijack, full cleanup on close', async () => {
  const a = await connect(userToken('ua'));
  await a.next((m) => m.type === 'connected');
  const b = await connect(userToken('ub'));
  await b.next((m) => m.type === 'connected');
  for (const c of [a, b]) { c.send({ type: 'subscribe', topic: 'room' }); await c.next((m) => m.type === 'subscribed'); }

  // Broadcast: b receives, a (sender) does not echo.
  a.send({ type: 'broadcast', topic: 'room', event: 'hi', payload: { x: 1 } });
  assert.deepEqual((await b.next((m) => m.type === 'broadcast')).payload, { x: 1 });

  // a tracks two keys; b cannot untrack or overwrite them.
  a.send({ type: 'presence', topic: 'room', event: 'track', key: 'k1', state: { n: 'A1' } });
  await b.next((m) => m.type === 'presence_diff' && m.joins.k1);
  a.send({ type: 'presence', topic: 'room', event: 'track', key: 'k2', state: { n: 'A2' } });
  await b.next((m) => m.type === 'presence_diff' && m.joins.k2);
  b.send({ type: 'presence', topic: 'room', event: 'untrack', key: 'k1' });
  assert.equal((await b.next((m) => m.type === 'error')).error, 'presence_key_taken');
  b.send({ type: 'presence', topic: 'room', event: 'track', key: 'k1', state: { hijack: true } });
  assert.equal((await b.next((m) => m.type === 'error')).error, 'presence_key_taken');

  // a disconnects → BOTH its keys leave (the old code leaked all but the last one).
  a.ws.close();
  const leaves = await b.next((m) => m.type === 'presence_diff' && Object.keys(m.leaves).length);
  assert.deepEqual(Object.keys(leaves.leaves).sort(), ['k1', 'k2']);
  b.ws.close();
});

// ── Subscription cap (audit #4, cheap-to-test slice) ─────────────────────────────
test('per-connection subscription cap is enforced', async () => {
  const c = await connect(userToken('uc'));
  await c.next((m) => m.type === 'connected');
  for (let i = 0; i < 100; i += 1) c.send({ type: 'subscribe', topic: `t${i}` });
  for (let i = 0; i < 100; i += 1) await c.next((m) => m.type === 'subscribed');
  c.send({ type: 'subscribe', topic: 'one-too-many' });
  assert.equal((await c.next((m) => m.type === 'error')).error, 'too_many_subscriptions');
  c.ws.close();
});
