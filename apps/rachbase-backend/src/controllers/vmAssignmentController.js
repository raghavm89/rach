'use strict';

const pool         = require('@rach/core').pool;
const asyncHandler = require('@rach/core').asyncHandler;
const { User }     = require('@rach/identity');

const VMID_RE = /^(qemu|lxc)\/\d+$/;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the set of VM IDs that are in a tenant's pool.
 * Used to validate that a tenant_admin only assigns VMs from their pool.
 */
async function getTenantPoolIds(tenantId) {
  const { rows } = await pool.query(
    `SELECT vm_id FROM tenant_vm_assignments WHERE tenant_id = $1`,
    [tenantId]
  );
  return new Set(rows.map((r) => r.vm_id));
}

// ── GET /api/users/:id/vms ────────────────────────────────────────────────────
async function getUserVMs(req, res) {
  const { id } = req.params;
  const caller = req.user;

  // Tenant admins can only look up users in their tenant
  if (caller.role === 'tenant_admin') {
    const target = await User.findById(id);
    if (!target || target.tenant_id !== caller.tenant_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const { rows } = await pool.query(
    `SELECT vm_id, assigned_at FROM user_vm_assignments WHERE user_id = $1 ORDER BY assigned_at`,
    [id]
  );
  res.json({ userId: Number(id), vms: rows });
}

// ── POST /api/users/:id/vms ───────────────────────────────────────────────────
// Replaces all VM assignments for a user.
async function assignVMs(req, res) {
  const { id } = req.params;
  const { vmIds } = req.body;
  const caller = req.user;

  if (!Array.isArray(vmIds)) {
    return res.status(400).json({ error: 'vmIds must be an array' });
  }

  const invalid = vmIds.filter((v) => !VMID_RE.test(v));
  if (invalid.length) {
    return res.status(400).json({
      error: `Invalid VM IDs: ${invalid.join(', ')}. Expected format: qemu/<n> or lxc/<n>`,
    });
  }

  // Fetch the target user
  const target = await User.findById(id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (caller.role === 'tenant_admin') {
    // Must be same tenant
    if (target.tenant_id !== caller.tenant_id) {
      return res.status(403).json({ error: 'Forbidden: user is not in your tenant' });
    }
    // Validate VMs are accessible to this tenant.
    // Skip validation if the tenant uses pool-based scoping (pve_pool) — the pool
    // is the source of truth and tenant_vm_assignments will be empty in that case.
    if (vmIds.length > 0) {
      const { rows: tenantRows } = await pool.query(
        `SELECT pve_pool FROM tenants WHERE id = $1`,
        [caller.tenant_id]
      );
      const usesPvePool = !!tenantRows[0]?.pve_pool;

      if (!usesPvePool) {
        // Explicit assignment mode — verify each VM is in the tenant's assignment list
        const poolIds = await getTenantPoolIds(caller.tenant_id);
        const notInPool = vmIds.filter((v) => !poolIds.has(v));
        if (notInPool.length) {
          return res.status(400).json({
            error: `VMs not assigned to your tenant: ${notInPool.join(', ')}`,
          });
        }
      }
      // Pool-based tenants: trust that the tenant admin picked from their own pool
    }
  }

  // Use a transaction: delete existing, insert new
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_vm_assignments WHERE user_id = $1', [id]);
    if (vmIds.length > 0) {
      const values = vmIds.map((vmId, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO user_vm_assignments (user_id, vm_id) VALUES ${values}`,
        [id, ...vmIds]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await pool.query(
    `SELECT vm_id, assigned_at FROM user_vm_assignments WHERE user_id = $1 ORDER BY assigned_at`,
    [id]
  );
  res.json({ message: 'VM assignments updated', userId: Number(id), vms: rows });
}

// ── DELETE /api/users/:id/vms/:vmId ──────────────────────────────────────────
async function removeVM(req, res) {
  const { id, vmId } = req.params;
  const caller = req.user;
  const decoded = decodeURIComponent(vmId);

  if (!VMID_RE.test(decoded)) {
    return res.status(400).json({ error: 'Invalid vmId format' });
  }

  if (caller.role === 'tenant_admin') {
    const target = await User.findById(id);
    if (!target || target.tenant_id !== caller.tenant_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const { rowCount } = await pool.query(
    'DELETE FROM user_vm_assignments WHERE user_id = $1 AND vm_id = $2',
    [id, decoded]
  );

  if (rowCount === 0) {
    return res.status(404).json({ error: 'VM assignment not found' });
  }

  res.json({ message: 'VM removed from user' });
}

module.exports = {
  getUserVMs: asyncHandler(getUserVMs),
  assignVMs:  asyncHandler(assignVMs),
  removeVM:   asyncHandler(removeVM),
};
