'use strict';

/** BaaS DB provisioning — the admin command sequence + returned connection string, with an
 * injected fake admin client (no live cluster). Idempotent: role exists → ALTER not CREATE. */

process.env.NODE_ENV = 'test';
process.env.BAAS_PG_HOST = 'db.internal';
process.env.BAAS_PG_PORT = '6432';

const test = require('node:test');
const assert = require('node:assert/strict');
const baasDb = require('../src/services/baasDb');

const REF = 'p0123456789abcdef';

// Fake admin client: records queries; `existing` drives the SELECT ... EXISTS checks.
function fakeAdmin(existing = new Set()) {
  const queries = [];
  return {
    client: {
      query: async (text, params) => {
        queries.push({ text, params });
        if (/pg_roles WHERE rolname/.test(text)) return { rows: existing.has(`role:${params[0]}`) ? [{ 1: 1 }] : [] };
        if (/pg_database WHERE datname/.test(text)) return { rows: existing.has(`db:${params[0]}`) ? [{ 1: 1 }] : [] };
        return { rows: [] };
      },
      end: async () => {},
    },
    queries,
  };
}

test('provision creates role + db + grants; returns a role-scoped connection string', async () => {
  const f = fakeAdmin();
  const out = await baasDb.provisionProjectDb({ ref: REF }, { connect: async () => f.client });
  assert.equal(out.database, `baas_${REF}`);
  assert.equal(out.role, `auth_${REF}`);
  assert.match(out.connectionString, new RegExp(`^postgres://auth_${REF}:[^@]+@db\\.internal:6432/baas_${REF}$`));

  const sql = f.queries.map((q) => q.text).join('\n');
  assert.match(sql, /CREATE ROLE "auth_p0123456789abcdef" LOGIN PASSWORD/);
  assert.match(sql, /CREATE ROLE "anon_p0123456789abcdef" NOLOGIN/);                  // per-project request roles
  assert.match(sql, /CREATE ROLE "authenticated_p0123456789abcdef" NOLOGIN/);
  assert.match(sql, /CREATE ROLE "service_p0123456789abcdef" NOLOGIN BYPASSRLS/);
  assert.match(sql, /GRANT "anon_p0123456789abcdef" TO "auth_p0123456789abcdef"/);
  assert.match(sql, /CREATE DATABASE "baas_p0123456789abcdef" OWNER "auth_p0123456789abcdef"/);
  assert.match(sql, /REVOKE CONNECT ON DATABASE "baas_p0123456789abcdef" FROM PUBLIC/);   // db-level isolation
  assert.match(sql, /GRANT CONNECT ON DATABASE "baas_p0123456789abcdef" TO "auth_p0123456789abcdef"/);
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS "vector"/);                            // pgvector on the project DB
  assert.deepEqual(out.extensions, { vector: true });
});

test('extension step is best-effort: a missing extension is reported, not fatal', async () => {
  // Fake client that errors on CREATE EXTENSION (cluster image lacks pgvector) but succeeds otherwise.
  const queries = [];
  const client = {
    query: async (text, params) => {
      queries.push(text);
      if (/CREATE EXTENSION/.test(text)) throw new Error('could not open extension control file');
      if (/pg_roles WHERE rolname/.test(text) || /pg_database WHERE datname/.test(text)) return { rows: [] };
      return { rows: [] };
    },
    end: async () => {},
  };
  const out = await baasDb.provisionProjectDb({ ref: REF }, { connect: async () => client });
  assert.deepEqual(out.extensions, { vector: false });                 // reported unavailable
  assert.match(out.connectionString, /baas_p0123456789abcdef$/);       // provisioning still succeeded
});

test('idempotent: existing role/db → ALTER password, no duplicate CREATE', async () => {
  const f = fakeAdmin(new Set([`role:auth_${REF}`, `role:anon_${REF}`, `role:authenticated_${REF}`, `role:service_${REF}`, `db:baas_${REF}`]));
  await baasDb.provisionProjectDb({ ref: REF }, { connect: async () => f.client });
  const sql = f.queries.map((q) => q.text).join('\n');
  assert.match(sql, /ALTER ROLE "auth_p0123456789abcdef" LOGIN PASSWORD/);
  assert.ok(!/CREATE ROLE "auth_p0123456789abcdef"/.test(sql));  // not re-created
  assert.ok(!/CREATE DATABASE/.test(sql));                        // db already exists
});

test('rejects an invalid ref (guards SQL identifier injection)', async () => {
  await assert.rejects(() => baasDb.provisionProjectDb({ ref: 'p1"; DROP DATABASE x;--' }), /invalid ref/);
});

test('isConfigured reflects BAAS_PG_ADMIN_URL', () => {
  const saved = process.env.BAAS_PG_ADMIN_URL;
  delete process.env.BAAS_PG_ADMIN_URL; assert.equal(baasDb.isConfigured(), false);
  process.env.BAAS_PG_ADMIN_URL = 'postgres://admin@host/postgres'; assert.equal(baasDb.isConfigured(), true);
  if (saved === undefined) delete process.env.BAAS_PG_ADMIN_URL; else process.env.BAAS_PG_ADMIN_URL = saved;
});
