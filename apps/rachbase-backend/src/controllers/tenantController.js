'use strict';

const pool = require('@rach/core').pool;
const asyncHandler = require('@rach/core').asyncHandler;
const { sendTenantTeardownEmail } = require('@rach/core').brevo;

const VMID_RE = /^(qemu|lxc)\/\d+$/;

// Proxmox pool IDs are alphanumeric plus _ . - . Enforcing this on write keeps
// the value safe to interpolate into PromQL selectors downstream (monitoring).
const POOL_RE = /^[A-Za-z0-9_.-]+$/;

/**
 * Normalize + validate an optional pve_pool value from a request body.
 * Returns { ok: true, value } (value is a trimmed string or null) or
 * { ok: false, error }.
 */
function normalizePvePool(raw) {
  const trimmed = raw?.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!POOL_RE.test(trimmed)) {
    return { ok: false, error: 'Invalid pve_pool — only letters, digits, and _ . - are allowed.' };
  }
  return { ok: true, value: trimmed };
}

// ─── Tenant CRUD ───────────────────────────────────────────────────────────

// GET /api/tenants
async function getAllTenants(req, res) {
  // Check whether the pve_pool column exists yet (added in migration 010).
  // This makes the endpoint safe to call both before and after that migration.
  const { rows: cols } = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name='tenants' AND column_name='pve_pool'`
  );
  const hasPvePool = cols.length > 0;

  const { rows } = await pool.query(
    `SELECT t.id, t.name, ${hasPvePool ? 't.pve_pool,' : ''} t.created_at,
            COUNT(u.id)::int AS user_count,
            COUNT(tva.id)::int AS vm_count
     FROM tenants t
     LEFT JOIN users u ON u.tenant_id = t.id
     LEFT JOIN tenant_vm_assignments tva ON tva.tenant_id = t.id
     WHERE t.deleted_at IS NULL
     GROUP BY t.id
     ORDER BY t.id`
  );
  res.json({ tenants: rows });
}

// GET /api/tenants/:id
async function getTenantById(req, res) {
  const { id } = req.params;
  const { rows: cols } = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name='tenants' AND column_name='pve_pool'`
  );
  const hasPvePool = cols.length > 0;

  const { rows } = await pool.query(
    `SELECT t.id, t.name, ${hasPvePool ? 't.pve_pool,' : ''} t.created_at, t.updated_at
     FROM tenants t WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });

  const { rows: vms } = await pool.query(
    `SELECT vm_id, assigned_at FROM tenant_vm_assignments WHERE tenant_id = $1 ORDER BY assigned_at`,
    [id]
  );
  const { rows: users } = await pool.query(
    `SELECT id, name, email, role, created_at FROM users WHERE tenant_id = $1 ORDER BY id`,
    [id]
  );
  res.json({ tenant: rows[0], vms, users });
}

// POST /api/tenants
async function createTenant(req, res) {
  const { name, pve_pool } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const poolCheck = normalizePvePool(pve_pool);
  if (!poolCheck.ok) return res.status(400).json({ error: poolCheck.error });
  try {
    const { rows: cols } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='pve_pool'`
    );
    const hasPvePool = cols.length > 0;
    const { rows } = hasPvePool
      ? await pool.query(
          `INSERT INTO tenants (name, pve_pool) VALUES ($1, $2) RETURNING *`,
          [name.trim(), poolCheck.value]
        )
      : await pool.query(
          `INSERT INTO tenants (name) VALUES ($1) RETURNING *`,
          [name.trim()]
        );
    res.status(201).json({ message: 'Tenant created', tenant: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A tenant with that name already exists' });
    }
    throw err;
  }
}

