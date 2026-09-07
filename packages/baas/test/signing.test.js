'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/signing');

const REF = 'p0123456789abcdef';

test('generates an ES256 keypair with a public JWK + stable kid', () => {
  const kp = S.generateSigningKeypair();
  assert.match(kp.privatePem, /BEGIN PRIVATE KEY/);
  assert.match(kp.publicPem, /BEGIN PUBLIC KEY/);
  assert.equal(kp.jwk.kty, 'EC');
  assert.equal(kp.jwk.crv, 'P-256');
  assert.equal(kp.jwk.alg, 'ES256');
  assert.equal(kp.jwk.use, 'sig');
  assert.equal(kp.jwk.kid, kp.kid);
});

test('mint with the private key, verify with the public key (PEM and JWK)', () => {
  const kp = S.generateSigningKeypair();
  const token = S.mintUserTokenAsym(kp.privatePem, REF, { sub: 'user-1', ttlSec: 60, kid: kp.kid });

  const byPem = S.verifyTokenAsym(kp.publicPem, token, { ref: REF });
  assert.equal(byPem.sub, 'user-1');
  assert.equal(byPem.role, 'authenticated');

  const byJwk = S.verifyTokenAsym(kp.jwk, token, { ref: REF });
  assert.equal(byJwk.sub, 'user-1');
});

test('a token is bound to its keypair and project (cross-use fails)', () => {
  const kp = S.generateSigningKeypair();
  const other = S.generateSigningKeypair();
  const token = S.mintUserTokenAsym(kp.privatePem, REF, { sub: 'u' });
  assert.throws(() => S.verifyTokenAsym(other.publicPem, token, { ref: REF }));       // wrong key
  assert.throws(() => S.verifyTokenAsym(kp.publicPem, token, { ref: 'pOtherProject' })); // wrong project
});

test('jwks assembles a discovery document; required args enforced', () => {
  const a = S.generateSigningKeypair();
  const doc = S.jwks(a.jwk, null);
  assert.equal(doc.keys.length, 1);
  assert.equal(doc.keys[0].kid, a.kid);
  assert.throws(() => S.mintUserTokenAsym(a.privatePem, REF, {}), /sub/);
});
