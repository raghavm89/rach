'use strict';

/**
 * Per-user billing cart.
 *
 * The cart is persisted server-side (carts table) so it follows a user across
 * devices and sessions. Items are validated against the shared pricing catalog
 * on write — the client can never store an unknown or non-orderable service.
 *
 * Cart shape: { items: [{ id: string, qty: number, kind: 'service'|'bundle' }] }
 *   service items — id is a catalog service id (vm, disk, lb, ip, db, obs, mon…)
 *   bundle item   — id is a catalog bundle id; at most one, qty always 1.
 *                   (The server prices a bundle OR services, not both combined,
 *                   so the two are checked out on their own tabs.)
 */

const pool = require('@rach/core').pool;
const { getService, getBundle } = require('@rach/billing').catalog;

const MAX_QTY   = 99;
const MAX_LINES = 50;

/**
 * Validate + normalize a raw items array from the client.
 * Drops unknown/non-orderable ids, clamps quantities, merges duplicate services,
 * keeps at most one (valid) bundle. Returns { items } or throws on bad input.
 */
function normalizeItems(raw) {
  if (!Array.isArray(raw)) {
    const err = new Error('items must be an array'); err.status = 400; throw err;
  }
  if (raw.length > MAX_LINES) {
    const err = new Error('Too many items in cart'); err.status = 400; throw err;
  }

  const services = new Map(); // id → qty
  let bundleId = null;        // last valid bundle wins

  for (const entry of raw) {
    const id   = String(entry?.id ?? '').trim();
    const kind = entry?.kind === 'bundle' ? 'bundle' : 'service';
    if (!id) continue;

    if (kind === 'bundle') {
      if (getBundle(id)) bundleId = id;   // skip unknown bundles
      continue;
    }

    const qty = Math.floor(Number(entry?.qty));
    if (!Number.isFinite(qty) || qty < 1) continue;

    const svc = getService(id);
    // Skip unknown, non-orderable, or hidden services — never persist them.
    if (!svc || svc.orderable === false || svc.hidden === true) continue;

    const clamped = Math.min(qty, MAX_QTY);
    services.set(id, Math.min((services.get(id) ?? 0) + clamped, MAX_QTY));
  }

  const items = [...services.entries()].map(([id, qty]) => ({ id, qty, kind: 'service' }));
  if (bundleId) items.push({ id: bundleId, qty: 1, kind: 'bundle' });
  return { items };
}

// GET /api/cart — current user's cart
async function getCart(req, res) {
  const { rows } = await pool.query('SELECT items_json, updated_at FROM carts WHERE user_id = $1', [req.user.id]);
  if (!rows.length) return res.json({ items: [], updatedAt: null });
  // Re-normalize on read so a catalog change (e.g. a service hidden) can't
  // surface a now-invalid line to the UI.
  const { items } = normalizeItems(rows[0].items_json || []);
  res.json({ items, updatedAt: rows[0].updated_at });
}

// PUT /api/cart — replace the current user's cart
async function putCart(req, res) {
  const { items } = normalizeItems(req.body?.items);
  const { rows } = await pool.query(
    `INSERT INTO carts (user_id, items_json, updated_at)
       VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id)
       DO UPDATE SET items_json = EXCLUDED.items_json, updated_at = NOW()
     RETURNING items_json, updated_at`,
    [req.user.id, JSON.stringify(items)]
  );
  res.json({ items: rows[0].items_json, updatedAt: rows[0].updated_at });
}

// DELETE /api/cart — clear the current user's cart
async function clearCart(req, res) {
  await pool.query('DELETE FROM carts WHERE user_id = $1', [req.user.id]);
  res.json({ items: [], updatedAt: null });
}

module.exports = { getCart, putCart, clearCart };
