'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mintUserToken } = require('@rach/baas');
const A = require('../src/auth');

const ctx = { ref: 'p0123456789abcdef', secret: 'x'.repeat(40) };
const tokenFor = (sub) => mintUserToken(ctx.secret, ctx.ref, { sub: String(sub) });

test('deleteSelf (erasure) deletes the authenticated user', async () => {
  let deleted = null;
  const db = { deleteUser: async (id) => { deleted = id; return true; } };
  const r = await A.deleteSelf(db, ctx, tokenFor(5));
  assert.equal(r.status, 200);
  assert.equal(r.body.deleted, 5);
  assert.equal(String(deleted), '5');
});

test('deleteSelf rejects an invalid/missing token (401)', async () => {
  const r = await A.deleteSelf({ deleteUser: async () => true }, ctx, 'garbage');
  assert.equal(r.status, 401);
});

test('exportSelf (access) returns the personal data Auth holds', async () => {
  const db = { findUserById: async (id) => ({ id: Number(id), email: 'a@b.c', email_confirmed: true, is_anonymous: false, created_at: '2024-01-01' }) };
  const r = await A.exportSelf(db, ctx, tokenFor(7));
  assert.equal(r.status, 200);
  assert.equal(r.body.user.email, 'a@b.c');
  assert.equal(r.body.user.id, 7);
  assert.ok(r.body.exported_at);
});

test('updateSelf (correction) updates email; rejects an invalid one', async () => {
  const db = { updateUser: async (id, { email }) => ({ id: Number(id), email, created_at: '2024' }) };
  const ok = await A.updateSelf(db, ctx, tokenFor(3), { email: 'new@b.c' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.email, 'new@b.c');
  const bad = await A.updateSelf(db, ctx, tokenFor(3), { email: 'not-an-email' });
  assert.equal(bad.status, 400);
});
