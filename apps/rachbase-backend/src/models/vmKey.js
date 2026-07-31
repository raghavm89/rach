'use strict';

/**
 * Per-VM SSH keypair store. Private keys live encrypted (keyCrypto.seal); they
 * are only ever decrypted in memory, at connect/rotate time, via getActiveForVm.
 */

const { pool } = require('@rach/core');
const keyCrypto = require('../services/keyCrypto');

const PUBLIC_COLS =
  'id, order_id, vm_id, user_id, tenant_id, public_key, fingerprint, ssh_user, status, key_version, created_at, activated_at, rotated_at';

const VmKey = {
  /**
   * Mint a fresh pending keypair (VM not created yet). Returns the row WITHOUT
   * the private key — callers only need the public key (to email ARKA).
   */
  async createPending({ orderId, userId, tenantId, sshUser = 'ubuntu', comment = 'rachbase' }) {
    const { publicKey, privateKey, fingerprint } = keyCrypto.generateKeypair(comment);
    const sealed = keyCrypto.seal(privateKey);
    const { rows } = await pool.query(
      `INSERT INTO vm_keys (order_id, user_id, tenant_id, public_key, private_key_encrypted, fingerprint, ssh_user, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING ${PUBLIC_COLS}`,
      [orderId ?? null, userId ?? null, tenantId ?? null, publicKey, sealed, fingerprint, sshUser]
    );
    return rows[0];
  },

  async listByOrder(orderId) {
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_COLS} FROM vm_keys WHERE order_id = $1 ORDER BY id`, [orderId]
    );
    return rows;
  },

  async getById(id) {
    const { rows } = await pool.query(`SELECT ${PUBLIC_COLS} FROM vm_keys WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  /**
   * Link a pending key to a real VM once ARKA hands it back.
   * Any previously-active key for that vm_id is revoked first (partial unique
   * index allows only one active per vm_id).
   */
  async activate(id, vmId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE vm_keys SET status = 'revoked', rotated_at = NOW()
         WHERE vm_id = $1 AND status = 'active'`, [vmId]
      );
      const { rows } = await client.query(
        `UPDATE vm_keys SET vm_id = $1, status = 'active', activated_at = NOW()
         WHERE id = $2 AND status IN ('pending', 'rotating')
         RETURNING ${PUBLIC_COLS}`, [vmId, id]
      );
      await client.query('COMMIT');
      return rows[0] ?? null;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /** Active key for a VM, WITH the decrypted private key. Null if none. */
  async getActiveForVm(vmId) {
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_COLS}, private_key_encrypted FROM vm_keys
       WHERE vm_id = $1 AND status = 'active' ORDER BY key_version DESC LIMIT 1`, [vmId]
    );
    if (!rows.length) return null;
    const row = rows[0];
    return { ...row, privateKey: keyCrypto.open(row.private_key_encrypted) };
  },

  /** Mint a replacement pending key for an existing VM (rotation / break-glass). */
  async createReplacement(vmId) {
    const cur = await pool.query(
      `SELECT user_id, tenant_id, ssh_user, key_version FROM vm_keys
       WHERE vm_id = $1 AND status = 'active' ORDER BY key_version DESC LIMIT 1`, [vmId]
    );
    const base = cur.rows[0] || {};
    const { publicKey, privateKey, fingerprint } = keyCrypto.generateKeypair(`rachbase:${vmId}`);
    const sealed = keyCrypto.seal(privateKey);
    const { rows } = await pool.query(
      `INSERT INTO vm_keys (vm_id, user_id, tenant_id, public_key, private_key_encrypted, fingerprint, ssh_user, status, key_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'rotating', $8)
       RETURNING ${PUBLIC_COLS}, private_key_encrypted`,
      [vmId, base.user_id ?? null, base.tenant_id ?? null, publicKey, sealed, fingerprint,
       base.ssh_user ?? 'ubuntu', (base.key_version ?? 0) + 1]
    );
    const row = rows[0];
    return { ...row, privateKey };
  },

  /** After a verified rollover: promote the new key, revoke the old. */
  async promoteRotation(newKeyId, vmId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE vm_keys SET status = 'revoked', rotated_at = NOW()
         WHERE vm_id = $1 AND status = 'active'`, [vmId]
      );
      const { rows } = await client.query(
        `UPDATE vm_keys SET status = 'active', activated_at = NOW()
         WHERE id = $1 AND status = 'rotating'
         RETURNING ${PUBLIC_COLS}`, [newKeyId]
      );
      await client.query('COMMIT');
      return rows[0] ?? null;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /** Active keys older than `days` — rotation candidates. */
  async dueForRotation(days) {
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_COLS} FROM vm_keys
       WHERE status = 'active' AND vm_id IS NOT NULL
         AND COALESCE(activated_at, created_at) < NOW() - ($1 || ' days')::interval
       ORDER BY COALESCE(activated_at, created_at) ASC`, [String(days)]
    );
    return rows;
  },

  /** Drop a rotating key that failed to verify (so it doesn't linger). */
  async discard(id) {
    await pool.query(`UPDATE vm_keys SET status = 'revoked', rotated_at = NOW() WHERE id = $1 AND status = 'rotating'`, [id]);
  },
};

module.exports = { VmKey };
