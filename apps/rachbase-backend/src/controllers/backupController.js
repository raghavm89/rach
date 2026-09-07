'use strict';

/**
 * BaaS backups console (dashboard). All handlers are tenant-scoped via Project.findScoped —
 * a caller can only touch backups of a project their tenant owns.
 *
 *   GET  /:id/baas/backups                 list backups + recent restores
 *   POST /:id/baas/backups                 take an on-demand backup (runs in background)
 *   POST /:id/baas/backups/:bid/restore    restore a backup into a NEW database (background)
 *   GET  /:id/baas/backups/:bid/download   short-lived presigned download URL
 */

const { pool } = require('@rach/core');
const { Project } = require('../models/project');
const { getTenantPlan } = require('../lib/plan');
const backupService = require('../services/backupService');
const store = require('../services/backupStore');

async function loadProject(req, res) {
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return null; }
  if (!project.baas_enabled) { res.status(400).json({ error: 'Enable BaaS for this project first.' }); return null; }
  return project;
}

exports.listBackups = async (req, res) => {
  const project = await loadProject(req, res); if (!project) return;
  const [{ rows: backups }, { rows: restores }] = await Promise.all([
    pool.query(
      `SELECT id, kind, status, size_bytes, error, started_at, completed_at, expires_at
         FROM baas_backups WHERE project_id = $1 ORDER BY created_at DESC LIMIT 50`, [project.id]),
    pool.query(
      `SELECT id, backup_id, status, target_db, error, started_at, completed_at
         FROM baas_restores WHERE project_id = $1 ORDER BY created_at DESC LIMIT 20`, [project.id]),
  ]);
  res.json({ backups, restores, storageConfigured: store.isConfigured() });
};

exports.createBackup = async (req, res) => {
  const project = await loadProject(req, res); if (!project) return;
  if (!store.isConfigured()) return res.status(503).json({ error: 'backups_not_configured', message: 'Backup storage is not configured yet.' });
  const plan = await getTenantPlan(req.user.tenant_id);
  // Runs in the background; the new row shows as running → completed in the list.
  backupService.runBackup({ projectId: project.id, ref: project.ref, plan, kind: 'manual', userId: req.user.id })
    .catch((e) => console.error(`[backups] manual backup failed for project ${project.id}:`, e.message));
  res.status(202).json({ message: 'Backup started', retentionDays: backupService.retentionDaysForPlan(plan) });
};

exports.restoreBackup = async (req, res) => {
  const project = await loadProject(req, res); if (!project) return;
  if (!store.isConfigured()) return res.status(503).json({ error: 'backups_not_configured' });
  const bid = req.params.bid;
  if (!/^\d+$/.test(String(bid))) return res.status(400).json({ error: 'invalid_backup_id' });
  // Confirm the backup exists, belongs to this project, and is restorable — before kicking off.
  const { rows } = await pool.query(
    `SELECT id FROM baas_backups WHERE id=$1 AND project_id=$2 AND status='completed' AND object_key IS NOT NULL`,
    [bid, project.id]);
  if (!rows.length) return res.status(404).json({ error: 'no_restorable_backup' });

  backupService.restoreBackup({ projectId: project.id, backupId: Number(bid), ref: project.ref, userId: req.user.id })
    .catch((e) => console.error(`[backups] restore failed for project ${project.id}:`, e.message));
  res.status(202).json({ message: 'Restore started. It will appear as a new database when complete.' });
};

exports.downloadBackup = async (req, res) => {
  const project = await loadProject(req, res); if (!project) return;
  if (!store.isConfigured()) return res.status(503).json({ error: 'backups_not_configured' });
  const bid = req.params.bid;
  if (!/^\d+$/.test(String(bid))) return res.status(400).json({ error: 'invalid_backup_id' });
  const { rows } = await pool.query(
    `SELECT object_key FROM baas_backups WHERE id=$1 AND project_id=$2 AND status='completed' AND object_key IS NOT NULL`,
    [bid, project.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  res.json({ url: store.presignGet(rows[0].object_key, 300) });
};
