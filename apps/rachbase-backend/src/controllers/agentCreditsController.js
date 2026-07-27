'use strict';

/**
 * Agent credits — the BILLING half of /api/agent, served by rachbase-backend
 * (where all other billing lives: payments, invoices, plans, cart).
 *
 * Logic is entirely reused from the shared @rach/billing package (`credits`,
 * `purchase`) against the shared `agent_credits` / `credit_transactions` tables,
 * so this is the same money path rachdev-backend uses — one balance per tenant,
 * idempotent purchases. Only the AI runtime (chat / sessions / run-command)
 * stays in rachdev-backend, which needs @rach/llm.
 *
 * Every handler is tenant-scoped via req.user.tenant_id (never client input).
 */

const { pool } = require('@rach/core');
const { credits, purchase } = require('@rach/billing');

// GET /api/agent/credits
exports.getCredits = async (req, res) => {
  const balance = await credits.getOrCreateBalance(req.user.tenant_id);
  res.json({ balance, packs: credits.CREDIT_PACKS });
};

// POST /api/agent/credits/purchase
exports.purchaseCredits = async (req, res) => {
  const { pack_id, billing_country } = req.body;
  let result;
  try {
    result = await purchase.createCreditPurchase({
      user: req.user,
      packId: pack_id,
      billingCountry: billing_country,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    throw err;
  }
  const { pack, billing, razorpay: rz } = result;
  res.json({
    order_id:        rz.order_id,
    amount:          billing.amountMinor,
    currency:        billing.currency,
    razorpay_key_id: rz.key_id,
    pack,
    fx_rate:         billing.fxRate,
  });
};

// POST /api/agent/credits/verify
exports.verifyPurchase = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, pack_id, billing } = req.body;
  let result;
  try {
    result = await purchase.verifyCreditPurchase({
      user: req.user,
      packId: pack_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      billing: billing || {},
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    throw err;
  }
  res.json({
    success: true,
    credits_added: result.pack.credits,
    balance: result.balance,
    invoice: result.invoice?.ok
      ? { number: result.invoice.invoice.invoice_number, emailed: result.invoice.emailed }
      : null,
  });
};

// GET /api/agent/usage
exports.getUsageSummary = async (req, res) => {
  const balance = await credits.getOrCreateBalance(req.user.tenant_id);
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'purchase' THEN amount ELSE 0 END), 0) AS total_purchased,
       COALESCE(SUM(CASE WHEN type = 'usage'    THEN ABS(amount) ELSE 0 END), 0) AS total_used,
       COALESCE(SUM(CASE WHEN type = 'usage'    THEN COALESCE(tokens_used, 0) ELSE 0 END), 0) AS total_tokens
     FROM credit_transactions WHERE tenant_id = $1`,
    [req.user.tenant_id]
  );
  res.json({
    balance,
    total_purchased: Number(rows[0].total_purchased),
    total_used:      Number(rows[0].total_used),
    total_tokens:    Number(rows[0].total_tokens),
  });
};

// GET /api/agent/credits/history
exports.getCreditHistory = async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
  const limit  = Math.min(50, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT t.*, u.name AS user_name
     FROM credit_transactions t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.tenant_id = $1
     ORDER BY t.created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.user.tenant_id, limit, offset]
  );
  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*)::int AS total FROM credit_transactions WHERE tenant_id = $1',
    [req.user.tenant_id]
  );
  res.json({ transactions: rows, total: countRows[0].total, page, limit });
};

// GET /api/agent/usage/sessions
exports.getSessionUsage = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       s.id, s.title, s.created_at, s.updated_at,
       COUNT(m.id)::int                       AS message_count,
       COALESCE(SUM(m.tokens_used), 0)::int   AS total_tokens,
       COALESCE(SUM(m.credits_used), 0)::int  AS total_credits
     FROM agent_chat_sessions s
     LEFT JOIN agent_chat_messages m ON m.session_id = s.id
     WHERE s.tenant_id = $1
     GROUP BY s.id
     ORDER BY s.updated_at DESC
     LIMIT 50`,
    [req.user.tenant_id]
  );
  res.json({ sessions: rows });
};
