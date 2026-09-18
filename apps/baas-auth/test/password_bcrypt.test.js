'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const A = require('../src/auth');

test('verifyPassword: native scrypt round-trip', () => {
  const h = A.hashPassword('secret123');
  assert.equal(A.verifyPassword('secret123', h), true);
  assert.equal(A.verifyPassword('wrong', h), false);
});

test('verifyPassword: migrated Supabase bcrypt hashes verify', () => {
  const h = bcrypt.hashSync('supapass', 8);
  assert.ok(A.isBcryptHash(h));
  assert.equal(A.verifyPassword('supapass', h), true);
  assert.equal(A.verifyPassword('nope', h), false);
});

test('login upgrades a bcrypt hash to scrypt on success (best-effort)', async () => {
  const bh = bcrypt.hashSync('supapass', 8);
  let upgraded = null;
  const db = {
    findUserByEmail: async () => ({ id: 1, email: 'a@b.c', password_hash: bh, email_confirmed: true }),
    setPasswordHash: async (id, h) => { upgraded = { id, h }; },
    insertRefresh: async () => {},
  };
  const ctx = { ref: 'p0123456789abcdef', secret: 'x'.repeat(40) };
  const r = await A.login(db, ctx, { email: 'a@b.c', password: 'supapass' });
  assert.equal(r.status, 200);
  assert.ok(r.body.access_token);
  assert.equal(upgraded.id, 1);
  assert.match(upgraded.h, /^scrypt\$/); // rehashed to native scrypt for next time
});

test('login with a wrong password on a bcrypt user fails and does not upgrade', async () => {
  const bh = bcrypt.hashSync('supapass', 8);
  let upgraded = false;
  const db = {
    findUserByEmail: async () => ({ id: 1, email: 'a@b.c', password_hash: bh, email_confirmed: true }),
    setPasswordHash: async () => { upgraded = true; },
    insertRefresh: async () => {},
  };
  const r = await A.login(db, { ref: 'p0123456789abcdef', secret: 'x'.repeat(40) }, { email: 'a@b.c', password: 'wrong' });
  assert.equal(r.status, 400);
  assert.equal(upgraded, false);
});
