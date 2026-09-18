'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BAAS_PG_ADMIN_URL = process.env.BAAS_PG_ADMIN_URL || 'postgresql://admin:pw@host:5432/postgres';
const M = require('../src/services/supabaseMigrate');

test('buildDumpArgs dumps only the public schema, no owner/privileges', () => {
  const d = M.buildDumpArgs('postgresql://src', '/tmp/x.dump');
  assert.ok(d.includes('--schema') && d.includes('public'));
  assert.ok(d.includes('--no-owner') && d.includes('--no-privileges'));
  assert.equal(d[d.indexOf('--file') + 1], '/tmp/x.dump');
});

test('buildRestoreArgs restores leniently (no --exit-on-error)', () => {
  const r = M.buildRestoreArgs('postgresql://tgt', '/tmp/x.dump');
  assert.ok(r.includes('--dbname') && r.includes('postgresql://tgt'));
  assert.ok(!r.includes('--exit-on-error'));
});

test('isBcryptHash detects Supabase hashes, not RachBase scrypt', () => {
  assert.equal(M.isBcryptHash('$2a$10$abc'), true);
  assert.equal(M.isBcryptHash('$2b$12$abc'), true);
  assert.equal(M.isBcryptHash('$2y$10$abc'), true);
  assert.equal(M.isBcryptHash('scrypt$salt$hash'), false);
});

test('supabaseUserToRow maps fields + email_confirmed from timestamp', () => {
  assert.deepEqual(M.supabaseUserToRow({ email: 'a@b.c', encrypted_password: '$2a$10$h', email_confirmed_at: '2024-01-01' }),
    { email: 'a@b.c', password_hash: '$2a$10$h', email_confirmed: true });
  assert.equal(M.supabaseUserToRow({ email: 'x', encrypted_password: null, email_confirmed_at: null }).email_confirmed, false);
});

test('dbUrlFor targets baas_<ref> on the managed cluster', () => {
  assert.equal(M.dbUrlFor('p0123456789abcdef'), 'postgresql://admin:pw@host:5432/baas_p0123456789abcdef');
});

test('migrateUsers: source auth.users → target auth_users, ON CONFLICT skips dupes', async () => {
  const inserts = [];
  const connect = async (url) => {
    if (url.includes('baas_')) { // target
      return { query: async (_sql, params) => { inserts.push(params); return { rowCount: params[0] === 'dup@b.c' ? 0 : 1 }; }, end: async () => {} };
    }
    return { // source
      query: async () => ({ rows: [
        { email: 'a@b.c', encrypted_password: '$2a$10$h', email_confirmed_at: '2024' },
        { email: 'dup@b.c', encrypted_password: '$2a$10$h2', email_confirmed_at: null },
      ] }),
      end: async () => {},
    };
  };
  const r = await M.migrateUsers({ sourceUrl: 'postgresql://src', ref: 'p0123456789abcdef' }, { connect });
  assert.equal(r.total, 2);
  assert.equal(r.imported, 1);
  assert.equal(r.skipped, 1);
  assert.equal(inserts[0][0], 'a@b.c');       // email
  assert.equal(inserts[0][1], '$2a$10$h');    // bcrypt hash imported verbatim
});

test('migrateSchemaData: dump then restore, captures RLS warnings leniently', async () => {
  const calls = [];
  const exec = async (cmd) => {
    calls.push(cmd);
    if (cmd === 'pg_dump') return { code: 0, stderr: '' };
    return { code: 1, stderr: 'pg_restore: error: could not create policy: function auth.uid() does not exist' };
  };
  const r = await M.migrateSchemaData({ sourceUrl: 'postgresql://src', ref: 'p0123456789abcdef' }, { exec });
  assert.equal(r.restored, true);
  assert.ok(r.warnings.some((w) => /policy|auth\./.test(w)));
  assert.deepEqual(calls, ['pg_dump', 'pg_restore']);
});

test('migrateSchemaData: a pg_dump failure aborts (throws)', async () => {
  const exec = async (cmd) => (cmd === 'pg_dump' ? { code: 1, stderr: 'connection refused' } : { code: 0, stderr: '' });
  await assert.rejects(M.migrateSchemaData({ sourceUrl: 'x', ref: 'p0123456789abcdef' }, { exec }), /pg_dump failed/);
});
