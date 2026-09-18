#!/usr/bin/env node
'use strict';

/**
 * One-time migration for the storage-isolation fix.
 *
 * Before the fix, object bytes lived at a filer path keyed by bucket name only:
 *     /buckets/<bucket>/<key>
 * On the SHARED SeaweedFS filer that meant two projects with a same-named bucket
 * (e.g. `avatars`) overwrote and could read each other's objects. Objects are now
 * namespaced by project ref:
 *     /buckets/<ref>/<bucket>/<key>
 *
 * This script moves a SINGLE project's legacy flat objects into its namespaced
 * prefix. Run it once per project, INSIDE that project's baas-storage container
 * (so PROJECT_REF / SEAWEEDFS_FILER_URL / DATABASE_URL are already its own):
 *
 *     node scripts/migrate-filer-namespacing.js            # migrate
 *     node scripts/migrate-filer-namespacing.js --dry-run  # list only
 *
 * SAFETY: because legacy objects were NOT namespaced, a flat /buckets/<bucket>/*
 * tree is ambiguous when more than one project used that bucket name. Run this
 * only against a filer you know served exactly one project for that bucket, or
 * treat legacy objects as non-isolated and have users re-upload. The script never
 * deletes the source until the destination copy is confirmed (GET after PUT).
 */

const http = require('http');
const https = require('https');
const { Pool } = require('pg');
const { filerObjectPath } = require('../index');

const REF = String(process.env.PROJECT_REF || '').trim();
const FILER = process.env.SEAWEEDFS_FILER_URL;
const DRY = process.argv.includes('--dry-run');

if (!REF) { console.error('PROJECT_REF is required (this script migrates one project).'); process.exit(1); }
if (!FILER) { console.error('SEAWEEDFS_FILER_URL is required.'); process.exit(1); }

const agent = FILER.startsWith('https') ? https : http;

function req(method, path, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, FILER);
    const r = agent.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

// List entries directly under a filer directory (SeaweedFS returns JSON with ?pretty=n).
async function listDir(dir) {
  const res = await req('GET', `${dir}?limit=100000`, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return [];
  let json;
  try { json = JSON.parse(res.body.toString('utf8')); } catch { return []; }
  return Array.isArray(json.Entries) ? json.Entries : [];
}

// Recursively collect every file key under /buckets/<bucket>/ (legacy flat layout).
async function collectKeys(bucket, prefix = '') {
  const dir = `/buckets/${bucket}/${prefix}`;
  const entries = await listDir(dir);
  const keys = [];
  for (const e of entries) {
    const name = String(e.FullPath || '').split('/').pop();
    if (!name) continue;
    if (e.Mode && (e.Mode & 0o170000) === 0o040000 || e.IsDirectory) {
      keys.push(...await collectKeys(bucket, `${prefix}${name}/`));
    } else {
      keys.push(`${prefix}${name}`);
    }
  }
  return keys;
}

async function moveOne(bucket, key) {
  const from = `/buckets/${bucket}/${key}`;
  const to = filerObjectPath(REF, bucket, key);
  if (from === to) return 'noop';
  const got = await req('GET', from);
  if (got.status !== 200) return `skip(get ${got.status})`;
  if (DRY) return `would-move → ${to}`;
  const put = await req('PUT', to, { body: got.body, headers: { 'Content-Type': got.headers?.['content-type'] || 'application/octet-stream' } });
  if (put.status >= 300) return `FAIL(put ${put.status})`;
  const verify = await req('GET', to);
  if (verify.status !== 200) return `FAIL(verify ${verify.status})`;
  await req('DELETE', from);
  return `moved → ${to}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query('SELECT name FROM storage_buckets ORDER BY name');
  await pool.end();
  if (!rows.length) { console.log('No buckets in this project DB — nothing to migrate.'); return; }

  console.log(`[migrate] ref=${REF} buckets=${rows.map((r) => r.name).join(', ')}${DRY ? ' (dry-run)' : ''}`);
  let moved = 0, skipped = 0, failed = 0;
  for (const { name: bucket } of rows) {
    const keys = await collectKeys(bucket);
    for (const key of keys) {
      const result = await moveOne(bucket, key);
      console.log(`  ${bucket}/${key}: ${result}`);
      if (result.startsWith('moved') || result.startsWith('would-move')) moved++;
      else if (result.startsWith('FAIL')) failed++;
      else skipped++;
    }
  }
  console.log(`[migrate] done — ${moved} ${DRY ? 'to move' : 'moved'}, ${skipped} skipped, ${failed} failed`);
  if (failed) process.exit(2);
}

main().catch((e) => { console.error('[migrate] fatal:', e.message); process.exit(1); });
