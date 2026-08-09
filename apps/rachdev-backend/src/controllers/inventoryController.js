'use strict';

const { pool } = require('@rach/core');
const { parsePrescription, suggestReorder, buildAlertMessage } = require('../services/inventory');

const withLow = (r) => ({ ...r, low: r.quantity <= r.reorder_threshold });

// GET /api/inventory/stock
exports.listStock = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, drug, unit, quantity, reorder_threshold, updated_at
       FROM drug_stock WHERE tenant_id = $1 ORDER BY lower(drug)`,
    [req.user.tenant_id]
  );
  res.json({ stock: rows.map(withLow) });
};

// POST /api/inventory/stock — add or update a drug (quantity + threshold + unit)
exports.upsertStock = async (req, res) => {
  const { drug, unit, quantity, reorder_threshold } = req.body ?? {};
  if (!drug || !String(drug).trim()) return res.status(400).json({ error: 'drug is required' });
  const qty = Math.max(0, parseInt(quantity, 10) || 0);
  const thr = Math.max(0, parseInt(reorder_threshold, 10) || 0);

  const { rows } = await pool.query(
    `INSERT INTO drug_stock (tenant_id, drug, unit, quantity, reorder_threshold)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, lower(drug)) DO UPDATE
       SET unit = EXCLUDED.unit, quantity = EXCLUDED.quantity,
           reorder_threshold = EXCLUDED.reorder_threshold, updated_at = NOW()
     RETURNING *`,
    [req.user.tenant_id, String(drug).trim(), (unit || 'unit'), qty, thr]
  );
  res.status(201).json({ item: withLow(rows[0]) });
};

// POST /api/inventory/dispense — an approved prescription consumes stock; alert if low.
// Body: { drug, qty }  OR  { prescription: "Metformin 500mg #30" }
exports.dispense = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let drug = req.body?.drug;
    let qty = parseInt(req.body?.qty, 10);

    if ((!drug || Number.isNaN(qty)) && req.body?.prescription) {
      const { rows: names } = await client.query(
        'SELECT drug FROM drug_stock WHERE tenant_id = $1', [req.user.tenant_id]
      );
      const parsed = parsePrescription(req.body.prescription, names.map((n) => n.drug));
      drug = drug || parsed.drug;
      qty = Number.isNaN(qty) ? parsed.qty : qty;
    }
    qty = Math.max(1, parseInt(qty, 10) || 1);
    if (!drug) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Could not determine the drug to dispense' }); }

    const { rows: found } = await client.query(
      'SELECT * FROM drug_stock WHERE tenant_id = $1 AND lower(drug) = lower($2) FOR UPDATE',
      [req.user.tenant_id, String(drug).trim()]
    );
    if (!found.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: `"${drug}" is not in the formulary` }); }
    const item = found[0];

    const newQty = Math.max(0, item.quantity - qty);
    const { rows: upd } = await client.query(
      'UPDATE drug_stock SET quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [newQty, item.id]
    );
    await client.query(
      `INSERT INTO stock_transactions (tenant_id, drug_stock_id, drug, delta, reason, created_by)
       VALUES ($1, $2, $3, $4, 'dispense', $5)`,
      [req.user.tenant_id, item.id, item.drug, -qty, req.user.id]
    );

    let alert = null;
    if (newQty <= item.reorder_threshold) {
      const { rows: openA } = await client.query(
        `SELECT * FROM reorder_alerts WHERE drug_stock_id = $1 AND status = 'open' LIMIT 1`, [item.id]
      );
      if (openA.length) {
        alert = openA[0];
      } else {
        const qtySuggested = suggestReorder(newQty, item.reorder_threshold);
        const message = buildAlertMessage({
          drug: item.drug, quantity: newQty, unit: item.unit,
          threshold: item.reorder_threshold, qty_suggested: qtySuggested,
        });
        const { rows: a } = await client.query(
          `INSERT INTO reorder_alerts (tenant_id, drug_stock_id, drug, quantity, qty_suggested, message)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [req.user.tenant_id, item.id, item.drug, newQty, qtySuggested, message]
        );
        alert = a[0];
      }
    }

    await client.query('COMMIT');
    res.json({ item: withLow(upd[0]), alert });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// POST /api/inventory/restock — add stock; auto-resolve open alerts once above threshold
exports.restock = async (req, res) => {
  const { drug } = req.body ?? {};
  const qty = Math.max(1, parseInt(req.body?.qty, 10) || 0);
  if (!drug) return res.status(400).json({ error: 'drug is required' });

  const { rows: found } = await pool.query(
    'SELECT * FROM drug_stock WHERE tenant_id = $1 AND lower(drug) = lower($2)',
    [req.user.tenant_id, String(drug).trim()]
  );
  if (!found.length) return res.status(404).json({ error: 'Drug not found' });
  const item = found[0];
  const newQty = item.quantity + qty;

  const { rows: upd } = await pool.query(
    'UPDATE drug_stock SET quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [newQty, item.id]
  );
  await pool.query(
    `INSERT INTO stock_transactions (tenant_id, drug_stock_id, drug, delta, reason, created_by)
     VALUES ($1, $2, $3, $4, 'restock', $5)`,
    [req.user.tenant_id, item.id, item.drug, qty, req.user.id]
  );
  if (newQty > item.reorder_threshold) {
    await pool.query(
      `UPDATE reorder_alerts SET status = 'ordered', resolved_by = $1, resolved_at = NOW()
       WHERE drug_stock_id = $2 AND status = 'open'`,
      [req.user.id, item.id]
    );
  }
  res.json({ item: withLow(upd[0]) });
};

// GET /api/inventory/alerts
exports.listAlerts = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM reorder_alerts WHERE tenant_id = $1
     ORDER BY (status = 'open') DESC, created_at DESC LIMIT 100`,
    [req.user.tenant_id]
  );
  res.json({ alerts: rows });
};

// POST /api/inventory/alerts/:id/resolve — { status: 'ordered' | 'dismissed' }
exports.resolveAlert = async (req, res) => {
  const status = ['ordered', 'dismissed'].includes(req.body?.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: "status must be 'ordered' or 'dismissed'" });
  const { rows } = await pool.query(
    `UPDATE reorder_alerts SET status = $1, resolved_by = $2, resolved_at = NOW()
     WHERE id = $3 AND tenant_id = $4 AND status = 'open' RETURNING *`,
    [status, req.user.id, req.params.id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Open alert not found' });
  res.json({ alert: rows[0] });
};
