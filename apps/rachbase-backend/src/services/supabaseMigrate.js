'use strict';

/**
 * Supabase → RachBase project migration.
 *
 *   migrateSchemaData — pg_dump the source's `public` schema (+ data) → pg_restore into baas_<ref>.
 *                       Lenient: RLS policies referencing Supabase's auth.* won't apply here, so
 *                       restore continues past them and reports what didn't land (re-create RLS by
 *                       hand — RachBase roles are anon_<ref>/authenticated_<ref>/service_<ref>).
 *   migrateUsers      — source `auth.users` → target `auth_users`. Supabase stores bcrypt hashes;
 *                       we import them verbatim, and baas-auth verifies bcrypt (then upgrades to
 *                       scrypt on the user's next login), so passwords keep working — no reset.
 *
 * pg_dump/pg_restore must be on PATH. Source is any Postgres URL (the Supabase DB connection
 * string). `exec`/`connect` are injectable so the orchestration is unit-tested without live DBs.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { URL } = require('url');
const baasDb = require('./baasDb');

// ── Pure helpers (unit-tested) ────────────────────────────────────────────────
function buildDumpArgs(sourceUrl, outFile, { schema = 'public' } = {}) {
  return ['--format=custom', '--no-owner', '--no-privileges', '--schema', schema, '--dbname', sourceUrl, '--file', outFile];
}
function buildRestoreArgs(targetUrl, inFile) {
  // No --exit-on-error: a failing RLS policy shouldn't abort the whole restore.
  return ['--no-owner', '--no-privileges', '--dbname', targetUrl, inFile];
}
const isBcryptHash = (h) => /^\$2[aby]\$/.test(String(h || ''));

// A Supabase auth.users row → a RachBase auth_users row.
function supabaseUserToRow(u) {
  return {
    email: u.email,
    // bcrypt hash imported verbatim; baas-auth verifies it and upgrades to scrypt on next login.
    password_hash: u.encrypted_password || null,
    email_confirmed: Boolean(u.email_confirmed_at || u.email_confirmed),
  };
}

function dbUrlFor(ref) {
  const u = new URL(process.env.BAAS_PG_ADMIN_URL);
  u.pathname = '/' + baasDb.dbName(ref);
  return u.toString();
}

function execFile(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env: process.env });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => resolve({ code: -1, stderr: e.message }));
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

// ── Orchestration (deps injectable) ───────────────────────────────────────────
async function migrateSchemaData({ sourceUrl, ref, schema = 'public' }, deps = {}) {
  const exec = deps.exec || execFile;
  const tmp = path.join(os.tmpdir(), `rb-migrate-${ref}-${Date.now()}.dump`);
  try {
    const dump = await exec('pg_dump', buildDumpArgs(sourceUrl, tmp, { schema }));
    if (dump.code !== 0) throw new Error(`pg_dump failed: ${String(dump.stderr).slice(0, 400)}`);
    const restore = await exec('pg_restore', buildRestoreArgs(dbUrlFor(ref), tmp));
    // pg_restore returns non-zero if any object errored (e.g. RLS policy) — that's expected/lenient.
    const warnings = (restore.stderr || '')
      .split('\n')
      .filter((l) => /error|policy|permission|role .* does not exist|auth\./i.test(l))
      .slice(0, 40);
    return { restored: true, warnings };
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

async function migrateUsers({ sourceUrl, ref }, deps = {}) {
  const connect = deps.connect || defaultConnect;
  const src = await connect(sourceUrl);
  let rows = [];
  try {
    const r = await src.query(
      "SELECT email, encrypted_password, email_confirmed_at FROM auth.users WHERE email IS NOT NULL AND deleted_at IS NULL"
    );
    rows = r.rows || [];
  } finally { await src.end(); }

  const tgt = await connect(dbUrlFor(ref));
  let imported = 0, skipped = 0;
  try {
    for (const u of rows) {
      const row = supabaseUserToRow(u);
      if (!row.email) { skipped += 1; continue; }
      const res = await tgt.query(
        `INSERT INTO auth_users (email, password_hash, email_confirmed)
         VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING`,
        [row.email, row.password_hash, row.email_confirmed]
      );
      if (res.rowCount > 0) imported += 1; else skipped += 1;
    }
  } finally { await tgt.end(); }
  return { total: rows.length, imported, skipped };
}

async function migrate({ sourceUrl, ref, data = true, users = true }, deps = {}) {
  const summary = {};
  if (data) summary.schema = await migrateSchemaData({ sourceUrl, ref }, deps);
  if (users) summary.users = await migrateUsers({ sourceUrl, ref }, deps);
  return summary;
}

async function defaultConnect(connectionString) {
  const { Client } = require('pg');
  const c = new Client({ connectionString });
  await c.connect();
  return c;
}

module.exports = {
  migrate, migrateSchemaData, migrateUsers,
  // pure helpers
  buildDumpArgs, buildRestoreArgs, isBcryptHash, supabaseUserToRow, dbUrlFor,
};
