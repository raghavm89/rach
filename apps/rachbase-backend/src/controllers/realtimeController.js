'use strict';

/**
 * Realtime enablement console (dashboard). Tenant-scoped via Project.findScoped.
 *   GET    /:id/baas/realtime                 → enabled tables + the WS path
 *   POST   /:id/baas/realtime/tables          → enable realtime on a table (attach trigger)
 *   DELETE /:id/baas/realtime/tables/:table   → disable realtime on a table
 */

const { Project } = require('../models/project');
const baasDb = require('../services/baasDb');
const realtimeDb = require('../services/realtimeDb');

const WS_PATH = '/realtime/v1';

async function loadProject(req, res) {
  const project = await Project.findScoped(req.params.id, req.user.tenant_id);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return null; }
  if (!project.baas_enabled) { res.status(400).json({ error: 'Enable BaaS for this project first.' }); return null; }
  if (!baasDb.isConfigured()) { res.status(503).json({ error: 'baas_not_configured' }); return null; }
  return project;
}

exports.getRealtime = async (req, res) => {
  const project = await loadProject(req, res); if (!project) return;
  const tables = await realtimeDb.listRealtimeTables(project.ref);
  res.json({ tables, wsPath: WS_PATH, ref: project.ref });
};

exports.enableTable = async (req, res) => {
  const project = await loadProject(req, res); if (!project) return;
  const { table, schema = 'public' } = req.body || {};
  if (!realtimeDb.isValidIdent(table) || !realtimeDb.isValidIdent(schema)) {
    return res.status(400).json({ error: 'invalid_table' });
  }
  try {
    await realtimeDb.enableTableRealtime(project.ref, table, schema);
  } catch (e) {
    return res.status(400).json({ error: 'enable_failed', message: String(e.message).slice(0, 200) });
  }
  res.status(201).json({ tables: await realtimeDb.listRealtimeTables(project.ref) });
};

exports.disableTable = async (req, res) => {
  const project = await loadProject(req, res); if (!project) return;
  const table = req.params.table;
  const schema = req.query.schema || 'public';
  if (!realtimeDb.isValidIdent(table) || !realtimeDb.isValidIdent(String(schema))) {
    return res.status(400).json({ error: 'invalid_table' });
  }
  await realtimeDb.disableTableRealtime(project.ref, table, String(schema));
  res.json({ tables: await realtimeDb.listRealtimeTables(project.ref) });
};
