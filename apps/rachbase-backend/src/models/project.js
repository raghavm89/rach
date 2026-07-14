'use strict';

const { pool } = require('@rach/core');

function slugify(name) {
  return String(name).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'project';
}

const Project = {
  async countByTenant(tenantId) {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM projects WHERE tenant_id = $1', [tenantId]);
    return rows[0].c;
  },

  async create({ tenantId, name, createdBy }) {
    let slug = slugify(name);
    // ensure unique slug per tenant
    const { rows: dupe } = await pool.query('SELECT 1 FROM projects WHERE tenant_id=$1 AND slug=$2', [tenantId, slug]);
    if (dupe.length) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const { rows } = await pool.query(
      `INSERT INTO projects (tenant_id, name, slug, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenantId, name, slug, createdBy || null]
    );
    const project = rows[0];
    // every project gets a default "production" environment
    await pool.query(
      `INSERT INTO environments (project_id, name, is_default) VALUES ($1, 'production', TRUE)`,
      [project.id]
    );
    return project;
  },

  async listByTenant(tenantId) {
    const { rows } = await pool.query(
      `SELECT p.*,
              (SELECT COUNT(*)::int FROM services s WHERE s.project_id = p.id) AS service_count,
              (SELECT COUNT(*)::int FROM services s WHERE s.project_id = p.id AND s.status = 'online') AS online_count
       FROM projects p WHERE p.tenant_id = $1 ORDER BY p.updated_at DESC`,
      [tenantId]
    );
    return rows;
  },

  async findScoped(id, tenantId) {
    const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return rows[0] || null;
  },

  async findBySlug(slug, tenantId) {
    const { rows } = await pool.query('SELECT * FROM projects WHERE slug = $1 AND tenant_id = $2', [slug, tenantId]);
    return rows[0] || null;
  },
};

const Environment = {
  async listByProject(projectId) {
    const { rows } = await pool.query('SELECT * FROM environments WHERE project_id = $1 ORDER BY is_default DESC, id ASC', [projectId]);
    return rows;
  },
};

const Service = {
  // count all services owned by a tenant (across their projects) — for plan quota
  async countByTenant(tenantId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM services s JOIN projects p ON p.id = s.project_id
       WHERE p.tenant_id = $1`,
      [tenantId]
    );
    return rows[0].c;
  },

  // A new service starts as a DRAFT with 0 paid units — it goes online only after
  // the first unit is paid for (pay-to-online).
  async create({ projectId, name, sourceType, repoFullName, branch, image, computeTarget, vmId, createdBy }) {
    const { rows } = await pool.query(
      `INSERT INTO services
         (project_id, name, source_type, repo_full_name, branch, image, units, status, compute_target, vm_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6, 0, 'draft', $7, $8, $9) RETURNING *`,
      [projectId, name, sourceType || 'github_repo', repoFullName || null, branch || 'main', image || null,
       computeTarget || 'shared', vmId || null, createdBy || null]
    );
    return rows[0];
  },

  // Called after a unit's payment is verified: +1 unit, and bring a draft online.
  async applyActivatedUnit(serviceId) {
    const { rows } = await pool.query(
      `UPDATE services
          SET units = units + 1,
              status = CASE WHEN status IN ('draft','pending_payment') THEN 'online' ELSE status END,
              updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [serviceId]
    );
    return rows[0];
  },

  async setStatus(serviceId, status) {
    await pool.query('UPDATE services SET status = $1, updated_at = NOW() WHERE id = $2', [status, serviceId]);
  },

  async listByProject(projectId) {
    const { rows } = await pool.query('SELECT * FROM services WHERE project_id = $1 ORDER BY id ASC', [projectId]);
    return rows;
  },

  async findScoped(id, tenantId) {
    const { rows } = await pool.query(
      `SELECT s.* FROM services s JOIN projects p ON p.id = s.project_id
       WHERE s.id = $1 AND p.tenant_id = $2`,
      [id, tenantId]
    );
    return rows[0] || null;
  },
};

const ServiceUnit = {
  // How many paid, active units a tenant holds across all their services — for plan quota.
  async countActiveByTenant(tenantId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM service_units WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId]
    );
    return rows[0].c;
  },

  async countActiveByService(serviceId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM service_units WHERE service_id = $1 AND status = 'active'`,
      [serviceId]
    );
    return rows[0].c;
  },

  async createPending({ serviceId, tenantId, orderId, priceCents, currency }) {
    const { rows } = await pool.query(
      `INSERT INTO service_units (service_id, tenant_id, status, price_cents, currency, razorpay_order_id)
       VALUES ($1, $2, 'pending', $3, $4, $5) RETURNING *`,
      [serviceId, tenantId, priceCents ?? 1500, currency || 'USD', orderId]
    );
    return rows[0];
  },

  async findPendingByOrder(orderId) {
    const { rows } = await pool.query(
      `SELECT * FROM service_units WHERE razorpay_order_id = $1 AND status = 'pending'`,
      [orderId]
    );
    return rows[0] || null;
  },

  // Activate a pending unit exactly once (guards double-verify). Returns null if already used.
  async activate({ unitId, paymentId }) {
    const { rows } = await pool.query(
      `UPDATE service_units
          SET status = 'active', razorpay_payment_id = $1, activated_at = NOW()
        WHERE id = $2 AND status = 'pending' RETURNING *`,
      [paymentId, unitId]
    );
    return rows[0] || null;
  },

  async listByService(serviceId) {
    const { rows } = await pool.query(
      'SELECT * FROM service_units WHERE service_id = $1 ORDER BY id ASC', [serviceId]
    );
    return rows;
  },
};

const Deployment = {
  async create({ serviceId, environmentId, commitSha, imageTag, triggeredBy }) {
    const { rows } = await pool.query(
      `INSERT INTO deployments (service_id, environment_id, commit_sha, image_tag, triggered_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [serviceId, environmentId || null, commitSha || null, imageTag || null, triggeredBy || 'manual']
    );
    return rows[0];
  },

  async listByService(serviceId) {
    const { rows } = await pool.query('SELECT * FROM deployments WHERE service_id = $1 ORDER BY created_at DESC LIMIT 50', [serviceId]);
    return rows;
  },
};

module.exports = { Project, Environment, Service, ServiceUnit, Deployment, slugify };
