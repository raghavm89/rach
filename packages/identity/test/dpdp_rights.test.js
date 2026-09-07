'use strict';

// DPDP data-principal rights for RachBase's own account holders:
//   • redactUserForExport (right to access)  — pure, strips secrets from a user row
//   • User.anonymize        (right to erasure) — anonymizes PII in place, stamps deleted_at
// These run without a live database: anonymize's SQL is exercised against a stubbed pool.query.

const test = require('node:test');
const assert = require('node:assert/strict');

const { redactUserForExport } = require('../src/controllers/userController');
const { User } = require('../src/models/user');
const pool = require('@rach/core').pool;

test('redactUserForExport keeps profile fields and drops every secret', () => {
  const row = {
    id: 42,
    name: 'Asha Rao',
    email: 'asha@example.com',
    phone_number: '+919812345678',
    gstin: '29ABCDE1234F1Z5',
    password_hash: '$2a$12$abcdef',
    otp: '123456',
    otp_hash: 'deadbeef',
    otp_expires: '2026-09-07T00:00:00Z',
    reset_token: 'secret-token',
  };
  const out = redactUserForExport(row);

  // Profile data survives.
  assert.equal(out.id, 42);
  assert.equal(out.name, 'Asha Rao');
  assert.equal(out.email, 'asha@example.com');
  assert.equal(out.gstin, '29ABCDE1234F1Z5');

  // Secrets are removed.
  for (const k of ['password_hash', 'password', 'otp', 'otp_hash', 'otp_expires', 'reset_token']) {
    assert.ok(!(k in out), `expected ${k} to be redacted`);
  }
});

test('redactUserForExport tolerates null/undefined input', () => {
  assert.deepEqual(redactUserForExport(null), {});
  assert.deepEqual(redactUserForExport(undefined), {});
});

test('User.anonymize anonymizes PII, stamps deleted_at, and only touches a live row', async () => {
  let captured = null;
  const orig = pool.query;
  pool.query = async (sql, params) => {
    captured = { sql, params };
    return { rows: [{ id: params[0], deleted_at: '2026-09-07T10:00:00Z' }] };
  };
  try {
    const res = await User.anonymize(7);

    assert.equal(res.id, 7);
    assert.ok(res.deleted_at);

    const sql = captured.sql.replace(/\s+/g, ' ');
    // Rewrites identity to a non-routable placeholder derived from the id.
    assert.equal(captured.params[1], 'deleted+7@rachbase.invalid');
    // Nulls the business/contact PII and stamps deletion.
    for (const frag of ["name = 'Deleted user'", 'phone_number = NULL', 'gstin = NULL', 'deleted_at = NOW()']) {
      assert.ok(sql.includes(frag), `expected SQL to include: ${frag}`);
    }
    // Idempotent: never re-anonymizes an already-erased row.
    assert.ok(sql.includes('deleted_at IS NULL'), 'expected guard on deleted_at IS NULL');
  } finally {
    pool.query = orig;
  }
});

test('User.anonymize returns null when the row is already erased', async () => {
  const orig = pool.query;
  pool.query = async () => ({ rows: [] });
  try {
    assert.equal(await User.anonymize(7), null);
  } finally {
    pool.query = orig;
  }
});
