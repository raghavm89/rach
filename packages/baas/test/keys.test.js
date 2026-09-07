'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const K = require('../src/keys');

test('generateSecret is 256-bit base64url and unique', () => {
  const a = K.generateSecret();
  const b = K.generateSecret();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/); // 32 bytes → 43 base64url chars
});

test('anon/service keys are project-scoped, role-tagged, and long-lived (no exp)', () => {
  const secret = K.generateSecret();
  const anon = K.mintAnonKey(secret, 'proj123');
  const svc = K.mintServiceKey(secret, 'proj123');

  const a = K.verifyToken(secret, anon, { ref: 'proj123' });
  assert.equal(a.role, 'anon');
  assert.equal(a.iss, 'proj123');
  assert.equal(a.exp, undefined); // API keys don't expire (rotate the secret to revoke)

  const s = K.verifyToken(secret, svc, { ref: 'proj123' });
  assert.equal(s.role, 'service_role');
});

test('a key is bound to its project + secret (cross-use fails)', () => {
  const secret = K.generateSecret();
  const other = K.generateSecret();
  const anon = K.mintAnonKey(secret, 'projA');
  assert.throws(() => K.verifyToken(other, anon), /invalid signature/i);        // wrong secret
  assert.throws(() => K.verifyToken(secret, anon, { ref: 'projB' }), /jwt issuer/i); // wrong project
});

test('user token carries sub + authenticated role and expires', () => {
  const secret = K.generateSecret();
  const t = K.mintUserToken(secret, 'projX', { sub: 'user-1', ttlSec: 60 });
  const c = K.verifyToken(secret, t, { ref: 'projX' });
  assert.equal(c.sub, 'user-1');
  assert.equal(c.role, 'authenticated');
  assert.ok(c.exp > c.iat);
  // an expired token is rejected
  const expired = jwt.sign({ role: 'authenticated', ref: 'projX', sub: 'u' }, secret, { algorithm: 'HS256', issuer: 'projX', expiresIn: -10 });
  assert.throws(() => K.verifyToken(secret, expired, { ref: 'projX' }), /jwt expired/i);
});

test('required args are enforced', () => {
  assert.throws(() => K.mintAnonKey('', 'ref'));
  assert.throws(() => K.mintUserToken('s', 'ref', {}), /sub/);
});

test('dbRoleFor namespaces request roles per project; mintInternalToken carries the DB role', () => {
  assert.equal(K.dbRoleFor('anon', 'pabc'), 'anon_pabc');
  assert.equal(K.dbRoleFor('authenticated', 'pabc'), 'authenticated_pabc');
  assert.equal(K.dbRoleFor('service_role', 'pabc'), 'service_pabc');

  const secret = K.generateSecret();
  const tok = K.mintInternalToken(secret, 'pabc', { role: 'authenticated_pabc', sub: 'u1', claims: { email: 'a@b.com' } });
  const c = K.verifyToken(secret, tok, { ref: 'pabc' });
  assert.equal(c.role, 'authenticated_pabc');
  assert.equal(c.sub, 'u1');
  assert.equal(c.email, 'a@b.com');
  assert.ok(c.exp > c.iat);                       // internal tokens are short-lived
  assert.throws(() => K.mintInternalToken(secret, 'pabc', { role: '' }), /role required/);
});
