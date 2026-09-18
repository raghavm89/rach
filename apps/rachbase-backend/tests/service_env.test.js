'use strict';

/**
 * Per-service env + run command model (DB-backed, pglite).
 *
 * Mirrors the VM env path: values are encrypted at rest (keyCrypto AES-256-GCM), the
 * whole set is replaced on write, invalid/duplicate keys are dropped, is_secret only
 * affects the masked read. start_command is the run command (empty → NULL → image default).
 */

process.env.NODE_ENV = 'test';
process.env.RACHBASE_KEY_ENC_SECRET = process.env.RACHBASE_KEY_ENC_SECRET || 'test-secret-key-please-change-1234';

const test = require('node:test');
const assert = require('node:assert/strict');

const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();

const core = require('@rach/core');
const { Service } = require('../src/models/project');

let db;

test.before(async () => {
  if (!HAVE_PGLITE) return;
  const { PGlite } = await import('@electric-sql/pglite');
  db = new PGlite();
  await db.exec(`
    CREATE TABLE services (id INT PRIMARY KEY, start_command TEXT, updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE service_env (
      service_id INT NOT NULL, key TEXT NOT NULL, value_enc TEXT NOT NULL,
      is_secret BOOLEAN NOT NULL DEFAULT TRUE, PRIMARY KEY (service_id, key)
    );
    INSERT INTO services (id) VALUES (1);
  `);
  // Point the shared pool at pglite. setEnv uses a transaction, so patch connect() too.
  core.pool.query = (text, params) => (params === undefined ? db.query(text) : db.query(text, params));
  core.pool.connect = async () => ({
    query: (text, params) => (params === undefined ? db.query(text) : db.query(text, params)),
    release: () => {},
  });
});

test('setEnv → getEnv round-trips (encrypted at rest), drops invalid/duplicate keys', { skip: !HAVE_PGLITE }, async () => {
  const count = await Service.setEnv(1, [
    { key: 'API_URL', value: 'https://x', is_secret: false },
    { key: 'TOKEN', value: 'sekret' },              // is_secret defaults true
    { key: 'BAD KEY', value: 'nope' },              // invalid name → dropped
    { key: 'API_URL', value: 'dup' },               // duplicate → dropped
  ]);
  assert.equal(count, 2);

  // stored value is ciphertext, not plaintext
  const raw = await db.query('SELECT value_enc FROM service_env WHERE service_id=1 AND key=$1', ['TOKEN']);
  assert.ok(!raw.rows[0].value_enc.includes('sekret'));

  const env = await Service.getEnv(1);
  assert.deepEqual(env, [{ key: 'API_URL', value: 'https://x' }, { key: 'TOKEN', value: 'sekret' }]);

  const masked = await Service.getEnvMasked(1);
  assert.equal(masked.find((v) => v.key === 'TOKEN').is_secret, true);
  assert.equal(masked.find((v) => v.key === 'API_URL').is_secret, false);
});

test('setEnv replaces the whole set', { skip: !HAVE_PGLITE }, async () => {
  await Service.setEnv(1, [{ key: 'ONLY', value: '1' }]);
  const env = await Service.getEnv(1);
  assert.deepEqual(env.map((e) => e.key), ['ONLY']);
});

test('setStartCommand stores the run command; blank clears to NULL (image default)', { skip: !HAVE_PGLITE }, async () => {
  let s = await Service.setStartCommand(1, 'npm start');
  assert.equal(s.start_command, 'npm start');
  s = await Service.setStartCommand(1, '   ');
  assert.equal(s.start_command, null);
});
