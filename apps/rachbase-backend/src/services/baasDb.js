'use strict';

/**
 * BaaS per-project database provisioning (Phase 3). Creates an isolated database + a login role
 * on the MANAGED BaaS Postgres cluster (not the RachBase control-plane DB). PostgREST connects
 * as the login role (the "authenticator") and SET ROLEs to the JWT role per request; Auth uses
 * the same connection for its user table. Isolation is database + role level.
 *
 * Config: BAAS_PG_ADMIN_URL (admin/superuser connection to the cluster), and BAAS_PG_HOST/PORT
 * for the connection string clients get (may differ from the admin host, e.g. behind a pooler).
 * `connect` is injectable so the provisioning sequence is unit-tested without a live cluster.
 */

const crypto = require('crypto');

const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

const dbName = (ref) => `baas_${ref}`;
const roleName = (ref) => `auth_${ref}`; // the PostgREST authenticator / owner login role

// Extensions enabled on every project DB at provision time. `vector` (pgvector) makes the
// backend AI-native — customers can store embeddings + do similarity search in their own DB.
// Best-effort: a cluster whose Postgres image lacks an extension just reports it unavailable;
// it never fails provisioning. The cluster's managed Postgres image must ship these.
const BAAS_EXTENSIONS = ['vector'];

const isConfigured = () => Boolean(process.env.BAAS_PG_ADMIN_URL);

function hostPort() {
  let host = process.env.BAAS_PG_HOST || '';
  let port = process.env.BAAS_PG_PORT || '';
  if ((!host || !port) && process.env.BAAS_PG_ADMIN_URL) {
    try { const u = new URL(process.env.BAAS_PG_ADMIN_URL); host = host || u.hostname; port = port || u.port; } catch { /* ignore */ }
  }
  return { host: host || 'localhost', port: port || '5432' };
}

async function withAdmin(fn, { connect } = {}) {
  if (connect) return fn(await connect());
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.BAAS_PG_ADMIN_URL });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

// Admin connection to a SPECIFIC project database (extensions are per-database, so this must
// target baas_<ref>, not the admin URL's default DB). `connect` is injectable for tests.
async function withAdminDb(db, fn, { connect } = {}) {
  if (connect) return fn(await connect());
  const { Client } = require('pg');
  const url = new URL(process.env.BAAS_PG_ADMIN_URL);
  url.pathname = `/${db}`;
  const c = new Client({ connectionString: url.toString() });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

// Enable the platform extensions inside a project DB (best-effort). Returns { vector: bool, ... }.
// CREATE EXTENSION needs superuser/owner rights, so it runs on the admin connection, not the
// tenant's authenticator role. Never throws — a missing extension is reported, not fatal.
async function enableExtensions(db, opts = {}) {
  const result = {};
  try {
    await withAdminDb(db, async (c) => {
      for (const ext of BAAS_EXTENSIONS) {
        try { await c.query(`CREATE EXTENSION IF NOT EXISTS ${ident(ext)}`); result[ext] = true; }
        catch (e) { result[ext] = false; console.warn(`[baasDb] extension "${ext}" unavailable for ${db}: ${e.message}`); }
      }
    }, opts);
  } catch (e) {
    console.warn(`[baasDb] extension step skipped for ${db}: ${e.message}`);
    for (const ext of BAAS_EXTENSIONS) if (!(ext in result)) result[ext] = false;
  }
  return result;
}

/**
 * Idempotently provision the project's database + roles. Returns { database, role, connectionString }.
 * Roles are cluster-global (Postgres roles aren't per-DB); the database is per-project.
 */
async function provisionProjectDb({ ref }, opts = {}) {
  if (!/^p[0-9a-f]{16}$/.test(String(ref || ''))) throw new Error('provisionProjectDb: invalid ref');
  const db = dbName(ref);
  const role = roleName(ref);
  const password = crypto.randomBytes(18).toString('base64url');

  await withAdmin(async (c) => {
    const exists = async (q, p) => (await c.query(q, p)).rows.length > 0;

    // The per-project authenticator login role (rotate the password on re-provision).
    if (await exists('SELECT 1 FROM pg_roles WHERE rolname = $1', [role])) {
      await c.query(`ALTER ROLE ${ident(role)} LOGIN PASSWORD ${lit(password)}`);
    } else {
      await c.query(`CREATE ROLE ${ident(role)} LOGIN PASSWORD ${lit(password)}`);
    }

    // PER-PROJECT request roles PostgREST SET ROLEs into (anon/authenticated/service), namespaced
    // by ref so a project's RLS grants never reference a role shared with another project. The
    // service role bypasses RLS. All are granted to this project's authenticator.
    const reqRoles = [`anon_${ref}`, `authenticated_${ref}`, `service_${ref}`];
    for (const r of reqRoles) {
      if (!(await exists('SELECT 1 FROM pg_roles WHERE rolname = $1', [r]))) {
        await c.query(`CREATE ROLE ${ident(r)} NOLOGIN${r.startsWith('service_') ? ' BYPASSRLS' : ''}`);
      }
      await c.query(`GRANT ${ident(r)} TO ${ident(role)}`);
    }

    // The per-project database, owned by the authenticator.
    if (!(await exists('SELECT 1 FROM pg_database WHERE datname = $1', [db]))) {
      await c.query(`CREATE DATABASE ${ident(db)} OWNER ${ident(role)}`);
    }

    // Database-level isolation (defense in depth): CREATE DATABASE grants CONNECT to PUBLIC by
    // default, which would let any other project's login role connect here. Lock it to this
    // project's role only. Idempotent — safe to run on every (re)provision.
    await c.query(`REVOKE CONNECT ON DATABASE ${ident(db)} FROM PUBLIC`);
    await c.query(`GRANT CONNECT ON DATABASE ${ident(db)} TO ${ident(role)}`);
  }, opts);

  // Enable platform extensions (pgvector, …) inside the new DB. Best-effort; never fatal.
  const extensions = await enableExtensions(db, opts);

  const { host, port } = hostPort();
  return { database: db, role, connectionString: `postgres://${role}:${encodeURIComponent(password)}@${host}:${port}/${db}`, extensions };
}

module.exports = { provisionProjectDb, enableExtensions, isConfigured, dbName, roleName, BAAS_EXTENSIONS };