// PATCH /api/tenants/:id
async function updateTenant(req, res) {
  const { id } = req.params;
  const { name, pve_pool } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const poolCheck = normalizePvePool(pve_pool);
  if (!poolCheck.ok) return res.status(400).json({ error: poolCheck.error });
  try {
    const { rows: cols } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='pve_pool'`
    );
    const hasPvePool = cols.length > 0;
    const { rows } = hasPvePool
      ? await pool.query(
          `UPDATE tenants SET name = $1, pve_pool = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
          [name.trim(), poolCheck.value, id]
        )
      : await pool.query(
          `UPDATE tenants SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
          [name.trim(), id]
        );
    if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ message: 'Tenant updated', tenant: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A tenant with that name already exists' });
    }
    throw err;
  }
}

// DELETE /api/tenants/:id
// Soft-delete + teardown. A hard delete would cascade-destroy the tenant's
// vm_keys (encrypted private keys) and SSH configs, stranding VMs ARKA still
// runs. Instead we: require an explicit name confirmation, mark the tenant
// deleted (rows preserved), revoke its VM keys, and email ARKA to de-provision.
async function deleteTenant(req, res) {
  const { id } = req.params;
  const { confirm } = req.body || {};

  const { rows: trows } = await pool.query(
    'SELECT id, name FROM tenants WHERE id = $1 AND deleted_at IS NULL', [id]
  );
  if (!trows.length) return res.status(404).json({ error: 'Tenant not found' });
  const tenant = trows[0];

  // Two-step confirm: the caller must echo the tenant name.
  if (confirm !== tenant.name) {
    return res.status(400).json({
      error: 'Confirmation required',
      message: `To delete this tenant, send { "confirm": "${tenant.name}" }.`,
    });
  }

  // Collect the VMs that will need ARKA de-provisioning.
  const { rows: vmRows } = await pool.query(
    'SELECT vm_id FROM vm_ssh_config WHERE tenant_id = $1', [id]
  );
  const vmIds = vmRows.map((r) => r.vm_id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE tenants SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
    // Revoke the tenant's VM keys (private keys are retired, not destroyed).
    await client.query(
      `UPDATE vm_keys SET status = 'revoked', rotated_at = NOW()
       WHERE tenant_id = $1 AND status IN ('active','pending','rotating')`, [id]
    );
    // Detach the tenant's users so they can't act under a deleted tenant.
    await client.query(`UPDATE users SET tenant_id = NULL, updated_at = NOW() WHERE tenant_id = $1`, [id]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // Notify ARKA to de-provision the VMs (fire-and-forget).
  if (vmIds.length) {
    sendTenantTeardownEmail({ tenantName: tenant.name, tenantId: tenant.id, vmIds })
      .catch((e) => console.error('[tenants] teardown email failed:', e.message));
  }

  res.json({ message: 'Tenant deleted (soft). VM keys revoked; ARKA notified to de-provision.', vmCount: vmIds.length });
}

// ─── Tenant VM Pool ────────────────────────────────────────────────────────

// GET /api/tenants/:id/vms — list VMs in tenant pool
async function getTenantVMs(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query(
    `SELECT vm_id, assigned_at FROM tenant_vm_assignments WHERE tenant_id = $1 ORDER BY assigned_at`,
    [id]
  );
  res.json({ tenantId: Number(id), vms: rows });
}

// POST /api/tenants/:id/vms — replace tenant VM pool
async function setTenantVMs(req, res) {
  const { id } = req.params;
  const { vmIds } = req.body;

  if (!Array.isArray(vmIds)) {
    return res.status(400).json({ error: 'vmIds must be an array' });
  }
  const invalid = vmIds.filter((v) => !VMID_RE.test(v));
  if (invalid.length) {
    return res.status(400).json({
      error: `Invalid VM IDs: ${invalid.join(', ')}. Expected format: qemu/<n> or lxc/<n>`,
    });
  }

  const { rows: tenantRows } = await pool.query(`SELECT id FROM tenants WHERE id = $1`, [id]);
  if (!tenantRows.length) return res.status(404).json({ error: 'Tenant not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM tenant_vm_assignments WHERE tenant_id = $1`, [id]);
    if (vmIds.length > 0) {
      const values = vmIds.map((vmId, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO tenant_vm_assignments (tenant_id, vm_id) VALUES ${values}`,
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
    `SELECT vm_id, assigned_at FROM tenant_vm_assignments WHERE tenant_id = $1 ORDER BY assigned_at`,
    [id]
  );
  res.json({ message: 'Tenant VM pool updated', tenantId: Number(id), vms: rows });
}

module.exports = {
  getAllTenants:  asyncHandler(getAllTenants),
  getTenantById: asyncHandler(getTenantById),
  createTenant:  asyncHandler(createTenant),
  updateTenant:  asyncHandler(updateTenant),
  deleteTenant:  asyncHandler(deleteTenant),
  getTenantVMs:  asyncHandler(getTenantVMs),
  setTenantVMs:  asyncHandler(setTenantVMs),
};
