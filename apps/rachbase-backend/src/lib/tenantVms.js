'use strict';

/**
 * Shared VM ↔ tenant ownership check.
 *
 * A VM belongs to a tenant if it is in the tenant's explicit VM assignments OR
 * has an SSH config bound to that tenant (set at key activation). This covers
 * both explicit-assignment and pool-based tenants. Used to stop a tenant from
 * targeting another tenant's VM in deploy / service creation.
 */

const { pool } = require('@rach/core');

const VMID_RE = /^(qemu|lxc)\/\d+$/;

async function vmBelongsToTenant(tenantId, vmId) {
  if (!tenantId || typeof vmId !== 'string' || !VMID_RE.test(vmId)) return false;
  const { rows } = await pool.query(
    `SELECT 1
       WHERE EXISTS (SELECT 1 FROM tenant_vm_assignments WHERE tenant_id = $1 AND vm_id = $2)
          OR EXISTS (SELECT 1 FROM vm_ssh_config        WHERE tenant_id = $1 AND vm_id = $2)`,
    [tenantId, vmId]
  );
  return rows.length > 0;
}

module.exports = { vmBelongsToTenant, VMID_RE };
