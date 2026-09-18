'use strict';

/**
 * BaaS backups — SigV4 store signing, plan-tiered retention, key/expiry/target-name helpers,
 * and the runBackup / pruneExpired orchestration (with injected db/exec/store, no live cluster).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

process.env.BAAS_PG_ADMIN_URL = process.env.BAAS_PG_ADMIN_URL || 'postgresql://admin:pw@dbhost:5432/postgres';

const store = require('../src/services/backupStore');
const svc = require('../src/services/backupService');

test('SigV4 signing key matches the AWS documented vector', () => {
  const got = store._internal.signingKeyHex('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20120215', 'us-east-1', 'iam');
  assert.equal(got, 'f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d');
});

test('empty-payload sha256 + path encoding', () => {
  assert.equal(store._internal.EMPTY_SHA256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(store._internal.encodePath('a b/c.dump'), 'a%20b/c.dump'); // spaces encoded, "/" preserved
});

test('retention is plan-tiered: Pro/Max keep 30, Starter (and others) keep 7', () => {
  assert.equal(svc.retentionDaysForPlan('pro'), 30);
  assert.equal(svc.retentionDaysForPlan('max'), 30);
  assert.equal(svc.retentionDaysForPlan('starter'), 7);
  assert.equal(svc.retentionDaysForPlan('free'), 7);
});

test('objectKeyFor is deterministic, scoped, and filesystem-safe', () => {
  const d = new Date('2026-09-03T10:20:30.000Z');
  const k = svc.objectKeyFor(42, 'baas_p0123456789abcdef', d);
  assert.equal(k, 'project-42/baas_p0123456789abcdef/2026-09-03T10-20-30-000Z.dump');
  assert.ok(!/[:]/.test(k)); // no colons (bad object-key char)
});

test('expiresAt adds the retention window', () => {
  const now = new Date('2026-09-03T00:00:00.000Z');
  assert.equal(svc.expiresAt(now, 7).toISOString(), '2026-09-10T00:00:00.000Z');
});

test('targetDbNameFor is a valid identifier and rejects bad refs', () => {
  const d = new Date('2026-09-03T10:20:00.000Z');
  const name = svc.targetDbNameFor('p0123456789abcdef', d);
  assert.equal(name, 'baas_p0123456789abcdef_restore_202609031020');
  assert.equal(svc.isValidDbIdent(name), true);
  assert.throws(() => svc.targetDbNameFor('not-a-ref'), /invalid ref/);
});

test('isValidDbIdent guards against injection-y names', () => {
  assert.equal(svc.isValidDbIdent('baas_x'), true);
  assert.equal(svc.isValidDbIdent('DROP TABLE'), false);
  assert.equal(svc.isValidDbIdent('has-hyphen'), false);
  assert.equal(svc.isValidDbIdent('"quoted"'), false);
});

test('dbUrlFor swaps the database on the admin URL', () => {
  assert.equal(svc.dbUrlFor('baas_p0123456789abcdef'), 'postgresql://admin:pw@dbhost:5432/baas_p0123456789abcdef');
});

test('runBackup: insert running → pg_dump → upload → mark completed with key/size/expiry', async () => {
  const calls = [];
  const db = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (/INSERT INTO baas_backups/.test(sql)) return { rows: [{ id: 7 }] };
    return { rows: [] };
  } };
  // Fake pg_dump: write a dummy dump file at the path after "--file".
  const exec = async (_cmd, args) => {
    const i = args.indexOf('--file');
    fs.writeFileSync(args[i + 1], 'DUMPDATA');
  };
  let uploaded = null;
  const fakeStore = { putObjectFromFile: async (key, file) => { uploaded = { key, file }; return { key, size: 8 }; } };
  const now = new Date('2026-09-03T00:00:00.000Z');

  const id = await svc.runBackup(
    { projectId: 42, ref: 'p0123456789abcdef', plan: 'starter', kind: 'manual', userId: 5 },
    { db, exec, store: fakeStore, now }
  );
  assert.equal(id, 7);
  assert.ok(uploaded && /project-42\/baas_p0123456789abcdef\//.test(uploaded.key));
  const done = calls.find((c) => /UPDATE baas_backups SET status='completed'/.test(c.sql));
  assert.ok(done, 'marks completed');
  assert.equal(done.params[2], 8);                                        // size_bytes
  assert.equal(done.params[3].toISOString(), '2026-09-10T00:00:00.000Z'); // starter expiry = +7 days
});

test('runBackup: pro plan sets a 30-day expiry', async () => {
  const captured = {};
  const db = { query: async (sql, params) => {
    if (/INSERT INTO baas_backups/.test(sql)) return { rows: [{ id: 1 }] };
    if (/status='completed'/.test(sql)) captured.exp = params[3];
    return { rows: [] };
  } };
  const exec = async (_c, args) => fs.writeFileSync(args[args.indexOf('--file') + 1], 'X');
  const fakeStore = { putObjectFromFile: async (k) => ({ key: k, size: 1 }) };
  await svc.runBackup(
    { projectId: 1, ref: 'p0123456789abcdef', plan: 'pro' },
    { db, exec, store: fakeStore, now: new Date('2026-09-03T00:00:00.000Z') }
  );
  assert.equal(captured.exp.toISOString(), '2026-10-03T00:00:00.000Z'); // +30 days
});

test('runBackup: pg_dump failure marks the row failed and rethrows', async () => {
  const calls = [];
  const db = { query: async (sql) => { calls.push(sql); return /INSERT/.test(sql) ? { rows: [{ id: 9 }] } : { rows: [] }; } };
  const exec = async () => { throw new Error('pg_dump boom'); };
  await assert.rejects(
    svc.runBackup({ projectId: 1, ref: 'p0123456789abcdef', plan: 'starter' }, { db, exec, store: { putObjectFromFile: async () => {} } }),
    /boom/
  );
  assert.ok(calls.some((s) => /status='failed'/.test(s)), 'marks failed');
});

test('pruneExpired deletes objects then rows — and its query carries the newest-keep guard', async () => {
  const deleted = [];
  const removedRows = [];
  let selectSql = '';
  const db = { query: async (sql, params) => {
    if (/SELECT b\.id, b\.object_key FROM baas_backups b/.test(sql)) { selectSql = sql; return { rows: [{ id: 1, object_key: 'k1' }, { id: 2, object_key: 'k2' }] }; }
    if (/DELETE FROM baas_backups/.test(sql)) { removedRows.push(params[0]); return { rows: [] }; }
    return { rows: [] };
  } };
  const fakeStore = { deleteObject: async (k) => { deleted.push(k); } };
  const n = await svc.pruneExpired({ db, store: fakeStore, now: new Date() });
  assert.equal(n, 2);
  assert.deepEqual(deleted, ['k1', 'k2']);
  assert.deepEqual(removedRows, [1, 2]);
  // The guard (re-audit N1): a row is only prunable when a NEWER completed backup exists for
  // the same scope, so a silent dump-failure streak can never age out the last good copy.
  // IS NOT DISTINCT FROM keeps the guard working for control-plane rows (project_id NULL).
  assert.match(selectSql, /EXISTS/);
  assert.match(selectSql, /IS NOT DISTINCT FROM/);
  assert.match(selectSql, /n\.status = 'completed'/);
  assert.match(selectSql, /n\.started_at > b\.started_at/);
});

test('connFromUrl strips the password into PGPASSWORD (never on the command line)', () => {
  const conn = svc.connFromUrl('postgresql://admin:s3cr%40t@dbhost:5432/postgres', 'baas_p0123456789abcdef');
  assert.equal(conn.env.PGPASSWORD, 's3cr@t');           // decoded, via env
  assert.ok(!conn.dbname.includes('s3cr'), 'password must not appear in the --dbname argument');
  assert.match(conn.dbname, /^postgresql:\/\/admin@dbhost:5432\/baas_p0123456789abcdef$/);
});

test('runBackup passes the password via env, not argv', async () => {
  let seen = null;
  const db = { query: async (sql) => (/INSERT/.test(sql) ? { rows: [{ id: 3 }] } : { rows: [] }) };
  const exec = async (_cmd, args, opts) => {
    seen = { args, env: opts?.env };
    fs.writeFileSync(args[args.indexOf('--file') + 1], 'X');
  };
  await svc.runBackup(
    { projectId: 1, ref: 'p0123456789abcdef', plan: 'starter' },
    { db, exec, store: { putObjectFromFile: async () => ({}) }, now: new Date() }
  );
  assert.equal(seen.env.PGPASSWORD, 'pw');
  assert.ok(seen.args.every((a) => !String(a).includes(':pw@')), 'no password in argv');
});

test('controlPlaneConn resolves from DATABASE_URL, else DB_* vars', () => {
  const oldEnv = { ...process.env };
  try {
    process.env.DATABASE_URL = 'postgresql://cp:cppw@cphost:5432/rach';
    let c = svc.controlPlaneConn();
    assert.match(c.dbname, /cphost:5432\/rach$/);
    assert.equal(c.env.PGPASSWORD, 'cppw');

    delete process.env.DATABASE_URL;
    Object.assign(process.env, { DB_HOST: 'h2', DB_NAME: 'rach2', DB_USER: 'u2', DB_PASSWORD: 'p2', DB_PORT: '5433' });
    c = svc.controlPlaneConn();
    assert.match(c.dbname, /^postgresql:\/\/u2@h2:5433\/rach2$/);
    assert.equal(c.env.PGPASSWORD, 'p2');

    for (const k of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_PORT']) delete process.env[k];
    assert.equal(svc.controlPlaneConn(), null);
    assert.equal(svc.controlPlaneConfigured(), false);
  } finally {
    process.env = oldEnv;
  }
});

test('runControlPlaneBackup: NULL project row, control-plane key, completes with retention', async () => {
  const calls = [];
  const db = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (/INSERT INTO baas_backups/.test(sql)) {
      assert.match(sql, /VALUES \(NULL,'control_plane'/);
      return { rows: [{ id: 11 }] };
    }
    return { rows: [] };
  } };
  const exec = async (_c, args, opts) => {
    assert.equal(opts.env.PGPASSWORD, 'cppw'); // env, not argv
    fs.writeFileSync(args[args.indexOf('--file') + 1], 'CPDUMP');
  };
  let uploaded = null;
  const fakeStore = { putObjectFromFile: async (key) => { uploaded = key; } };
  const conn = { dbname: 'postgresql://cp@cphost:5432/rach', env: { PGPASSWORD: 'cppw' } };
  const id = await svc.runControlPlaneBackup({ db, exec, store: fakeStore, conn, now: new Date('2026-09-06T00:00:00.000Z') });
  assert.equal(id, 11);
  assert.match(uploaded, /^control-plane\/rach\//);
  const done = calls.find((c) => /status='completed'/.test(c.sql));
  assert.ok(done, 'marks completed');
  assert.equal(done.params[3].toISOString(), '2026-10-06T00:00:00.000Z'); // default 30-day retention
});

test('runControlPlaneBackup: dump failure marks the row failed and rethrows', async () => {
  const calls = [];
  const db = { query: async (sql) => { calls.push(sql); return /INSERT/.test(sql) ? { rows: [{ id: 12 }] } : { rows: [] }; } };
  const conn = { dbname: 'postgresql://cp@cphost:5432/rach', env: {} };
  await assert.rejects(
    svc.runControlPlaneBackup({ db, exec: async () => { throw new Error('cp dump boom'); }, store: {}, conn }),
    /boom/
  );
  assert.ok(calls.some((s) => /status='failed'/.test(s)));
});
