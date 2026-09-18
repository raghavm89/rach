'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../src/policy');
const signed = require('../src/signedUrl');
const { makeStore } = require('../src/store');
const { filerObjectPath } = require('../index');

const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();
const SECRET = 'project-secret';

test('policy: service_role full; anon public-read only; authenticated read-private + write', () => {
  const pub = { visibility: 'public' }; const priv = { visibility: 'private' };
  assert.ok(policy.canRead('anon', pub) && !policy.canRead('anon', priv));       // anon: public read only
  assert.ok(!policy.canWrite('anon', pub));                                       // anon never writes
  assert.ok(policy.canRead('authenticated', priv) && policy.canWrite('authenticated', priv));
  assert.ok(policy.canDelete('service_role', priv) && !policy.canDelete('authenticated', priv));
  assert.ok(policy.canManageBuckets('service_role') && !policy.canManageBuckets('authenticated'));
});

test('signed URL round-trips and expires; tamper/expiry rejected', () => {
  const s = signed.sign(SECRET, { bucket: 'b', key: 'k/1.png', method: 'GET', ttlSec: 60, now: 1_000_000 });
  assert.ok(signed.verify(SECRET, { bucket: 'b', key: 'k/1.png', method: 'GET', exp: s.exp, sig: s.sig }, 1_000_000));
  assert.ok(!signed.verify(SECRET, { bucket: 'b', key: 'k/1.png', method: 'GET', exp: s.exp, sig: 'tampered' }, 1_000_000));
  assert.ok(!signed.verify(SECRET, { bucket: 'b', key: 'k/1.png', method: 'GET', exp: s.exp, sig: s.sig }, s.exp * 1000 + 1)); // expired
  assert.ok(!signed.verify('other-secret', { bucket: 'b', key: 'k/1.png', method: 'GET', exp: s.exp, sig: s.sig }, 1_000_000)); // wrong project
});

test('filer path is namespaced by project ref — two projects never collide on the shared filer', () => {
  // Same bucket + key, different project → different physical path (the isolation fix).
  const a = filerObjectPath('p0123456789abcdef', 'avatars', 'me.png');
  const b = filerObjectPath('pfedcba9876543210', 'avatars', 'me.png');
  assert.equal(a, '/buckets/p0123456789abcdef/avatars/me.png');
  assert.equal(b, '/buckets/pfedcba9876543210/avatars/me.png');
  assert.notEqual(a, b);
  // Deterministic for a given (ref,bucket,key).
  assert.equal(filerObjectPath('p0123456789abcdef', 'avatars', 'me.png'), a);
  // Standalone/dev (no ref) → single-tenant _local namespace, never the un-namespaced root.
  assert.equal(filerObjectPath('', 'avatars', 'me.png'), '/buckets/_local/avatars/me.png');
  assert.equal(filerObjectPath(null, 'avatars', 'me.png'), '/buckets/_local/avatars/me.png');
});

test('bucket store: create/get/list + name validation', { skip: !HAVE_PGLITE }, async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  const store = makeStore({ query: (t, p) => (p === undefined ? db.query(t) : db.query(t, p)) });
  await store.ensureSchema();
  const b = await store.createBucket('avatars', 'public');
  assert.equal(b.visibility, 'public');
  assert.equal((await store.getBucket('avatars')).visibility, 'public');
  await store.createBucket('avatars', 'private'); // upsert visibility
  assert.equal((await store.getBucket('avatars')).visibility, 'private');
  assert.equal((await store.listBuckets()).length, 1);
  await assert.rejects(() => store.createBucket('BAD NAME'), /invalid_bucket_name/);
});

// ── Signed-URL minting + filtered bucket listing (go-live audit #3 close-out) ─────────────

const http = require('http');
const crypto = require('crypto');
const { makeStorageHandler } = require('../index');

const REF = 'p0123456789abcdef';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// Minimal HS256 internal token, shaped like the gateway's (role = per-project db role, iss = ref).
function internalToken(secret, role) {
  const h = b64u({ alg: 'HS256', typ: 'JWT' });
  const p = b64u({ role, ref: REF, iss: REF, exp: Math.floor(Date.now() / 1000) + 120 });
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

async function withHandler(t, fn) {
  const buckets = { avatars: { name: 'avatars', visibility: 'private' }, pub: { name: 'pub', visibility: 'public' } };
  const store = {
    getBucket: async (n) => buckets[n] || null,
    listBuckets: async () => Object.values(buckets),
    createBucket: async () => { throw new Error('unused'); },
  };
  const server = http.createServer(makeStorageHandler({ ref: REF, secret: SECRET, store, filerUrl: null }));
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, path, { role, body } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(role ? { authorization: `Bearer ${internalToken(SECRET, `${role}_${REF}`)}` } : {}),
        'content-type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try { await fn(call); } finally { server.close(); }
}

test('signed-URL mint: role-gated, and the minted link actually verifies (the feature was verify-only before)', async (t) => {
  await withHandler(t, async (call) => {
    // service_role mints for a private bucket…
    const r = await call('POST', '/v1/sign/avatars/team/me.png', { role: 'service', body: { ttl_seconds: 600 } });
    assert.equal(r.status, 201);
    const out = await r.json();
    assert.match(out.path, /^\/storage\/v1\/object\/avatars\/team\/me\.png\?exp=\d+&sig=/);
    // …and the signature it minted passes the same verify the GET path enforces.
    assert.ok(signed.verify(SECRET, { bucket: 'avatars', key: 'team/me.png', method: 'GET', exp: out.exp, sig: decodeURIComponent(/sig=([^&]+)/.exec(out.path)[1]) }));
    // authenticated can mint too (they can read private)…
    assert.equal((await call('POST', '/v1/sign/avatars/x', { role: 'authenticated' })).status, 201);
    // …anon can NOT (no token, and even with an anon token) — the mint IS the sharing decision.
    assert.equal((await call('POST', '/v1/sign/avatars/x', {})).status, 403);
    assert.equal((await call('POST', '/v1/sign/avatars/x', { role: 'anon' })).status, 403);
    // unknown bucket → 404; garbage path → 400.
    assert.equal((await call('POST', '/v1/sign/nope/x', { role: 'service' })).status, 404);
    assert.equal((await call('POST', '/v1/sign/AVATARS!!/x', { role: 'service' })).status, 400);
  });
});

test('bucket listing is filtered by readability — anon no longer sees private bucket names', async (t) => {
  await withHandler(t, async (call) => {
    const anon = await (await call('GET', '/v1/bucket', {})).json();
    assert.deepEqual(anon.buckets.map((b) => b.name), ['pub']);            // private hidden from anon
    const svc = await (await call('GET', '/v1/bucket', { role: 'service' })).json();
    assert.deepEqual(svc.buckets.map((b) => b.name).sort(), ['avatars', 'pub']);
    const authed = await (await call('GET', '/v1/bucket', { role: 'authenticated' })).json();
    assert.deepEqual(authed.buckets.map((b) => b.name).sort(), ['avatars', 'pub']); // authenticated reads private
  });
});
