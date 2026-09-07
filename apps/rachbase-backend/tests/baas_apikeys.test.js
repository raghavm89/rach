'use strict';

/**
 * BaaS opaque API keys — control-plane store (publishable + revocable secret keys) and the
 * gateway introspection path, exercised against pglite standing in for the control-plane DB.
 * We swap the shared @rach/core pool's `query` for a pglite-backed one (same object the Project
 * model captured at import), so the real SQL runs unchanged.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();

test('publishable + secret keys: create, list, revoke, introspect', { skip: !HAVE_PGLITE }, async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  const core = require('@rach/core');
  core.pool.query = (t, p) => (p === undefined ? db.query(t) : db.query(t, p));

  await db.query(`CREATE TABLE projects (id SERIAL PRIMARY KEY, ref TEXT UNIQUE)`);
  await db.query(`
    CREATE TABLE baas_api_keys (
      id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id),
      type TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'default',
      key_hash TEXT NOT NULL, key_public TEXT, last4 TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revoked_at TIMESTAMPTZ, last_used_at TIMESTAMPTZ)`);
  const { rows: pr } = await db.query(`INSERT INTO projects (ref) VALUES ('p0123456789abcdef') RETURNING id`);
  const projectId = pr[0].id;

  const { Project } = require('../src/models/project');

  // Publishable key: created once, idempotent, public plaintext is redisplayable.
  const pub = await Project.ensurePublishableKey(projectId);
  const pub2 = await Project.ensurePublishableKey(projectId);
  assert.equal(pub.id, pub2.id);                                  // idempotent
  assert.ok(pub.key_public.startsWith('rb_publishable_'));

  // Secret key: plaintext returned once; only last4 + hash persisted.
  const created = await Project.createSecretKey(projectId, 'server');
  assert.ok(created.key.startsWith('rb_secret_'));
  assert.equal(created.name, 'server');

  const list = await Project.listApiKeys(projectId);
  assert.equal(list.length, 2);
  const listedSecret = list.find((k) => k.type === 'secret');
  assert.equal(listedSecret.key, null);                           // never redisplayed
  assert.equal(listedSecret.last4, created.key.slice(-4));

  // Introspection: valid keys resolve to their role; the ref binds the key to its project.
  assert.deepEqual(
    await Project.introspectKey('p0123456789abcdef', pub.key_public),
    { valid: true, type: 'publishable', role: 'anon' });
  assert.deepEqual(
    await Project.introspectKey('p0123456789abcdef', created.key),
    { valid: true, type: 'secret', role: 'service_role' });
  assert.equal((await Project.introspectKey('p_wrong_ref', created.key)).valid, false);
  assert.equal((await Project.introspectKey('p0123456789abcdef', 'rb_secret_bogus')).valid, false);

  // Revoke: the secret stops validating; a garbage id is a no-op.
  assert.equal(await Project.revokeApiKey(projectId, created.id), true);
  assert.equal((await Project.introspectKey('p0123456789abcdef', created.key)).valid, false);
  assert.equal(await Project.revokeApiKey(projectId, 99999), false);
});
