#!/usr/bin/env node
/**
 * OPTIONAL on-demand VM key rotation sweep.
 *
 * Rotation normally runs AUTOMATICALLY inside the backend (see
 * services/keyRotation.start(), wired in server.js) — you do NOT need a cron for
 * it. This script just lets you trigger a sweep by hand (e.g. to force rotation
 * now, or from a one-off job) using the same advisory-lock-guarded path, so it
 * can't collide with the in-process scheduler.
 *
 *   cd apps/rachbase-backend && node scripts/rotate-vm-keys.js
 */

'use strict';

// Load .env from the backend root regardless of the caller's cwd.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { pool } = require('@rach/core');
const keyCrypto = require('../src/services/keyCrypto');
const keyRotation = require('../src/services/keyRotation');

(async () => {
  if (!keyCrypto.isConfigured()) {
    console.warn('[key-rotation] RACHBASE_KEY_ENC_SECRET not set — nothing to do.');
    await pool.end().catch(() => {});
    process.exit(0);
  }

  try {
    const summary = await keyRotation.runRotationSweepLocked();
    if (summary.skipped === 'locked') {
      console.log('[key-rotation] another sweep is already running — skipped.');
    } else {
      console.log(`[key-rotation] checked=${summary.checked} rotated=${summary.rotated}`);
      for (const r of summary.results || []) {
        if (r.error)        console.warn(`  ${r.vmId}: ERROR ${r.error}`);
        else if (r.skipped) console.log(`  ${r.vmId}: skipped (${r.skipped})`);
        else if (r.rotated) console.log(`  ${r.vmId}: rotated -> v${r.version}`);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('[key-rotation] failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
})();
