#!/usr/bin/env node
/**
 * Sustained-usage alert sweep (Step 5).
 *
 * Evaluates every online service and emails the Tenant Admin when any resource has
 * stayed >=90% for the full window. Idempotent per run (cooldown dedup in the DB).
 *
 * Run from a host cron every minute:
 *   * * * * * cd /path/to/apps/rachbase-backend && node scripts/evaluate-alerts.js >> /var/log/rachbase-alerts.log 2>&1
 *
 * (The same logic is exposed over HTTP at POST /internal/alerts/evaluate for callers
 * that already hold the service token — e.g. the orchestrator.)
 */

'use strict';

require('dotenv').config();

const alerting = require('../src/services/alerting');
const { pool } = require('@rach/core');

(async () => {
  try {
    const summary = await alerting.evaluateAllOnline();
    console.log(`[alerts] evaluated=${summary.evaluated} emailed=${summary.alerts.length}`);
    for (const a of summary.alerts) {
      console.log(`  service ${a.serviceId}: ${a.resources.join(', ')} -> ${a.recipients.join(', ')}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('[alerts] failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
})();
