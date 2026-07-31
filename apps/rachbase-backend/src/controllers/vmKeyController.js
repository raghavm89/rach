'use strict';

/**
 * VM keypair admin endpoints.
 *
 * Flow: a VM order mints `pending` keypairs (public keys emailed to ARKA). When
 * ARKA creates a VM and hands back its details, an admin activates the matching
 * pending key here — linking it to the vm_id and writing the SSH config the
 * terminal/rotation use.
 */

const { pool } = require('@rach/core');
const { sendVmKeyProvisioningEmail } = require('@rach/core').brevo;
const { VmKey } = require('../models/vmKey');
const keyCrypto = require('../services/keyCrypto');

const VMID_RE = /^(qemu|lxc)\/\d+$/;

// GET /api/vm-keys?status=&order_id=
async function listKeys(req, res) {
  const { status, order_id } = req.query;
  const where = [];
  const params = [];
  if (status)   { params.push(status);   where.push(`status = $${params.length}`); }
  if (order_id) { params.push(order_id); where.push(`order_id = $${params.length}`); }
  const sql = `SELECT id, order_id, vm_id, user_id, tenant_id, public_key, fingerprint, ssh_user,
                      status, key_version, created_at, activated_at, rotated_at
               FROM vm_keys ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY created_at DESC LIMIT 500`;
  const { rows } = await pool.query(sql, params);
  res.json({ keys: rows });
}

// POST /api/vm-keys/:id/activate  { vm_id, ip_address, ssh_port? }
// Links a pending key to a real VM and writes its SSH config.
async function activateKey(req, res) {
  const { id } = req.params;
  const { vm_id, ip_address, ssh_port = 22 } = req.body;

  if (!vm_id || !ip_address) {
    return res.status(400).json({ error: 'vm_id and ip_address are required' });
  }
  if (!VMID_RE.test(vm_id)) {
    return res.status(400).json({ error: 'Invalid vm_id — expected qemu/<n> or lxc/<n>' });
  }
  const port = Number(ssh_port) || 22;

  const key = await VmKey.getById(id);
  if (!key) return res.status(404).json({ error: 'Key not found' });
  if (key.status !== 'pending' && key.status !== 'rotating') {
    return res.status(409).json({ error: `Key is '${key.status}', not activatable` });
  }

  const activated = await VmKey.activate(id, vm_id);
  if (!activated) return res.status(409).json({ error: 'Key could not be activated (already linked?)' });

  // Write/refresh the SSH config the terminal + rotation use.
  await pool.query(
    `INSERT INTO vm_ssh_config (vm_id, tenant_id, ip_address, ssh_user, ssh_port)
       VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (vm_id) DO UPDATE
       SET ip_address = EXCLUDED.ip_address,
           ssh_user   = EXCLUDED.ssh_user,
           ssh_port   = EXCLUDED.ssh_port,
           tenant_id  = EXCLUDED.tenant_id,
           updated_at = NOW()`,
    [vm_id, activated.tenant_id, ip_address, activated.ssh_user, port]
  );

  res.json({ message: 'Key activated and SSH config saved', key: activated });
}

// POST /api/vm-keys/reissue  { vm_id }
// Break-glass: mint a fresh keypair for a stranded VM and email ARKA the new
// public key to re-install. Admin activates it once ARKA confirms.
async function reissueKey(req, res) {
  const { vm_id } = req.body;
  if (!vm_id || !VMID_RE.test(vm_id)) {
    return res.status(400).json({ error: 'Valid vm_id is required' });
  }
  if (!keyCrypto.isConfigured()) {
    return res.status(503).json({ error: 'Key encryption not configured (RACHBASE_KEY_ENC_SECRET)' });
  }

  const next = await VmKey.createReplacement(vm_id); // 'rotating'
  const { rows } = await pool.query(
    `SELECT u.name, u.email FROM vm_keys k LEFT JOIN users u ON u.id = k.user_id WHERE k.id = $1`,
    [next.id]
  );
  const cust = rows[0] || {};

  try {
    await sendVmKeyProvisioningEmail({
      orderId      : `reissue-${vm_id}`,
      customerName : cust.name  || 'Customer',
      customerEmail: cust.email || '',
      sshUser      : next.ssh_user || 'ubuntu',
      keys         : [{ fingerprint: next.fingerprint, publicKey: next.public_key }],
    });
  } catch (e) {
    console.error('[vm-keys] reissue email failed:', e.message);
  }

  res.json({
    message: 'Re-issued key; public key emailed to ARKA for re-install. Activate it once installed.',
    key: { id: next.id, vm_id, fingerprint: next.fingerprint, public_key: next.public_key, status: next.status },
  });
}

module.exports = { listKeys, activateKey, reissueKey, _configured: keyCrypto.isConfigured };
