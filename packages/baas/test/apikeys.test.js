'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/apikeys');

test('publishable/secret keys have the right prefixes and role mapping', () => {
  const pub = A.generateKey('publishable');
  const sec = A.generateKey('secret');
  assert.ok(pub.key.startsWith('rb_publishable_'));
  assert.ok(sec.key.startsWith('rb_secret_'));
  assert.equal(A.typeOfKey(pub.key), 'publishable');
  assert.equal(A.typeOfKey(sec.key), 'secret');
  assert.equal(A.roleForType('publishable'), 'anon');
  assert.equal(A.roleForType('secret'), 'service_role');
});

test('generated keys are unique, opaque (no claims), and carry a last4', () => {
  const a = A.generateKey('secret');
  const b = A.generateKey('secret');
  assert.notEqual(a.key, b.key);
  assert.equal(a.last4, a.key.slice(-4));
  // hash is deterministic and stored (never the raw key)
  assert.equal(a.hash, A.hashKey(a.key));
  assert.notEqual(a.hash, a.key);
});

test('keyMatchesHash validates a key against its stored hash (constant-time)', () => {
  const { key, hash } = A.generateKey('secret');
  assert.ok(A.keyMatchesHash(key, hash));
  assert.ok(!A.keyMatchesHash(key + 'x', hash));
  assert.ok(!A.keyMatchesHash('rb_secret_nope', hash));
});

test('unknown key shapes are rejected', () => {
  assert.equal(A.typeOfKey('sk_live_whatever'), null);
  assert.equal(A.typeOfKey(null), null);
  assert.equal(A.roleForType('bogus'), null);
  assert.throws(() => A.generateKey('bogus'));
});
