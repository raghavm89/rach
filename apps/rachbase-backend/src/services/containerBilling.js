'use strict';

/**
 * Container billing — the pay-to-online money path for Pro (shared) services.
 *
 * A service IS the billable container. Bringing it online costs
 * `proPricing.deployChargeCents(existingBillableContainers, computeSize)`:
 *   - the first (app) container at nano is included in the base → $0 (no checkout),
 *   - each additional container is $10, plus the compute-size delta (micro +$10, small +$20).
 * Amounts come from the pricing authority (`@rach/billing`); the client never sends one.
 *
 * `createDeployOrder` (Razorpay) and `billingCurrencyFor` (DB) are isolated so the
 * controller stays thin and the amount logic is pure + testable. `verifyPayment` is
 * the same HMAC scheme as the rest of billing.
 */

const { pool } = require('@rach/core');
const { razorpay, proPricing, paymentSecurity } = require('@rach/billing');

// The tenant's billing currency. LOCKED once the tenant has subscribed: the stored
// `tenants.billing_currency` (set at base-subscription activation, migration 130) wins, so a
// later billing-address edit can neither mix an INR base with USD containers nor re-price
// existing customers — a currency change is a support operation, not an address edit
// (go-live audit M1). Unlocked tenants (never subscribed) resolve from the address:
// India → INR, else USD. India is signalled by the billing-address country (GSTIN is
// optional — individuals rarely have one), with a GSTIN also counting as an India signal.
async function billingCurrencyFor(tenantId) {
  const { rows: t } = await pool.query(
    `SELECT billing_currency FROM tenants WHERE id = $1`, [tenantId]);
  const locked = t[0]?.billing_currency;
  if (locked === 'INR' || locked === 'USD') return locked;

  const { rows } = await pool.query(
    `SELECT 1 FROM users
       WHERE tenant_id = $1
         AND ( (gstin IS NOT NULL AND btrim(gstin) <> '')
               OR lower(btrim(coalesce(billing_address->>'country', ''))) IN ('india', 'in') )
       LIMIT 1`,
    [tenantId],
  );
  return rows.length ? 'INR' : 'USD';
}

// Lock the tenant's currency (first paid activation). Idempotent; never overwrites a lock.
async function lockBillingCurrency(tenantId, currency) {
  if (currency !== 'INR' && currency !== 'USD') return;
  await pool.query(
    `UPDATE tenants SET billing_currency = $2, updated_at = NOW()
      WHERE id = $1 AND billing_currency IS NULL`,
    [tenantId, currency],
  );
}

// The pay-to-online amount for the container being brought online (0 = within allowance).
function deployAmountCents({ tier = proPricing.DEFAULT_TIER, existingCount, size, currency }) {
  return proPricing.deployChargeCents(tier, existingCount, size, currency);
}

// Create a Razorpay order for a container's pay-to-online charge. Amount computed
// server-side; caller must have already confirmed amountCents > 0.
async function createDeployOrder({ tenantId, serviceId, amountCents, currency }) {
  return razorpay.orders.create({
    amount: amountCents,
    currency,
    receipt: `svc_${serviceId}_${Date.now()}`,
    notes: { kind: 'container_deploy', tenant_id: String(tenantId), service_id: String(serviceId) },
  });
}

// Verify a Razorpay checkout callback signature (constant-time). Delegates to the shared
// paymentSecurity implementation so there is exactly ONE HMAC scheme and NO empty-key fallback
// (the previous `RAZORPAY_KEY_SECRET || ''` made every signature verify against an empty key when
// the env var was missing). Prefer `paymentVerify.assertOrderPaid` — it also confirms the money
// actually moved. Retained only for callers that just need the boolean signature check.
function verifyPayment({ orderId, paymentId, signature }) {
  try {
    paymentSecurity.verifyOrderPayment({
      razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature,
    });
    return true;
  } catch {
    return false;
  }
}

module.exports = { billingCurrencyFor, lockBillingCurrency, deployAmountCents, createDeployOrder, verifyPayment };
