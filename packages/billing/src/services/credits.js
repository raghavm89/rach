'use strict';

/**
 * Shared credit / metering service.
 *
 * Extracted from the RachDev agentController so BOTH the RachBase deploy agent
 * and the RachDev LLM gateway spend against one balance/ledger. SQL/behavior is
 * unchanged from the original inline implementation.
 *
 * Tables: tenant_credits (balance per tenant), credit_transactions (ledger).
 */

const { pool } = require('@rach/core');

// Credit packs (USD → credits). Kept here as the single source of truth.
const CREDIT_PACKS = [
  { id: 'starter', label: 'Starter', price_usd: 5,  credits: 500  },
  { id: 'plus',    label: 'Plus',    price_usd: 10, credits: 1100 },
  { id: 'pro',     label: 'Pro',     price_usd: 25, credits: 3000 },
  { id: 'max',     label: 'Max',     price_usd: 50, credits: 7000 },
];

// Tokens per credit (metering granularity).
const TOKENS_PER_CREDIT = 1000;

async function getOrCreateBalance(tenantId) {
  await pool.query(
    `INSERT INTO tenant_credits (tenant_id, balance) VALUES ($1, 0)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId]
  );
  const { rows } = await pool.query(
    'SELECT balance FROM tenant_credits WHERE tenant_id = $1',
    [tenantId]
  );
  return rows[0]?.balance ?? 0;
}

async function deductCredits(tenantId, userId, tokensUsed, description) {
  const credits = Math.ceil(tokensUsed / TOKENS_PER_CREDIT);
  await pool.query(
    `UPDATE tenant_credits SET balance = balance - $1, updated_at = NOW()
     WHERE tenant_id = $2`,
    [credits, tenantId]
  );
  await pool.query(
    `INSERT INTO credit_transactions
       (tenant_id, user_id, type, amount, description, tokens_used)
     VALUES ($1, $2, 'usage', $3, $4, $5)`,
    [tenantId, userId, -credits, description, tokensUsed]
  );
  return credits;
}

/**
 * Add purchased credits and record the ledger entry.
 * Extracted from verifyPurchase — used after a payment is verified.
 */
async function addCredits(tenantId, userId, credits, {
  description,
  razorpayOrderId = null,
  razorpayPaymentId = null,
} = {}) {
  await getOrCreateBalance(tenantId);
  await pool.query(
    `UPDATE tenant_credits SET balance = balance + $1, updated_at = NOW()
     WHERE tenant_id = $2`,
    [credits, tenantId]
  );
  await pool.query(
    `INSERT INTO credit_transactions
       (tenant_id, user_id, type, amount, description, razorpay_order_id, razorpay_payment_id)
     VALUES ($1, $2, 'purchase', $3, $4, $5, $6)`,
    [tenantId, userId, credits, description, razorpayOrderId, razorpayPaymentId]
  );
  return getOrCreateBalance(tenantId);
}

module.exports = {
  CREDIT_PACKS,
  TOKENS_PER_CREDIT,
  getOrCreateBalance,
  deductCredits,
  addCredits,
};
