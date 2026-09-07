'use strict';

/**
 * Interop: the gateway's internal token (minted by @rach/baas) must be accepted — and the
 * spoofable x-baas-role header ignored — by the dependency-free verifier the baas-* services
 * ship (go-live audit M3). Mint with the real minting code, verify with the real verifier.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { mintInternalToken, generateSecret } = require('@rach/baas/src/keys');
const { verifyHs256, roleFromRequest } = require('../../baas-storage/src/internalToken');

const SECRET = generateSecret();
const REF = 'p0123456789abcdef';
const reqWith = (headers) => ({ headers });

test('a gateway-minted service token yields service_role — header is irrelevant', () => {
  const token = mintInternalToken(SECRET, REF, { role: `service_${REF}` });
  const req = reqWith({ authorization: `Bearer ${token}`, 'x-baas-role': 'anon' });
  assert.equal(roleFromRequest(req, { secret: SECRET, ref: REF }), 'service_role');
});

test('a spoofed x-baas-role header WITHOUT a valid token gets anon', () => {
  const req = reqWith({ 'x-baas-role': 'service_role' });
  assert.equal(roleFromRequest(req, { secret: SECRET, ref: REF }), 'anon');
});

test('a token signed with the WRONG secret gets anon (even with the header set)', () => {
  const token = mintInternalToken(generateSecret(), REF, { role: `service_${REF}` });
  const req = reqWith({ authorization: `Bearer ${token}`, 'x-baas-role': 'service_role' });
  assert.equal(roleFromRequest(req, { secret: SECRET, ref: REF }), 'anon');
});

test('a token for ANOTHER project (issuer mismatch) gets anon', () => {
  const token = mintInternalToken(SECRET, 'pfedcba9876543210', { role: 'service_pfedcba9876543210' });
  assert.equal(roleFromRequest(reqWith({ authorization: `Bearer ${token}` }), { secret: SECRET, ref: REF }), 'anon');
});

test('an EXPIRED token gets anon', () => {
  const token = mintInternalToken(SECRET, REF, { role: `service_${REF}`, ttlSec: -10 });
  assert.equal(roleFromRequest(reqWith({ authorization: `Bearer ${token}` }), { secret: SECRET, ref: REF }), 'anon');
});

test('authenticated + anon db-roles map back to their generic roles', () => {
  const authTok = mintInternalToken(SECRET, REF, { role: `authenticated_${REF}`, sub: '42' });
  assert.equal(roleFromRequest(reqWith({ authorization: `Bearer ${authTok}` }), { secret: SECRET, ref: REF }), 'authenticated');
  const anonTok = mintInternalToken(SECRET, REF, { role: `anon_${REF}` });
  assert.equal(roleFromRequest(reqWith({ authorization: `Bearer ${anonTok}` }), { secret: SECRET, ref: REF }), 'anon');
});

test('alg is pinned: an unsigned/none token never verifies', () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ role: `service_${REF}`, iss: REF })}.`;
  assert.equal(verifyHs256(SECRET, forged, { ref: REF }), null);
});

test('dev fallback: with NO secret configured, the header is honored (standalone only)', () => {
  assert.equal(roleFromRequest(reqWith({ 'x-baas-role': 'service_role' }), { secret: '', ref: '' }), 'service_role');
});
