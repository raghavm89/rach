'use strict';

/**
 * RachDev-side tenant workspace control.
 *
 * A tenant_admin sets their OWN tenant's industry here, which provisions the
 * matching workspace (e.g. 'healthcare' → the clinical workspace). This is
 * deliberately scoped to the caller's own tenant — cross-tenant/system tenant
 * management lives in RachBase and is untouched.
 */

const { pool } = require('@rach/core');

// Industries that map to a live workspace today. Extend as more ship.
const ALLOWED_INDUSTRIES = new Set(['healthcare']);

// GET /api/tenant — the caller's own tenant (id, name, industry)
exports.getMyTenant = async (req, res) => {
  const tid = req.user.tenant_id;
  if (!tid) return res.json({ tenant: null });
  const { rows } = await pool.query(
    'SELECT id, name, industry FROM tenants WHERE id = $1',
    [tid]
  );
  res.json({ tenant: rows[0] ?? null });
};

// PATCH /api/tenant/industry — set the caller's own tenant industry
exports.setIndustry = async (req, res) => {
  const tid = req.user.tenant_id;
  if (!tid) return res.status(400).json({ error: 'No tenant is associated with this account' });

  let { industry } = req.body ?? {};
  if (industry === '' || industry === undefined) industry = null;

  if (industry !== null && !ALLOWED_INDUSTRIES.has(industry)) {
    return res.status(400).json({
      error: `Unsupported industry "${industry}". Allowed: ${[...ALLOWED_INDUSTRIES].join(', ')} (or empty to clear).`,
    });
  }

  const { rows } = await pool.query(
    'UPDATE tenants SET industry = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, industry',
    [industry, tid]
  );
  res.json({ tenant: rows[0] ?? null });
};

exports.ALLOWED_INDUSTRIES = ALLOWED_INDUSTRIES;
