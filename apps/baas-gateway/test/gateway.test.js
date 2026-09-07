'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/gateway');
const baas = require('@rach/baas');

const REF = 'p0123456789abcdef';
const SECRET = baas.generateSecret();

test('matchRoute maps the four primitives and preserves the upstream path; else null', () => {
  assert.deepEqual(G.matchRoute('/rest/v1/todos'), { primitive: 'rest', upstreamPath: '/v1/todos' });
  assert.deepEqual(G.matchRoute('/auth/v1/signup'), { primitive: 'auth', upstreamPath: '/v1/signup' });
  assert.deepEqual(G.matchRoute('/storage'), { primitive: 'storage', upstreamPath: '/' });
  assert.equal(G.matchRoute('/nope/v1'), null);
  assert.equal(G.matchRoute('/'), null);
});

test('bearer reads Authorization: Bearer and the apikey header', () => {
  assert.equal(G.bearer({ authorization: 'Bearer abc.def' }), 'abc.def');
  assert.equal(G.bearer({ apikey: 'k123' }), 'k123');
  assert.equal(G.bearer({}), null);
});

test('classifyToken separates opaque API keys from JWTs', () => {
  assert.equal(G.classifyToken('rb_publishable_abc'), 'apikey');
  assert.equal(G.classifyToken('rb_secret_abc'), 'apikey');
  assert.equal(G.classifyToken(baas.mintAnonKey(SECRET, REF)), 'jwt');
});

test('authorizeRequest (JWT user tokens): valid pass; missing/invalid/wrong-project fail', async () => {
  const user = baas.mintUserToken(SECRET, REF, { sub: 'u1' });

  assert.equal((await G.authorizeRequest({ authorization: `Bearer ${user}` }, { secret: SECRET, ref: REF })).claims.sub, 'u1');

  assert.deepEqual(await G.authorizeRequest({}, { secret: SECRET, ref: REF }), { ok: false, status: 401, error: 'MISSING_KEY' });
  assert.equal((await G.authorizeRequest({ authorization: 'Bearer garbage.jwt.x' }, { secret: SECRET, ref: REF })).error, 'INVALID_KEY');
  // a user token from another project (different secret) is rejected
  const foreign = baas.mintUserToken(baas.generateSecret(), REF, { sub: 'u1' });
  assert.equal((await G.authorizeRequest({ authorization: `Bearer ${foreign}` }, { secret: SECRET, ref: REF })).error, 'INVALID_KEY');
  // a valid token but for a DIFFERENT ref is rejected
  const otherRef = baas.mintUserToken(SECRET, 'pdeadbeefdeadbeef', { sub: 'u1' });
  assert.equal((await G.authorizeRequest({ authorization: `Bearer ${otherRef}` }, { secret: SECRET, ref: REF })).error, 'INVALID_KEY');
});

test('authorizeRequest (opaque API keys): introspection decides validity + role', async () => {
  const pub = baas.apikeys.generateKey('publishable').key;
  const sec = baas.apikeys.generateKey('secret').key;
  // fake control-plane introspection: pub is valid→anon, everything else invalid.
  const introspect = async (ref, key) => (key === pub ? { valid: true, role: 'anon' } : { valid: false });

  assert.equal((await G.authorizeRequest({ apikey: pub }, { secret: SECRET, ref: REF, introspect })).claims.role, 'anon');
  assert.equal((await G.authorizeRequest({ apikey: sec }, { secret: SECRET, ref: REF, introspect })).error, 'INVALID_KEY');
  // no introspector configured → opaque keys can't be validated
  assert.equal((await G.authorizeRequest({ apikey: pub }, { secret: SECRET, ref: REF })).error, 'INVALID_KEY');
  // introspection endpoint down → 503, not a silent 401
  const down = async () => { throw new Error('econnrefused'); };
  const r = await G.authorizeRequest({ apikey: pub }, { secret: SECRET, ref: REF, introspect: down });
  assert.equal(r.status, 503); assert.equal(r.error, 'INTROSPECTION_UNAVAILABLE');
});

test('upstreamFor returns the configured base or null (unprovisioned → 503 upstream)', () => {
  const up = { rest: 'http://rest:3000', auth: null };
  assert.equal(G.upstreamFor('rest', up), 'http://rest:3000');
  assert.equal(G.upstreamFor('auth', up), null);
  assert.equal(G.upstreamFor('storage', up), null);
});
