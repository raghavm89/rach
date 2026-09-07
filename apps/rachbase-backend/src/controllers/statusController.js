'use strict';

/**
 * Status page controller.
 *   PUBLIC  GET  /api/status                     → the sanitized public health payload
 *   ADMIN   GET  /api/status/incidents           → all incidents (for the ops console)
 *   ADMIN   POST /api/status/incidents           → open an incident / schedule maintenance
 *   ADMIN   PATCH /api/status/incidents/:id       → change status/impact/schedule (resolve)
 *   ADMIN   POST /api/status/incidents/:id/updates → append a timeline update
 *
 * Admin routes are gated by authenticate + authorize('admin') in the router. The public
 * handler must never leak internal detail — it returns only what statusService assembles.
 */

const { pool } = require('@rach/core');
const statusService = require('../services/statusService');

const INCIDENT_STATUSES   = new Set(['investigating', 'identified', 'monitoring', 'resolved']);
const MAINT_STATUSES      = new Set(['scheduled', 'in_progress', 'completed']);
const IMPACTS             = new Set(['none', 'minor', 'major', 'critical', 'maintenance']);
const TERMINAL            = new Set(['resolved', 'completed']);

const clampDays = (v) => Math.min(Math.max(parseInt(v, 10) || 90, 1), 90);

// ── Public ───────────────────────────────────────────────────────────────────
async function getPublicStatus(req, res) {
  const days = clampDays(req.query.days);
  const payload = await statusService.getPublicStatus({ days });
  // Public, read-only, non-credentialed → readable from any origin (the status subdomain,
  // or a future independently-hosted status page). Do NOT pair '*' with credentials.
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'public, max-age=30'); // cheap edge/browser cache
  res.json(payload);
}

// ── Admin ──────────────────────────────────────────────────────────────────
async function listIncidents(req, res) {
  const { rows } = await pool.query('SELECT * FROM status_incidents ORDER BY started_at DESC LIMIT 200');
  res.json({ incidents: rows });
}

async function createIncident(req, res) {
  const { kind = 'incident', title, status, impact = 'minor', components = [], startedAt, scheduledEnd, body } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'title is required' });

  const validStatuses = kind === 'maintenance' ? MAINT_STATUSES : INCIDENT_STATUSES;
  const st = status || (kind === 'maintenance' ? 'scheduled' : 'investigating');
  if (!validStatuses.has(st)) return res.status(400).json({ error: `invalid status for ${kind}` });
  if (!IMPACTS.has(impact)) return res.status(400).json({ error: 'invalid impact' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resolvedAt = TERMINAL.has(st) ? new Date() : null;
    const { rows } = await client.query(
      `INSERT INTO status_incidents (kind, title, status, impact, started_at, scheduled_end, resolved_at, created_by)
       VALUES ($1,$2,$3,$4, COALESCE($5, NOW()), $6, $7, $8) RETURNING *`,
      [kind, title.trim(), st, impact, startedAt || null, scheduledEnd || null, resolvedAt, req.user?.id ?? null]
    );
    const incident = rows[0];
    for (const key of components) {
      await client.query(
        'INSERT INTO status_incident_components (incident_id, component_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [incident.id, key]
      );
    }
    if (body && String(body).trim()) {
      await client.query(
        'INSERT INTO status_incident_updates (incident_id, status, body) VALUES ($1,$2,$3)',
        [incident.id, st, body.trim()]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ incident });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function updateIncident(req, res) {
  const { id } = req.params;
  const { title, status, impact, scheduledEnd, resolved } = req.body || {};
  const { rows: existing } = await pool.query('SELECT * FROM status_incidents WHERE id = $1', [id]);
  if (!existing.length) return res.status(404).json({ error: 'incident not found' });
  const inc = existing[0];

  if (status) {
    const valid = inc.kind === 'maintenance' ? MAINT_STATUSES : INCIDENT_STATUSES;
    if (!valid.has(status)) return res.status(400).json({ error: `invalid status for ${inc.kind}` });
  }
  if (impact && !IMPACTS.has(impact)) return res.status(400).json({ error: 'invalid impact' });

  const nextStatus = status || inc.status;
  const shouldResolve = resolved === true || TERMINAL.has(nextStatus);
  const { rows } = await pool.query(
    `UPDATE status_incidents
        SET title = COALESCE($2, title),
            status = COALESCE($3, status),
            impact = COALESCE($4, impact),
            scheduled_end = COALESCE($5, scheduled_end),
            resolved_at = CASE WHEN $6 THEN COALESCE(resolved_at, NOW()) ELSE NULL END,
            updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [id, title || null, status || null, impact || null, scheduledEnd || null, shouldResolve]
  );
  res.json({ incident: rows[0] });
}

async function addIncidentUpdate(req, res) {
  const { id } = req.params;
  const { status, body } = req.body || {};
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'body is required' });
  const { rows: existing } = await pool.query('SELECT * FROM status_incidents WHERE id = $1', [id]);
  if (!existing.length) return res.status(404).json({ error: 'incident not found' });
  const inc = existing[0];

  const st = status || inc.status;
  const valid = inc.kind === 'maintenance' ? MAINT_STATUSES : INCIDENT_STATUSES;
  if (!valid.has(st)) return res.status(400).json({ error: `invalid status for ${inc.kind}` });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO status_incident_updates (incident_id, status, body) VALUES ($1,$2,$3)',
      [id, st, body.trim()]
    );
    await client.query(
      `UPDATE status_incidents
          SET status = $2,
              resolved_at = CASE WHEN $3 THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END,
              updated_at = NOW()
        WHERE id = $1`,
      [id, st, TERMINAL.has(st)]
    );
    await client.query('COMMIT');
    res.status(201).json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { getPublicStatus, listIncidents, createIncident, updateIncident, addIncidentUpdate };
