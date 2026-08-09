'use strict';

const pool = require('../config/db');

/**
 * Hr — tenant-scoped read/seed for the HR vertical data layer (migration 053).
 * Each entity table holds the full domain object as JSONB keyed by ext_id, so
 * `list` returns objects in exactly the shape the HR screens render.
 */

// entity → table. Whitelist: the entity name never reaches SQL directly.
const TABLES = {
  // Layer 1 — Hire
  requisitions: 'hr_requisitions',
  applications: 'hr_applications',
  candidates: 'hr_candidates',
  approvals: 'hr_approvals',
  interviews: 'hr_interviews',
  offers: 'hr_offers',
  audit: 'hr_audit_events',
  // Layers 2–4 — Onboard · Operate · Discover (migration 080)
  employees: 'hr_employees',
  onboarding: 'hr_onboarding',
  probation: 'hr_probation',
  leave: 'hr_leave_requests',
  leave_balances: 'hr_leave_balances',
  payslips: 'hr_payslips',
  letters: 'hr_letters',
  tickets: 'hr_tickets',
  review_cycles: 'hr_review_cycles',
  review_evals: 'hr_review_evals',
  partnerships: 'hr_partnerships',
  holidays: 'hr_holidays',
  announcements: 'hr_announcements',
};

function tableFor(entity) {
  const t = TABLES[entity];
  if (!t) throw new Error(`Unknown HR entity: ${entity}`);
  return t;
}

const Hr = {
  ENTITIES: Object.keys(TABLES),

  /** One record by business id (ext_id) for a tenant. */
  async getOne(entity, tenantId, extId) {
    const { rows } = await pool.query(
      `SELECT data FROM ${tableFor(entity)} WHERE tenant_id = $1 AND ext_id = $2`,
      [tenantId, String(extId)]
    );
    return rows[0] ? rows[0].data : null;
  },

  /** Delete one record by ext_id. Returns true if a row was removed. */
  async remove(entity, tenantId, extId) {
    const { rowCount } = await pool.query(
      `DELETE FROM ${tableFor(entity)} WHERE tenant_id = $1 AND ext_id = $2`,
      [tenantId, String(extId)]
    );
    return rowCount > 0;
  },

  /** All rows of one entity for a tenant, as the stored domain objects. */
  async list(entity, tenantId) {
    const { rows } = await pool.query(
      `SELECT data FROM ${tableFor(entity)} WHERE tenant_id = $1 ORDER BY id`,
      [tenantId]
    );
    return rows.map((r) => r.data);
  },

  /** Rows of one entity for a tenant whose data.employeeId matches. */
  async byEmployee(entity, tenantId, employeeId) {
    const { rows } = await pool.query(
      `SELECT data FROM ${tableFor(entity)} WHERE tenant_id = $1 AND data->>'employeeId' = $2 ORDER BY id`,
      [tenantId, String(employeeId)]
    );
    return rows.map((r) => r.data);
  },

  /**
   * Read-modify-write a single record: merge a shallow patch into the stored
   * object and persist. Nested structures should be mutated by the caller and
   * written back via `create` (upsert) instead.
   */
  async update(entity, tenantId, extId, patch = {}) {
    const current = await this.getOne(entity, tenantId, extId);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id };
    return this.create(entity, tenantId, next);
  },

  /**
   * Next letter serial for a tenant: HR/<year>/<zero-padded sequence>.
   * Sequence is the tenant's letter count + a base offset so it never collides
   * with the seeded serials.
   */
  async nextSerial(tenantId, prefix = 'HR') {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ${tableFor('letters')} WHERE tenant_id = $1`,
      [tenantId]
    );
    const seq = 200 + rows[0].n + 1;
    return `${prefix}/${new Date().getFullYear()}/${String(seq).padStart(4, '0')}`;
  },

  /** Insert one domain object for a tenant. Generates ext_id if the object has none. */
  async create(entity, tenantId, obj = {}) {
    const table = tableFor(entity);
    const extId = obj.id || `${entity.slice(0, 3).toUpperCase()}-${Date.now()}`;
    const withId = { ...obj, id: extId };
    const { rows } = await pool.query(
      `INSERT INTO ${table} (tenant_id, ext_id, data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (tenant_id, ext_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
       RETURNING data`,
      [tenantId, extId, JSON.stringify(withId)]
    );
    return rows[0].data;
  },

  /** Count per entity for a tenant (used by the dashboard summary). */
  async counts(tenantId) {
    const out = {};
    for (const entity of Object.keys(TABLES)) {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM ${tableFor(entity)} WHERE tenant_id = $1`,
        [tenantId]
      );
      out[entity] = rows[0].n;
    }
    return out;
  },

  /**
   * Idempotently seed a tenant from demo datasets.
   * @param {number} tenantId
   * @param {Record<string, object[]>} datasets  keyed by entity (requisitions, ...)
   * @returns {Record<string, number>} rows written per entity
   */
  async seedFromDemo(tenantId, datasets) {
    const written = {};
    for (const [entity, items] of Object.entries(datasets)) {
      if (!TABLES[entity] || !Array.isArray(items)) continue;
      const table = tableFor(entity);
      let n = 0;
      for (const obj of items) {
        const extId = obj.id;
        if (!extId) continue;
        await pool.query(
          `INSERT INTO ${table} (tenant_id, ext_id, data)
           VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (tenant_id, ext_id)
           DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [tenantId, String(extId), JSON.stringify(obj)]
        );
        n += 1;
      }
      written[entity] = n;
    }
    return written;
  },
};

module.exports = Hr;
