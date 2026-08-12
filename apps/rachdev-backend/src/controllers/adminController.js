'use strict';

/**
 * RachDev platform admin (role: 'admin').
 *
 * Cross-tenant, platform-level views for the RachDev product: organizations
 * (tenants) and their workspaces, and the platform-level agent templates
 * (agent_definitions with tenant_id = NULL) that every org inherits.
 * Users are handled by the shared @rach/identity /api/users routes.
 */

const { pool, AgentDefinition, Settings } = require('@rach/core');

const { ALLOWED_INDUSTRIES } = require('../config/industries');

// GET /api/admin/orgs — all organizations with user counts
exports.listOrgs = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.id, t.name, t.industry, t.created_at,
            COUNT(u.id)::int AS user_count,
            (SELECT value->>'model' FROM tenant_settings s WHERE s.tenant_id = t.id AND s.key = 'llm') AS llm_model,
            COALESCE((SELECT (value->>'military')::boolean FROM tenant_settings s WHERE s.tenant_id = t.id AND s.key = 'healthcare'), false) AS military
     FROM tenants t
     LEFT JOIN users u ON u.tenant_id = t.id
     WHERE t.deleted_at IS NULL
     GROUP BY t.id
     ORDER BY t.created_at DESC`
  );
  res.json({ orgs: rows });
};

// PATCH /api/admin/orgs/:id/healthcare — set the org's healthcare sub-category (military)
exports.setOrgHealthcare = async (req, res) => {
  const military = Boolean(req.body && req.body.military);
  await Settings.set(req.params.id, 'healthcare', { military });
  res.json({ org: { id: Number(req.params.id), military } });
};

// GET /api/admin/doctors — doctor department profiles (user_id → department)
exports.listDoctorProfiles = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT user_id, tenant_id, department, specialty FROM doctor_profiles`
  );
  res.json({ profiles: rows });
};

// PATCH /api/admin/doctors/:userId — set/clear a doctor's department + specialty.
// Upserts the RachDev doctor_profiles row; the shared users table is untouched.
exports.setDoctorProfile = async (req, res) => {
  const userId = Number(req.params.userId);
  const department = req.body && req.body.department ? String(req.body.department).trim() : null;
  const specialty = req.body && req.body.specialty ? String(req.body.specialty).trim() : null;

  const { rows: u } = await pool.query('SELECT tenant_id, role FROM users WHERE id = $1', [userId]);
  if (!u.length) return res.status(404).json({ error: 'User not found' });
  if (u[0].role !== 'doctor') return res.status(400).json({ error: 'Only doctors have a department' });
  if (!u[0].tenant_id) return res.status(400).json({ error: 'Doctor must belong to an organization first' });
  const tenantId = u[0].tenant_id;

  await pool.query(
    `INSERT INTO doctor_profiles (tenant_id, user_id, department, specialty)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, user_id)
       DO UPDATE SET department = EXCLUDED.department, specialty = EXCLUDED.specialty, updated_at = NOW()`,
    [tenantId, userId, department, specialty]
  );
  res.json({ profile: { user_id: userId, tenant_id: tenantId, department, specialty } });
};

// DELETE /api/admin/orgs/:id — remove an org and ALL its users + data.
exports.deleteOrg = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // users.tenant_id is ON DELETE SET NULL, so delete the org's users explicitly.
    await client.query('DELETE FROM users WHERE tenant_id = $1', [req.params.id]);
    // Tenant delete cascades agent_definitions, hr_*, tenant_settings, credits, etc.
    const { rowCount } = await client.query('DELETE FROM tenants WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    if (!rowCount) return res.status(404).json({ error: 'Organization not found' });
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// PATCH /api/admin/orgs/:id/model — set which model the org's agents run on
// (a Claude catalog id, or an on-prem model like 'sarvam-105b'). Empty = default.
exports.setOrgModel = async (req, res) => {
  const model = (req.body && req.body.model) ? String(req.body.model) : null;
  await Settings.set(req.params.id, 'llm', model ? { model } : {});
  res.json({ org: { id: Number(req.params.id), llm_model: model } });
};

// PATCH /api/admin/orgs/:id — set an org's industry/workspace
exports.setOrgIndustry = async (req, res) => {
  let { industry } = req.body ?? {};
  if (industry === '' || industry === undefined) industry = null;
  if (industry !== null && !ALLOWED_INDUSTRIES.has(industry)) {
    return res.status(400).json({
      error: `Unsupported industry "${industry}". Allowed: ${[...ALLOWED_INDUSTRIES].join(', ')} (or empty to clear).`,
    });
  }
  const { rows } = await pool.query(
    `UPDATE tenants SET industry = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, name, industry`,
    [industry, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Organization not found' });
  res.json({ org: rows[0] });
};

// POST /api/admin/orgs — create an organization (tenant)
exports.createOrg = async (req, res) => {
  let { name, industry } = req.body ?? {};
  name = String(name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'Organization name is required' });
  if (industry === '' || industry === undefined) industry = null;
  if (industry !== null && !ALLOWED_INDUSTRIES.has(industry)) {
    return res.status(400).json({
      error: `Unsupported industry "${industry}". Allowed: ${[...ALLOWED_INDUSTRIES].join(', ')} (or empty).`,
    });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO tenants (name, industry, kind) VALUES ($1, $2, 'org')
       RETURNING id, name, industry, created_at`,
      [name, industry]
    );
    res.status(201).json({ org: { ...rows[0], user_count: 0 } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An organization with that name already exists' });
    }
    throw err;
  }
};

// GET /api/admin/agent-templates — platform templates (tenant_id IS NULL)
exports.listTemplates = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM agent_definitions WHERE tenant_id IS NULL ORDER BY key'
  );
  res.json({ templates: rows });
};

// POST /api/admin/agent-templates — create a platform template
exports.createTemplate = async (req, res) => {
  const { key, name } = req.body ?? {};
  if (!key?.trim() || !name?.trim()) {
    return res.status(400).json({ error: 'key and name are required' });
  }
  const template = await AgentDefinition.create({ ...req.body, tenant_id: null });
  res.status(201).json({ template });
};

// PUT /api/admin/agent-templates/:id — update a platform template
exports.updateTemplate = async (req, res) => {
  const existing = await AgentDefinition.findById(req.params.id);
  if (!existing || existing.tenant_id !== null) {
    return res.status(404).json({ error: 'Template not found' });
  }
  const template = await AgentDefinition.update(req.params.id, req.body);
  res.json({ template });
};

exports.ALLOWED_INDUSTRIES = ALLOWED_INDUSTRIES;
