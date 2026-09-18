'use strict';

/**
 * Daily backup worker. Once per tick it:
 *   1. takes a scheduled backup of every BaaS-enabled project that hasn't had one today,
 *   2. takes the CONTROL-PLANE database backup if none has run today (users, tenants,
 *      billing, subscriptions — the store that cannot be re-derived; audit finding #1),
 *   3. prunes backups past their retention horizon (never a scope's newest good one),
 *   4. emails the operators (opsAlert) when anything failed — a backup system that fails
 *      SILENTLY converges to zero restorable backups once retention passes (re-audit N1+N3).
 *
 * Only runs when the backup object store is configured; the project sweep additionally
 * needs the managed BaaS cluster. Mirrors the endpointProber/statusProber lifecycle
 * (start/stop, single-flight, unref timer).
 */

const { pool } = require('@rach/core');
const store = require('./backupStore');
const baasDb = require('./baasDb');
const backupService = require('./backupService');
const opsAlert = require('./opsAlert');
const { getTenantPlan } = require('../lib/plan');

const TICK_MS = Number(process.env.BACKUP_TICK_MS) || 60 * 60 * 1000; // check hourly; acts once/day/scope

let timer = null;
let running = false;

async function projectsDueToday() {
  // BaaS projects with no completed/running backup started since UTC midnight.
  const { rows } = await pool.query(`
    SELECT p.id, p.ref, p.tenant_id
      FROM projects p
     WHERE p.baas_enabled = TRUE AND p.ref IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM baas_backups b
          WHERE b.project_id = p.id
            AND b.status IN ('running','completed')
            AND b.started_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
       )`);
  return rows;
}

async function controlPlaneDueToday() {
  const { rows } = await pool.query(`
    SELECT 1 FROM baas_backups
     WHERE project_id IS NULL AND kind = 'control_plane'
       AND status IN ('running','completed')
       AND started_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
     LIMIT 1`);
  return rows.length === 0;
}

async function tick() {
  if (running) return;
  if (!store.isConfigured()) return; // nothing to do until the object store is configured
  running = true;
  const failures = []; // [{scope, error}] — aggregated into ONE operator alert per tick

  try {
    // 1. Per-project BaaS backups (needs the managed cluster).
    if (baasDb.isConfigured()) {
      const due = await projectsDueToday();
      for (const p of due) {
        try {
          const plan = await getTenantPlan(p.tenant_id);
          await backupService.runBackup({ projectId: p.id, ref: p.ref, plan, kind: 'scheduled' });
          console.log(`[backupWorker] backed up project ${p.id} (${p.ref})`);
        } catch (e) {
          console.error(`[backupWorker] backup failed for project ${p.id}:`, e.message);
          failures.push({ scope: `project ${p.id} (${p.ref})`, error: e.message });
        }
      }
    }

    // 2. Control-plane backup — independent of the BaaS cluster.
    if (backupService.controlPlaneConfigured()) {
      try {
        if (await controlPlaneDueToday()) {
          await backupService.runControlPlaneBackup();
          console.log('[backupWorker] backed up control-plane database');
        }
      } catch (e) {
        console.error('[backupWorker] CONTROL-PLANE backup failed:', e.message);
        failures.push({ scope: 'control-plane database', error: e.message });
      }
    } else {
      console.warn('[backupWorker] control-plane backup skipped — no DATABASE_URL/DB_* connection resolvable');
    }

    // 3. Retention pruning (guarded: never a scope's newest completed backup).
    const pruned = await backupService.pruneExpired();
    if (pruned) console.log(`[backupWorker] pruned ${pruned} expired backup(s)`);
  } catch (e) {
    console.error('[backupWorker] tick error:', e.message);
    failures.push({ scope: 'backup worker tick', error: e.message });
  } finally {
    running = false;
  }

  // 4. One aggregated operator alert per tick (cooldown inside opsAlert keeps an
  //    hour-long failure streak to one email per window, not one per tick).
  if (failures.length) {
    await opsAlert.sendOpsAlert({
      key: 'backup-failures',
      subject: `${failures.length} backup failure(s)`,
      text:
        failures.map((f) => `• ${f.scope}: ${f.error}`).join('\n') +
        '\n\nBackups retry on the next hourly tick. If this persists, dumps are NOT being taken; ' +
        'existing backups are protected from pruning (newest is always kept) but are aging. ' +
        'See RUNBOOK-restore.md.',
    });
  }
}

function start() {
  if (timer) return () => stop();
  if (!store.isConfigured()) {
    console.warn('[backupWorker] disabled — BACKUP_S3_* not configured');
    return () => {};
  }
  tick();
  timer = setInterval(tick, TICK_MS);
  timer.unref?.();
  console.log(`[backupWorker] started (tick ${TICK_MS}ms)`);
  return () => stop();
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { start, stop, tick, projectsDueToday, controlPlaneDueToday };
