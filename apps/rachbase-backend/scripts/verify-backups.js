'use strict';

/**
 * BaaS backup preflight — confirms the two things backups need before enabling them:
 *   1. postgresql-client binaries (pg_dump / pg_restore / createdb) on PATH
 *   2. BACKUP_S3_* configured AND reachable (does a real test put + delete against the bucket)
 *
 * Run from the repo root:  node apps/rachbase-backend/scripts/verify-backups.js
 * Exits non-zero if anything is missing, so it can gate a deploy/CI step.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../src/services/backupStore');

let fail = 0;
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); fail = 1; };

function checkBin(bin) {
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8' });
  if (r.status === 0) ok(`${bin} (${(r.stdout || '').trim()})`);
  else bad(`${bin} not found on PATH — install postgresql-client`);
}

(async () => {
  console.log('BaaS backup preflight\n→ postgresql-client');
  ['pg_dump', 'pg_restore', 'createdb'].forEach(checkBin);

  console.log('→ backup storage');
  if (!store.isConfigured()) {
    bad('BACKUP_S3_* not set (need ENDPOINT, BUCKET, ACCESS_KEY, SECRET_KEY)');
  } else {
    ok('BACKUP_S3_* configured');
    console.log('→ S3 connectivity (test put + delete)');
    const tmp = path.join(os.tmpdir(), `rb-backup-probe-${Date.now()}.txt`);
    fs.writeFileSync(tmp, 'rachbase backup healthcheck');
    const key = `__healthcheck/probe-${Date.now()}.txt`;
    try {
      await store.putObjectFromFile(key, tmp, 'text/plain');
      ok('uploaded a probe object to the bucket');
      try { await store.deleteObject(key); ok('deleted the probe object'); }
      catch (e) { bad(`delete failed: ${e.message}`); }
    } catch (e) {
      bad(`upload failed — check endpoint/region/bucket/credentials: ${e.message}`);
    } finally { try { fs.unlinkSync(tmp); } catch { /* ignore */ } }
  }

  console.log('→ managed Postgres admin URL');
  if (process.env.BAAS_PG_ADMIN_URL) ok('BAAS_PG_ADMIN_URL set'); else bad('BAAS_PG_ADMIN_URL not set');

  console.log(fail
    ? '\n✗ backups NOT ready — fix the FAIL lines above, then re-run.'
    : '\n✓ backups ready — restart the backend; the daily worker runs and on-demand backups work.');
  process.exit(fail);
})();
