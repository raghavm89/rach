'use strict';

/**
 * BaaS project foundation (Phase 3, slice 1) — DB-backed (pglite).
 * enableBaas provisions a stable ref + sealed per-project secret (idempotent); baasConfig
 * mints anon/service_role keys that verify against that secret and are project-scoped.
 */

process.env.NODE_ENV = 'test';
process.env.RACHBASE_KEY_ENC_SECRET = process.env.RACHBASE_KEY_ENC_SECRET || 'test-secret-key-please-change-1234';

const test = require('node:test');
const assert = require('node:assert/strict');

const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();

const core = require('@rach/core');
const keyCrypto = require('../src/services/keyCrypto');
const baas = require('@rach/baas');
const { Project } = require('../src/models/project');

let db;
test.before(async () => {
  if (!HAVE_PGLITE) return;
  const { PGlite } = await import('@electric-sql/pglite');
  db = new PGlite();
  await db.exec(`
    CREATE TABLE projects (
      id INT PRIMARY KEY, tenant_id INT, name TEXT, slug TEXT,
      ref TEXT UNIQUE, baas_enabled BOOLEAN NOT NULL DEFAULT FALSE, jwt_secret_enc TEXT,
      sign_priv_enc TEXT, sign_pub TEXT, sign_kid TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    INSERT INTO projects (id, tenant_id, name, slug) VALUES (1, 7, 'demo', 'demo');
  `);
  core.pool.query = (text, params) => (params === undefined ? db.query(text) : db.query(text, params));
});

test('enableBaas provisions ref + sealed secret and is idempotent', { skip: !HAVE_PGLITE }, async () => {
  const p1 = await Project.enableBaas(1);
  assert.equal(p1.baas_enabled, true);
  assert.match(p1.ref, /^p[0-9a-f]{16}$/);   // letter + 16 hex, DNS-safe
  assert.ok(p1.jwt_secret_enc && p1.jwt_secret_enc.includes(':')); // sealed blob
  assert.ok(!p1.jwt_secret_enc.includes(keyCrypto.open(p1.jwt_secret_enc))); // ciphertext ≠ plaintext

  // ES256 signing keypair is provisioned once and preserved on re-enable.
  assert.ok(p1.sign_priv_enc && p1.sign_pub && p1.sign_kid);
  assert.match(p1.sign_pub, /BEGIN PUBLIC KEY/);
  const kp = Project.signingKeypair(p1);
  assert.match(kp.privatePem, /BEGIN PRIVATE KEY/);
  const jwks = Project.jwksFor(p1);
  assert.equal(jwks.keys[0].kid, p1.sign_kid);

  const p2 = await Project.enableBaas(1);       // re-enable
  assert.equal(p2.ref, p1.ref);                 // ref preserved
  assert.equal(p2.jwt_secret_enc, p1.jwt_secret_enc); // secret preserved → existing keys stay valid
  assert.equal(p2.sign_priv_enc, p1.sign_priv_enc);   // signing keypair preserved too
  assert.equal(p2.sign_kid, p1.sign_kid);
});

test('baasConfig returns ref + url + keys that verify against the project secret', { skip: !HAVE_PGLITE }, async () => {
  const p = await Project.findByRef((await Project.enableBaas(1)).ref);
  const cfg = Project.baasConfig(p);
  assert.equal(cfg.ref, p.ref);
  assert.equal(cfg.url, `https://${p.ref}.rachbase.app`);

  const secret = keyCrypto.open(p.jwt_secret_enc);
  assert.equal(baas.verifyToken(secret, cfg.anon_key, { ref: p.ref }).role, 'anon');
  assert.equal(baas.verifyToken(secret, cfg.service_role_key, { ref: p.ref }).role, 'service_role');
  // wrong project ref rejected
  assert.throws(() => baas.verifyToken(secret, cfg.anon_key, { ref: 'pdeadbeef' }), /issuer/i);
});

test('baasConfig is null when BaaS is not enabled', { skip: !HAVE_PGLITE }, () => {
  assert.equal(Project.baasConfig({ baas_enabled: false }), null);
  assert.equal(Project.baasConfig({ baas_enabled: true, ref: 'p1' }), null); // no secret
});

test('countBaasEnabled + listBaas power the tenant overview; limits are per-plan', { skip: !HAVE_PGLITE }, async () => {
  const { limitFor } = require('../src/lib/baasLimits');
  assert.equal(limitFor('starter').projects, 1);
  assert.equal(limitFor('pro').projects, 3);
  assert.equal(limitFor('max').projects, 0);

  await Project.enableBaas(1);
  assert.equal(await Project.countBaasEnabled(7), 1);
  const list = await Project.listBaas(7);
  assert.equal(list.length, 1);
  assert.equal(list[0].baas_enabled, true);
  assert.match(list[0].url, /^https:\/\/p[0-9a-f]{16}\.rachbase\.app$/);
});
