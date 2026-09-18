'use strict';

/**
 * BaaS logical backups + restore (trust track).
 *
 *   runBackup    — pg_dump -Fc of baas_<ref> → object storage; record size + retention horizon
 *   restoreBackup— download a backup → CREATE a NEW database → pg_restore into it (never in-place)
 *   pruneExpired — delete objects + rows past their retention horizon
 *
 * Retention is plan-tiered: Starter keeps 7 days, Pro keeps 30. Backups run against the managed
 * BaaS Postgres cluster (BAAS_PG_ADMIN_URL); pg_dump / pg_restore / createdb binaries must be on
 * PATH where the backend runs (postgresql-client). All side-effecting deps are injectable so the
 * orchestration is unit-tested without a live cluster.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { URL } = require('url');
const { pool } = require('@rach/core');
const store = require('./backupStore');
const baasDb = require('./baasDb');
const { isPro, isMax } = require('../lib/plan');

const RETENTION_DAYS = { pro: 30, starter: 7 };

// ── Pure helpers (unit-tested) ────────────────────────────────────────────────
// Pro and Max keep 30 days; Starter (and anything else) keeps 7.
function retentionDaysForPlan(plan) {
  return (isPro(plan) || isMax(plan)) ? RETENTION_DAYS.pro : RETENTION_DAYS.starter;
}
// Storage key (WITHOUT the store prefix — backupStore adds it). Deterministic + safe.
function objectKeyFor(projectId, dbName, date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, '-');
  return `project-${projectId}/${dbName}/${stamp}.dump`;
}
function expiresAt(now, days) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}
const isValidRef = (ref) => /^p[0-9a-f]{16}$/.test(String(ref || ''));
// The NEW database a restore lands in. Validated identifier, never the live DB.
function targetDbNameFor(ref, date = new Date()) {
  if (!isValidRef(ref)) throw new Error('invalid ref');
  const stamp = date.toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return `baas_${ref}_restore_${stamp}`;
}
const isValidDbIdent = (s) => /^[a-z_][a-z0-9_]{0,62}$/.test(String(s || ''));

// Connection URL to a SPECIFIC database on the managed cluster (admin creds, swapped dbname).
function dbUrlFor(dbName) {
  const u = new URL(process.env.BAAS_PG_ADMIN_URL);
  u.pathname = '/' + dbName;
  return u.toString();
}

// Split a connection URL into { dbname, env } for pg_dump/pg_restore: the PASSWORD travels
// via the PGPASSWORD env var, never on the command line — a URL argument is visible in
// /proc/<pid>/cmdline and `ps` to every process on the host for the whole (minutes-long)
// dump (re-audit 6 Sep, N4/M4). The cluster admin password guards every customer's data.
function connFromUrl(urlStr, dbName) {
  const u = new URL(urlStr);
  if (dbName) u.pathname = '/' + dbName;
  const password = u.password ? decodeURIComponent(u.password) : '';
  u.password = '';
  return { dbname: u.toString(), env: password ? { PGPASSWORD: password } : {} };
}
const dbConnFor = (dbName) => connFromUrl(process.env.BAAS_PG_ADMIN_URL, dbName);

// The CONTROL-PLANE database (users, tenants, billing, subscriptions, outbox — the one
// store that cannot be re-derived from anywhere). Railway-style DATABASE_URL, or DB_* vars.
function controlPlaneConn() {
  if (process.env.DATABASE_URL) return connFromUrl(process.env.DATABASE_URL);
  const host = process.env.DB_HOST, name = process.env.DB_NAME, user = process.env.DB_USER;
  if (!host || !name || !user) return null;
  const u = new URL('postgresql://placeholder/');
  u.hostname = host;
  u.port = process.env.DB_PORT || '5432';
  u.username = user;
  u.pathname = '/' + name;
  const password = process.env.DB_PASSWORD || '';
  return { dbname: u.toString(), env: password ? { PGPASSWORD: password } : {} };
}
const controlPlaneConfigured = () => Boolean(controlPlaneConn());
const CONTROL_RETENTION_DAYS = () => Number(process.env.BACKUP_CONTROL_RETENTION_DAYS) || 30;

function execFile(cmd, args, { env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env } });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

// ── Orchestration (deps injectable) ───────────────────────────────────────────

// Take a backup of one project's database. Returns the baas_backups row id.
async function runBackup({ projectId, ref, plan, kind = 'scheduled', userId = null }, deps = {}) {
  const db = deps.db || pool;
  const exec = deps.exec || execFile;
  const st = deps.store || store;
  const now = deps.now || new Date();
  if (!isValidRef(ref)) throw new Error('runBackup: invalid ref');

  const dbName = baasDb.dbName(ref);
  const { rows } = await db.query(
    `INSERT INTO baas_backups (project_id, kind, status, db_name, started_at, created_by)
     VALUES ($1,$2,'running',$3,$4,$5) RETURNING id`,
    [projectId, kind, dbName, now, userId]
  );
  const id = rows[0].id;
  const key = objectKeyFor(projectId, dbName, now);
  const tmp = path.join(os.tmpdir(), `rb-backup-${id}.dump`);
  try {
    const conn = dbConnFor(dbName); // password via PGPASSWORD, not argv
    await exec('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--dbname', conn.dbname, '--file', tmp], { env: conn.env });
    const { size } = fs.statSync(tmp);
    await st.putObjectFromFile(key, tmp, 'application/octet-stream');
    const exp = expiresAt(now, retentionDaysForPlan(plan));
    await db.query(
      `UPDATE baas_backups SET status='completed', object_key=$2, size_bytes=$3, completed_at=NOW(), expires_at=$4 WHERE id=$1`,
      [id, key, size, exp]
    );
    return id;
  } catch (e) {
    await db.query(`UPDATE baas_backups SET status='failed', error=$2, completed_at=NOW() WHERE id=$1`, [id, String(e.message).slice(0, 500)]);
    throw e;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

// Restore a backup into a NEW database (never overwrites the live one). Returns { restoreId, targetDb }.
async function restoreBackup({ projectId, backupId, ref, userId = null }, deps = {}) {
  const db = deps.db || pool;
  const exec = deps.exec || execFile;
  const st = deps.store || store;
  const adminConnect = deps.adminConnect || defaultAdminConnect;
  const now = deps.now || new Date();

  const { rows } = await db.query(
    `SELECT * FROM baas_backups WHERE id=$1 AND project_id=$2 AND status='completed' AND object_key IS NOT NULL`,
    [backupId, projectId]
  );
  const backup = rows[0];
  if (!backup) throw new Error('restoreBackup: no completed backup for this project');

  const targetDb = targetDbNameFor(ref, now);
  if (!isValidDbIdent(targetDb)) throw new Error('restoreBackup: computed target name invalid');

  const { rows: rr } = await db.query(
    `INSERT INTO baas_restores (project_id, backup_id, status, target_db, created_by)
     VALUES ($1,$2,'running',$3,$4) RETURNING id`,
    [projectId, backupId, targetDb, userId]
  );
  const restoreId = rr[0].id;
  const tmp = path.join(os.tmpdir(), `rb-restore-${restoreId}.dump`);
  try {
    await st.getObjectToFile(backup.object_key, tmp);
    // Create the new database owned by the project's authenticator role.
    const owner = baasDb.roleName(ref);
    const admin = await adminConnect();
    try {
      await admin.query(`CREATE DATABASE "${targetDb}" OWNER "${owner}"`);
    } finally { await admin.end(); }
    const conn = dbConnFor(targetDb); // password via PGPASSWORD, not argv
    await exec('pg_restore', ['--no-owner', '--no-privileges', '--dbname', conn.dbname, tmp], { env: conn.env });
    await db.query(`UPDATE baas_restores SET status='completed', completed_at=NOW() WHERE id=$1`, [restoreId]);
    return { restoreId, targetDb };
  } catch (e) {
    await db.query(`UPDATE baas_restores SET status='failed', error=$2, completed_at=NOW() WHERE id=$1`, [restoreId, String(e.message).slice(0, 500)]);
    throw e;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

async function defaultAdminConnect() {
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.BAAS_PG_ADMIN_URL });
  await c.connect();
  return c;
}

// Back up the CONTROL-PLANE database (kind='control_plane', project_id NULL — migration 129).
// Same pipeline as project backups: pg_dump -Fc → object store, fixed retention
// (BACKUP_CONTROL_RETENTION_DAYS, default 30). This is the tenants/billing/subscription
// source of truth — the go-live audit's #1 finding was that it had no backup at all.
async function runControlPlaneBackup(deps = {}) {
  const db = deps.db || pool;
  const exec = deps.exec || execFile;
  const st = deps.store || store;
  const now = deps.now || new Date();
  const conn = deps.conn || controlPlaneConn();
  if (!conn) throw new Error('runControlPlaneBackup: control-plane DB connection is not configured');

  const dbName = new URL(conn.dbname).pathname.replace(/^\//, '') || 'control_plane';
  const { rows } = await db.query(
    `INSERT INTO baas_backups (project_id, kind, status, db_name, started_at)
     VALUES (NULL,'control_plane','running',$1,$2) RETURNING id`,
    [dbName, now]
  );
  const id = rows[0].id;
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const key = `control-plane/${dbName}/${stamp}.dump`;
  const tmp = path.join(os.tmpdir(), `rb-cp-backup-${id}.dump`);
  try {
    await exec('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--dbname', conn.dbname, '--file', tmp], { env: conn.env });
    const { size } = fs.statSync(tmp);
    await st.putObjectFromFile(key, tmp, 'application/octet-stream');
    const exp = expiresAt(now, CONTROL_RETENTION_DAYS());
    await db.query(
      `UPDATE baas_backups SET status='completed', object_key=$2, size_bytes=$3, completed_at=NOW(), expires_at=$4 WHERE id=$1`,
      [id, key, size, exp]
    );
    return id;
  } catch (e) {
    await db.query(`UPDATE baas_backups SET status='failed', error=$2, completed_at=NOW() WHERE id=$1`, [id, String(e.message).slice(0, 500)]);
    throw e;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

// Delete backups whose retention horizon has passed (objects first, then rows).
//
// SAFETY GUARD (re-audit 6 Sep, N1): NEVER prune a database's newest completed backup, however
// old. If dumps have been failing silently for longer than the retention window, age-based
// pruning would otherwise delete the last restorable copy — a data-loss cliff hidden behind a
// clean log. A row is only eligible when a NEWER completed backup exists for the same scope
// (project, or the control plane via IS NOT DISTINCT FROM for the NULL project_id).
async function pruneExpired(deps = {}) {
  const db = deps.db || pool;
  const st = deps.store || store;
  const now = deps.now || new Date();
  const { rows } = await db.query(
    `SELECT b.id, b.object_key FROM baas_backups b
      WHERE b.status='completed' AND b.expires_at IS NOT NULL AND b.expires_at < $1
        AND EXISTS (
          SELECT 1 FROM baas_backups n
           WHERE n.project_id IS NOT DISTINCT FROM b.project_id
             AND n.status = 'completed'
             AND (n.started_at > b.started_at OR (n.started_at = b.started_at AND n.id > b.id))
        )`,
    [now]
  );
  let pruned = 0;
  for (const r of rows) {
    try {
      if (r.object_key) await st.deleteObject(r.object_key);
      await db.query('DELETE FROM baas_backups WHERE id=$1', [r.id]);
      pruned += 1;
    } catch (e) {
      console.error(`[backupService] prune ${r.id} failed:`, e.message);
    }
  }
  return pruned;
}

module.exports = {
  runBackup, restoreBackup, pruneExpired, runControlPlaneBackup,
  // pure helpers (exported for tests)
  retentionDaysForPlan, objectKeyFor, expiresAt, targetDbNameFor, isValidDbIdent, isValidRef, dbUrlFor,
  connFromUrl, dbConnFor, controlPlaneConn, controlPlaneConfigured,
};
