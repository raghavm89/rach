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
  { id: 'starter', label: 'Starter', price_usd: 5,  price_cents: 500,  credits: 150  },
  { id: 'plus',    label: 'Plus',    price_usd: 10, price_cents: 1000, credits: 400  },
  { id: 'pro',     label: 'Pro',     price_usd: 25, price_cents: 2500, credits: 1500 },
  { id: 'max',     label: 'Max',     price_usd: 50, price_cents: 5000, credits: 3500 },
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
 * Reserve credits BEFORE doing metered work (reserve → settle pattern).
 *
 * This is the atomic gate for metered LLM calls: it deducts the worst-case
 * credits up front under a row lock, so two concurrent calls can't both read the
 * same balance and each conclude there is enough (the TOCTOU race). The response
 * is generated only after the reservation succeeds, and `settleReservation`
 * later reconciles the reservation down to actual usage (refunding the unused
 * remainder). If the work fails before producing output, call
 * `releaseReservation` to refund the whole hold.
 *
 * Returns the ledger row id so the caller can settle/release it.
 * @throws {InsufficientCreditsError}
 */
async function reserveCredits(tenantId, userId, creditAmount, description) {
  const amount = Math.max(1, Math.ceil(creditAmount));

  await getOrCreateBalance(tenantId); // ensure the row exists for FOR UPDATE

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: locked } = await client.query(
      'SELECT balance FROM tenant_credits WHERE tenant_id = $1 FOR UPDATE',
      [tenantId]
    );
    const balance = locked[0]?.balance ?? 0;

    if (balance < amount) {
      await client.query('ROLLBACK');
      throw new InsufficientCreditsError(balance, amount);
    }

    await client.query(
      `UPDATE tenant_credits SET balance = balance - $1, updated_at = NOW()
       WHERE tenant_id = $2`,
      [amount, tenantId]
    );
    const { rows } = await client.query(
      `INSERT INTO credit_transactions
         (tenant_id, user_id, type, amount, description, tokens_used)
       VALUES ($1, $2, 'usage', $3, $4, NULL)
       RETURNING id`,
      [tenantId, userId, -amount, description]
    );

    await client.query('COMMIT');
    return { id: rows[0].id, credits: amount };
  } catch (err) {
    if (!(err instanceof InsufficientCreditsError)) {
      await client.query('ROLLBACK').catch(() => {});
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reconcile a reservation to ACTUAL usage. Rewrites the reservation's ledger row
 * in place (one authoritative row per call — keeps the ledger and any per-message
 * accounting in agreement) and refunds the unused credits. If actual usage
 * somehow exceeds the reservation (e.g. large input tokens on top of a capped
 * output), the extra is charged as a recorded overdraft rather than lost.
 *
 * @returns {Promise<{creditsUsed:number, balance:number}>}
 */
async function settleReservation(tenantId, userId, { reservationId, reservedCredits, billedTokens, description }) {
  const actualCredits = Math.max(0, Math.ceil(billedTokens / TOKENS_PER_CREDIT));
  const delta = reservedCredits - actualCredits; // >0 refund, <0 extra charge

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT balance FROM tenant_credits WHERE tenant_id = $1 FOR UPDATE',
      [tenantId]
    );

    if (delta !== 0) {
      await client.query(
        `UPDATE tenant_credits SET balance = balance + $1, updated_at = NOW()
         WHERE tenant_id = $2`,
        [delta, tenantId]
      );
    }
    await client.query(
      `UPDATE credit_transactions
         SET amount = $1, tokens_used = $2, description = COALESCE($3, description)
       WHERE id = $4`,
      [-actualCredits, billedTokens, description ?? null, reservationId]
    );

    const { rows } = await client.query(
      'SELECT balance FROM tenant_credits WHERE tenant_id = $1',
      [tenantId]
    );
    await client.query('COMMIT');
    return { creditsUsed: actualCredits, balance: rows[0]?.balance ?? 0 };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Cancel a reservation and refund the whole hold — used when metered work fails
 * before producing billable output, so a failed call is never charged.
 */
async function releaseReservation(tenantId, reservationId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT amount FROM credit_transactions WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [reservationId, tenantId]
    );
    if (rows.length) {
      const refund = -rows[0].amount; // stored negative → refund positive
      await client.query(
        `UPDATE tenant_credits SET balance = balance + $1, updated_at = NOW()
         WHERE tenant_id = $2`,
        [refund, tenantId]
      );
      await client.query('DELETE FROM credit_transactions WHERE id = $1', [reservationId]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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
  reserveCredits,
  settleReservation,
  releaseReservation,
  addCredits,
};
