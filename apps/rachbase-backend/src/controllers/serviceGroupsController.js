'use strict';

/**
 * Phase 2 · WS6 — service groups.
 * Tenant-scoped CRUD for grouping deployment services on the canvas, plus
 * assigning a service to a group.
 */

const { pool } = require('@rach/core');

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// GET /api/deployment/groups
exports.listGroups = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.color, g.created_at,
            (SELECT count(*)::int FROM deployment_services s WHERE s.group_id = g.id) AS service_count
       FROM service_groups g
      WHERE g.tenant_id = $1
      ORDER BY g.name`,
    [req.user.tenant_id],
  );
  res.json({ groups: rows });
};

// POST /api/deployment/groups  { name?, color? }
// Name is optional — when omitted we auto-name it "Group N".
exports.createGroup = async (req, res) => {
  let name = String(req.body.name || '').trim();
  const color = String(req.body.color || '#477EF7');
  if (!COLOR_RE.test(color)) return res.status(400).json({ error: 'Invalid color (use #RRGGBB)' });

  if (!name) {
    // Next number after the highest existing "Group N" for this tenant.
    const { rows: n } = await pool.query(
      `SELECT COALESCE(MAX((substring(name from '^Group (\\d+)$'))::int), 0) AS maxn
         FROM service_groups WHERE tenant_id = $1`,
      [req.user.tenant_id],
    );
    name = 'Group ' + ((n[0].maxn || 0) + 1);
  }

  const { rows } = await pool.query(
    `INSERT INTO service_groups (tenant_id, name, color) VALUES ($1, $2, $3)
     RETURNING id, name, color, created_at`,
    [req.user.tenant_id, name, color],
  );
  res.status(201).json({ group: rows[0] });
};

// PATCH /api/deployment/groups/:groupId  { name?, color? }
exports.updateGroup = async (req, res) => {
  const fields = [];
  const vals = [];
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: 'Name cannot be empty' });
    vals.push(name); fields.push(`name = $${vals.length}`);
  }
  if (req.body.color !== undefined) {
    const color = String(req.body.color);
    if (!COLOR_RE.test(color)) return res.status(400).json({ error: 'Invalid color (use #RRGGBB)' });
    vals.push(color); fields.push(`color = $${vals.length}`);
  }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

  vals.push(req.params.groupId, req.user.tenant_id);
  const { rows } = await pool.query(
    `UPDATE service_groups SET ${fields.join(', ')}
      WHERE id = $${vals.length - 1} AND tenant_id = $${vals.length}
      RETURNING id, name, color, created_at`,
    vals,
  );
  if (!rows.length) return res.status(404).json({ error: 'Group not found' });
  res.json({ group: rows[0] });
};

// DELETE /api/deployment/groups/:groupId  (members are unassigned via FK)
exports.deleteGroup = async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM service_groups WHERE id = $1 AND tenant_id = $2',
    [req.params.groupId, req.user.tenant_id],
  );
  if (!rowCount) return res.status(404).json({ error: 'Group not found' });
  res.json({ ok: true });
};

// PATCH /api/deployment/services/:id/group  { group_id: number | null }
exports.setServiceGroup = async (req, res) => {
  const groupId = req.body.group_id === null || req.body.group_id === undefined
    ? null
    : Number(req.body.group_id);

  // Verify the target group belongs to the tenant (when set).
  if (groupId !== null) {
    const { rows } = await pool.query(
      'SELECT 1 FROM service_groups WHERE id = $1 AND tenant_id = $2',
      [groupId, req.user.tenant_id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Group not found' });
  }

  const { rows } = await pool.query(
    `UPDATE deployment_services SET group_id = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING id, group_id`,
    [groupId, req.params.id, req.user.tenant_id],
  );
  if (!rows.length) return res.status(404).json({ error: 'Service not found' });
  res.json({ service: rows[0] });
};
