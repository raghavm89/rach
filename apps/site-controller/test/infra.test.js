'use strict';

/**
 * Infra-grade cores — informer resync/reconnect, leader-election decision, and the
 * durable idempotency store. Pure/injected; the k8s Watch/Lease/ConfigMap adapters
 * are exercised live on a cluster (user step).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { startInformer, RECONCILE_TYPES } = require('../src/cluster/informer');
const { evaluate, leaseSpec } = require('../src/cluster/leaderElection');
const { createDurableIdempotencyStore, memoryBackend } = require('../src/api/idempotency');

const tick = () => new Promise((r) => setImmediate(r));

// ── Informer ────────────────────────────────────────────────────────────────────
test('informer reconciles the initial list, then live ADDED/MODIFIED events (not DELETED)', async () => {
  const reconciled = [];
  const deleted = [];
  let emit;
  const stop = startInformer({
    connect: (onEvent) => { emit = onEvent; return () => {}; },
    listAll: async () => [{ id: 'seed' }],
    reconcileItem: async (o) => reconciled.push(o.id),
    onDelete: async (o) => deleted.push(o.id),
    resyncMs: 10_000,
  });
  await tick();
  assert.deepEqual(reconciled, ['seed']);           // initial catch-up

  await emit({ type: 'ADDED', object: { id: 'a' } });
  await emit({ type: 'MODIFIED', object: { id: 'b' } });
  await emit({ type: 'DELETED', object: { id: 'a' } });
  assert.deepEqual(reconciled, ['seed', 'a', 'b']);  // adds/mods reconcile
  assert.deepEqual(deleted, ['a']);                  // delete routed separately
  stop();
});

test('informer reconnects with backoff when the watch stream ends', async () => {
  let connects = 0;
  const timers = [];
  const stop = startInformer({
    connect: (_onEvent, onEnd) => { connects += 1; if (connects === 1) onEnd(); return () => {}; }, // first stream drops
    listAll: async () => [],
    reconcileItem: async () => {},
    setTimer: (fn) => { timers.push(fn); return timers.length; },
    clearTimer: () => {},
    resyncMs: 10_000,
  });
  await tick();
  assert.equal(connects, 1);
  timers.pop()();        // the reconnect is the most-recently scheduled timer (resync was queued first)
  await tick();
  assert.ok(connects >= 2, `expected a reconnect, got ${connects}`);
  stop();
});

test('RECONCILE_TYPES covers add + modify only', () => {
  assert.ok(RECONCILE_TYPES.has('ADDED') && RECONCILE_TYPES.has('MODIFIED'));
  assert.ok(!RECONCILE_TYPES.has('DELETED'));
});

// ── Leader election ───────────────────────────────────────────────────────────
test('evaluate: acquire when no lease or expired; renew own; standby for a live other', () => {
  const now = 1_000_000;
  const D = 15_000;
  assert.equal(evaluate(null, { now, identity: 'me', leaseDurationMs: D }).action, 'acquire');
  assert.equal(evaluate({ holderIdentity: 'me', renewTime: new Date(now - 1000).toISOString(), leaseDurationSeconds: 15 }, { now, identity: 'me' }).action, 'renew');
  assert.equal(evaluate({ holderIdentity: 'other', renewTime: new Date(now - 1000).toISOString(), leaseDurationSeconds: 15 }, { now, identity: 'me' }).action, 'standby');
  assert.equal(evaluate({ holderIdentity: 'other', renewTime: new Date(now - 20_000).toISOString(), leaseDurationSeconds: 15 }, { now, identity: 'me' }).action, 'acquire');
});

test('leaseSpec preserves acquireTime on renew and bumps transitions on takeover', () => {
  const now = 2_000_000;
  const prevSelf = { holderIdentity: 'me', acquireTime: 't0', leaseTransitions: 3 };
  const renew = leaseSpec(prevSelf, { now, identity: 'me', leaseDurationMs: 15_000 });
  assert.equal(renew.acquireTime, 't0');            // unchanged on self-renew
  assert.equal(renew.leaseTransitions, 3);
  const prevOther = { holderIdentity: 'other', acquireTime: 't0', leaseTransitions: 3 };
  const takeover = leaseSpec(prevOther, { now, identity: 'me', leaseDurationMs: 15_000 });
  assert.notEqual(takeover.acquireTime, 't0');      // reset on takeover
  assert.equal(takeover.leaseTransitions, 4);       // bumped
});

test('leaseSpec emits MicroTime (6 fractional digits) — k8s Lease rejects milliseconds', () => {
  const { microTime } = require('../src/cluster/leaderElection');
  // JS toISOString → 3 digits; MicroTime needs exactly 6, else the apiserver 400s.
  assert.match(microTime(1_756_312_503_685), /\.\d{6}Z$/);
  const s = leaseSpec(null, { now: 1_756_312_503_685, identity: 'me', leaseDurationMs: 15_000 });
  assert.match(s.renewTime, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
  assert.match(s.acquireTime, /\.\d{6}Z$/);
});

// ── Durable idempotency store ───────────────────────────────────────────────────
test('durable store: new → replay (same hash) → conflict (different hash)', async () => {
  const s = createDurableIdempotencyStore({ backend: memoryBackend() });
  assert.equal((await s.check('k', 'h1')).status, 'new');
  await s.put('k', 'h1', { ok: 1 });
  const replay = await s.check('k', 'h1');
  assert.equal(replay.status, 'replay');
  assert.deepEqual(replay.response, { ok: 1 });
  assert.equal((await s.check('k', 'h2')).status, 'conflict');
});

test('durable store: entries expire past TTL (treated as new)', async () => {
  let t = 1000;
  const s = createDurableIdempotencyStore({ backend: memoryBackend(), ttlMs: 100, now: () => t });
  await s.put('k', 'h1', { ok: 1 });
  assert.equal((await s.check('k', 'h1')).status, 'replay');
  t += 101; // past TTL
  assert.equal((await s.check('k', 'h1')).status, 'new');
});

test('durable store survives a simulated restart via a shared backend', async () => {
  const backend = memoryBackend();
  const a = createDurableIdempotencyStore({ backend });
  await a.put('k', 'h1', { ok: 1 });
  const b = createDurableIdempotencyStore({ backend }); // "new replica" on the same store
  assert.equal((await b.check('k', 'h1')).status, 'replay');
});
