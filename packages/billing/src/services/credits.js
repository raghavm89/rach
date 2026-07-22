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

/**
 * Credit packs — the pricing authority for credits, as catalog.json is for
 * services.
 *
 * `price_cents` is authoritative; `price_usd` is kept for display and for the
 * existing API response shape. Never multiply `price_usd` by 100 to get an
 * amount to charge — that is the float path this codebase has been removing.
 */
const CREDIT_PACKS = [
  { id: 'starter', label: 'Starter', price_usd: 5,  price_cents: 500,  credits: 500  },
  { id: 'plus',    label: 'Plus',    price_usd: 10, price_cents: 1000, credits: 1100 },
  { id: 'pro',     label: 'Pro',     price_usd: 25, price_cents: 2500, credits: 3000 },
  { id: 'max',     label: 'Max',     price_usd: 50, price_cents: 5000, credits: 7000 },
];

function getCreditPack(packId) {
  return CREDIT_PACKS.find((p) => p.id === packId) ?? null;
}

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

/**
 * Thrown when a tenant cannot cover a deduction. Callers should surface this
 * as a 402 rather than letting the work proceed.
 */
class InsufficientCreditsError extends Error {
  constructor(balance, required) {
    super(`Insufficient credits: balance ${balance}, required ${required}`);
    this.name = 'InsufficientCreditsError';
    this.code = 'insufficient_credits';
    this.status = 402;
    this.balance = balance;
    this.required = required;
  }
}

/**
 * Deduct credits for usage.
 *
 * Two problems fixed here:
 *
 *   1. The UPDATE had no balance guard, so a tenant at zero kept consuming and
 *      the balance went negative — free usage indefinitely.
 *   2. The balance update and the ledger insert were separate statements with
 *      no transaction, so a failure between them left the balance and the
 *      ledger permanently disagreeing.
 *
 * @param {boolean} [opts.allowOverdraft=false] — for trusted internal callers
 *        that must not fail mid-operation. Still recorded in the ledger.
 * @throws {InsufficientCreditsError}
 */
async function deductCredits(tenantId, userId, tokensUsed, description, { allowOverdraft = false } = {}) {
  const credits = Math.ceil(tokensUsed / TOKENS_PER_CREDIT);
  if (credits <= 0) return 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the row so concurrent deductions can't both read the same balance
    // and each conclude there is enough.
    const { rows: locked } = await client.query(
      'SELECT balance FROM tenant_credits WHERE tenant_id = $1 FOR UPDATE',
      [tenantId]
    );
    const balance = locked[0]?.balance ?? 0;

    if (!allowOverdraft && balance < credits) {
      await client.query('ROLLBACK');
      throw new InsufficientCreditsError(balance, credits);
    }

    await client.query(
      `UPDATE tenant_credits SET balance = balance - $1, updated_at = NOW()
       WHERE tenant_id = $2`,
      [credits, tenantId]
    );
    await client.query(
      `INSERT INTO credit_transactions
         (tenant_id, user_id, type, amount, description, tokens_used)
       VALUES ($1, $2, 'usage', $3, $4, $5)`,
      [tenantId, userId, -credits, description, tokensUsed]
    );

    await client.query('COMMIT');
    return credits;
  } catch (err) {
    if (!(err instanceof InsufficientCreditsError)) {
      await client.query('ROLLBACK').catch(() => {});
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Non-throwing check for callers that want to gate before doing work. */
async function hasSufficientCredits(tenantId, tokensUsed) {
  const required = Math.ceil(tokensUsed / TOKENS_PER_CREDIT);
  const balance = await getOrCreateBalance(tenantId);
  return { ok: balance >= required, balance, required };
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
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new TypeError(`addCredits requires a positive integer, received: ${credits}`);
  }

  await getOrCreateBalance(tenantId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Idempotency: a webhook retry for the same payment must not double-credit.
    if (razorpayPaymentId) {
      const { rows: dupe } = await client.query(
        `SELECT id FROM credit_transactions
          WHERE razorpay_payment_id = $1 AND type = 'purchase' LIMIT 1`,
        [razorpayPaymentId]
      );
      if (dupe.length) {
        await client.query('ROLLBACK');
        console.log(`[credits] purchase ${razorpayPaymentId} already credited — skipping`);
        return getOrCreateBalance(tenantId);
      }
    }

    await client.query(
      `UPDATE tenant_credits SET balance = balance + $1, updated_at = NOW()
       WHERE tenant_id = $2`,
      [credits, tenantId]
    );
    await client.query(
      `INSERT INTO credit_transactions
         (tenant_id, user_id, type, amount, description, razorpay_order_id, razorpay_payment_id)
       VALUES ($1, $2, 'purchase', $3, $4, $5, $6)`,
      [tenantId, userId, credits, description, razorpayOrderId, razorpayPaymentId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  return getOrCreateBalance(tenantId);
}

module.exports = {
  CREDIT_PACKS,
  TOKENS_PER_CREDIT,
  InsufficientCreditsError,
  getCreditPack,
  getOrCreateBalance,
  hasSufficientCredits,
  deductCredits,
  addCredits,
};
