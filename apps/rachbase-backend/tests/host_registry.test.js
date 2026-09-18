'use strict';

/**
 * Global claimed-hosts registry (go-live audit P0 #7). Runs against pglite so the ON CONFLICT
 * claim semantics are exercised for real. The key assertion: a hostname claimed in ONE namespace
 * (e.g. a container slug) cannot be re-claimed by ANOTHER (a VM auto-domain) — which is exactly the
 * cross-tenant takeover the old per-namespace unique indexes allowed.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();
const core = require('@rach/core');
const reg = require('../src/services/hostRegistry');

let db;

test.before(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  db = new PGlite();
  await db.exec(`
    CREATE TABLE claimed_hosts (
      hostname   TEXT PRIMARY KEY,
      tenant_id  INTEGER,
      kind       TEXT NOT NULL,
      ref        TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  core.pool.query = (t, p) => (p === undefined ? db.query(t) : db.query(t, p));
});

test.beforeEach(async () => { await db.query('DELETE FROM claimed_hosts'); });

test('a hostname claimed as a container cannot be re-claimed as a VM auto-domain (cross-namespace)', { skip: !HAVE_PGLITE }, async () => {
  const host = 'coolapp.rachbase.app';
  const a = await reg.claim({ hostname: host, tenantId: 1, kind: 'container', ref: 10 });
  assert.equal(a.claimed, true);

  // Attacker (tenant 2) tries to grab the same host as a VM auto-domain.
  const b = await reg.claim({ hostname: host, tenantId: 2, kind: 'vm_domain', ref: 99 });
  assert.equal(b.claimed, false);
  assert.equal(Number(b.owner.tenant_id), 1);
  assert.equal(b.owner.kind, 'container');
});

test('claim is idempotent for the SAME owner (redeploys / retries)', { skip: !HAVE_PGLITE }, async () => {
  const host = 'svc-7.rachbase.app';
  assert.equal((await reg.claim({ hostname: host, tenantId: 1, kind: 'container', ref: 7 })).claimed, true);
  assert.equal((await reg.claim({ hostname: host, tenantId: 1, kind: 'container', ref: 7 })).claimed, true); // same → still ours
  assert.equal((await reg.claim({ hostname: 'SVC-7.RACHBASE.APP', tenantId: 1, kind: 'container', ref: 7 })).claimed, true); // case-insensitive
});

test('release frees the name for another owner; releaseByRef frees all of a resource', { skip: !HAVE_PGLITE }, async () => {
  await reg.claim({ hostname: 'a.rachbase.app', tenantId: 1, kind: 'container', ref: 5 });
  await reg.claim({ hostname: 'custom.example.com', tenantId: 1, kind: 'custom', ref: 5 });

  await reg.release({ hostname: 'a.rachbase.app' });
  assert.equal((await reg.claim({ hostname: 'a.rachbase.app', tenantId: 2, kind: 'vm_domain', ref: 8 })).claimed, true); // now free

  const freed = await reg.releaseByRef({ kind: 'custom', ref: 5 });
  assert.equal(freed, 1);
  assert.equal((await reg.isAvailableFor('custom.example.com', 3)), true);
});

test('isAvailableFor: unclaimed → true; owned by same tenant → true; other tenant → false', { skip: !HAVE_PGLITE }, async () => {
  assert.equal(await reg.isAvailableFor('free.rachbase.app', 1), true);
  await reg.claim({ hostname: 'held.rachbase.app', tenantId: 1, kind: 'container', ref: 1 });
  assert.equal(await reg.isAvailableFor('held.rachbase.app', 1), true);
  assert.equal(await reg.isAvailableFor('held.rachbase.app', 2), false);
});

test('a legacy backfill row (NULL tenant) is adopted by the true owner on re-claim', { skip: !HAVE_PGLITE }, async () => {
  await db.query(`INSERT INTO claimed_hosts (hostname, tenant_id, kind, ref) VALUES ('legacy.rachbase.app', NULL, 'container', '42')`);
  const r = await reg.claim({ hostname: 'legacy.rachbase.app', tenantId: 9, kind: 'container', ref: 42 });
  assert.equal(r.claimed, true);
  const { rows } = await db.query(`SELECT tenant_id FROM claimed_hosts WHERE hostname = 'legacy.rachbase.app'`);
  assert.equal(Number(rows[0].tenant_id), 9);
});
