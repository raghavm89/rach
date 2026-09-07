'use strict';

/**
 * api facade — JWT verification, idempotency, and the tenant-PUT handler. Pure/unit
 * tests with a generated RSA key and injected deps (no cluster). This is the receiving
 * end that mirrors the BFF transport.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { verifyPartnerJwt } = require('../src/api/jwtVerify');
const { createIdempotencyStore } = require('../src/api/idempotency');
const { handleTenantPut } = require('../src/api/facade');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const AUD = 'spaceark-site-api:site1';
const ISS = 'https://issuer.rachbase.test';
const mint = (over = {}) => jwt.sign({}, privateKey, {
  algorithm: 'RS256', audience: over.aud || AUD, issuer: ISS, subject: 'rachbase-bff',
  jwtid: crypto.randomUUID(), expiresIn: over.exp || '5m',
});

test('verifyPartnerJwt: accepts valid; rejects wrong aud / expired / replay', () => {
  const seen = new Set();
  const claims = verifyPartnerJwt(mint(), { publicKey, issuers: [ISS], audience: AUD, seenJti: seen });
  assert.equal(claims.sub, 'rachbase-bff');

  assert.throws(() => verifyPartnerJwt(mint({ aud: 'spaceark-site-api:WRONG' }), { publicKey, issuers: [ISS], audience: AUD }));

  const expired = jwt.sign({}, privateKey, { algorithm: 'RS256', audience: AUD, issuer: ISS, jwtid: crypto.randomUUID(), expiresIn: -10 });
  assert.throws(() => verifyPartnerJwt(expired, { publicKey, issuers: [ISS], audience: AUD }));

  const t = mint();
  verifyPartnerJwt(t, { publicKey, issuers: [ISS], audience: AUD, seenJti: seen });      // first use ok
  assert.throws(() => verifyPartnerJwt(t, { publicKey, issuers: [ISS], audience: AUD, seenJti: seen })); // replay
});

test('idempotency store: new → replay → conflict', () => {
  const s = createIdempotencyStore();
  assert.equal(s.check('k', 'h1').status, 'new');
  s.put('k', 'h1', { ok: 1 });
  assert.equal(s.check('k', 'h1').status, 'replay');
  assert.equal(s.check('k', 'h2').status, 'conflict');
});

const deps = (extra = {}) => ({
  siteId: 'site1',
  verifyJwt: () => ({ sub: 'rachbase-bff' }),
  idempotency: createIdempotencyStore(),
  createClaim: async () => {},
  getOperation: async () => null,
  ...extra,
});
const req = (over = {}) => ({
  method: 'PUT', route: '/v1/tenants/t-abcd1234', tenantId: 't-abcd1234',
  headers: { authorization: 'Bearer x', 'idempotency-key': 'IK1' },
  body: { operationId: 'op-1', customerRef: 'c-1', plan: 'pro', generation: 1 },
  ...over,
});

test('handleTenantPut: 202 + creates the TenantClaim on a valid request', async () => {
  const created = [];
  const r = await handleTenantPut(req(), deps({ createClaim: async (c) => created.push(c) }));
  assert.equal(r.status, 202);
  assert.equal(r.body.state, 'ACCEPTED');
  assert.equal(r.body.statusUrl, '/v1/operations/op-1');
  assert.equal(created.length, 1);
  assert.equal(created[0].tenantId, 't-abcd1234');
});

test('handleTenantPut: 401 bad JWT, 400 bad DTO, 409 idempotency conflict, 202 replay', async () => {
  let r = await handleTenantPut(req(), deps({ verifyJwt: () => { throw new Error('bad'); } }));
  assert.equal(r.status, 401);

  r = await handleTenantPut(req({ body: { operationId: 'op-1', customerRef: 'c-1', plan: 'nope' } }), deps());
  assert.equal(r.status, 400);

  const d = deps();
  await handleTenantPut(req(), d);                                                        // store IK1 → hash(pro)
  r = await handleTenantPut(req({ body: { operationId: 'op-2', customerRef: 'c-1', plan: 'enterprise', generation: 1 } }), d); // same IK1, diff body
  assert.equal(r.status, 409);
  r = await handleTenantPut(req(), d);                                                     // same IK1, same body
  assert.equal(r.status, 202);
});
