'use strict';

/**
 * Tenant suspension state (contract §9.10). A tenant is ACTIVE when `suspend_mode` is NULL,
 * else suspended in one of three modes. ANY suspended mode blocks product mutations
 * (deploy/update/delete); the mode also drives what the site reconciler does to routing/runtime.
 */

const { pool } = require('@rach/core');

const SUSPEND_MODES = Object.freeze(['MUTATIONS_BLOCKED', 'WORKLOADS_STOPPED', 'SECURITY_ISOLATED']);
const isValidMode = (m) => SUSPEND_MODES.includes(m);

async function getSuspendMode(tenantId) {
  if (tenantId == null) return null;
  const { rows } = await pool.query('SELECT suspend_mode FROM tenants WHERE id = $1', [tenantId]);
  return rows[0]?.suspend_mode ?? null;
}

async function setSuspendMode(tenantId, mode) {
  await pool.query('UPDATE tenants SET suspend_mode = $2, updated_at = NOW() WHERE id = $1', [tenantId, mode || null]);
}

// Throws a 409 if the tenant is suspended (used to gate every product mutation).
async function assertActive(tenantId) {
  const mode = await getSuspendMode(tenantId);
  if (mode) {
    const e = new Error(`Tenant is suspended (${mode}). Resume it before making changes.`);
    e.status = 409;
    e.code = 'TENANT_SUSPENDED';
    throw e;
  }
}

module.exports = { SUSPEND_MODES, isValidMode, getSuspendMode, setSuspendMode, assertActive };
