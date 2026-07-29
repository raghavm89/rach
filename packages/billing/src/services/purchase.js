'use strict';

/**
 * Purchase service — the single owner of money movement.
 *
 * Rachbase previously had two billing implementations. `/api/payments` had the
 * normalized schema and the only webhook but no callers; `/api/expansion` had
 * the callers but wrote everything into one denormalized table the webhook
 * could not see. The result was that expansion subscriptions were write-once:
 * Razorpay charged the customer monthly and Rachbase recorded nothing after the
 * first payment.
 *
 * Everything that takes money now goes through this module, which writes the
 * canonical rows:
 *
 *     plans → subscriptions → orders → payments → invoices
 *
 * Route surfaces are thin. `/api/expansion` keeps its URLs and adds a
 * fulfilment record on top; it does not implement billing itself.
 *
 * All amounts are integer minor units.
 */

const { pool } = require('@rach/core');
const razorpay = require('./razorpay');
const { priceOrder } = require('../catalog');
const {
  verifySubscriptionPayment,
  verifyOrderPayment,
  assertPaymentMatches,
} = require('./paymentSecurity');
const issueInvoiceForPayment = require('./invoice/issueForPayment');
const { calculateTax } = require('./tax');
const credits = require('./credits');
const Plan = require('../models/plan');
const Order = require('../models/order');
const Payment = require('../models/payment');
const Subscription = require('../models/subscription');

const COUNTRY_NAME_TO_ISO = {
  India: 'IN', 'United States': 'US', 'United Kingdom': 'GB', Singapore: 'SG',
  Australia: 'AU', Canada: 'CA', Germany: 'DE', UAE: 'AE',
};

function isoCountry(value) {
  if (!value) return null;
  const v = String(value).trim();
  return v.length === 2 ? v.toUpperCase() : (COUNTRY_NAME_TO_ISO[v] ?? v.toUpperCase());
}

/**
 * Resolve the currency actually charged.
 *
 * The catalog is priced in USD; Indian customers are billed in INR. The
 * customer's stated billing country wins over IP geolocation — IP used to take
 * precedence, so a VPN silently changed the billing currency.
 */
function resolveBilling({ subtotalCents, catalogCurrency, billingCountry, ipCountry }) {
  const country = isoCountry(billingCountry) || isoCountry(ipCountry);
  const usdToInr = parseFloat(process.env.USD_TO_INR || '90');

  if (catalogCurrency === 'USD' && country === 'IN') {
    if (!Number.isFinite(usdToInr) || usdToInr <= 0) {
      throw Object.assign(new Error('Currency conversion is misconfigured'), { status: 500 });
    }
    return {
      country,
      currency: 'INR',
      amountMinor: Math.round(subtotalCents * usdToInr),  // integer only
      fxRate: usdToInr,
    };
  }

  return { country, currency: catalogCurrency, amountMinor: subtotalCents, fxRate: null };
}

/** Pre-tax subtotal in the charged currency, recomputed from a credit pack. */
function creditSubtotalMinor(pack, currency) {
  if (currency === 'INR') {
    const usdToInr = parseFloat(process.env.USD_TO_INR || '90');
    return Math.round(pack.price_cents * usdToInr);
  }
  return pack.price_cents;
}

/**
 * Tax (e.g. India 18% GST) on a pre-tax subtotal, via the same engine the
 * invoice uses — so the amount charged equals the invoice total. Returns 0
 * unless an active `tax_registrations` row covers the buyer's jurisdiction.
 */
async function taxOnSubtotal({ subtotalMinor, currency, buyer, description }) {
  const result = await calculateTax({
    lines: [{ description, quantity: 1, unit_price_minor: subtotalMinor, subtotal_minor: subtotalMinor }],
    currency,
    buyer,
  });
  return result.tax_total_minor || 0;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Step 1 of a subscription purchase: price the cart, create the Razorpay plan
 * and subscription, and persist the canonical `plans` + `subscriptions` rows.
 *
 * Persisting the subscription here — before payment — is what makes the webhook
 * able to find it later. It stays in Razorpay's `created` state until
 * activation confirms a captured payment.
 */
/** Minutes an unfinished checkout can be resumed before we start a fresh one. */
const INFLIGHT_REUSE_MINUTES = 30;

async function createSubscriptionPurchase({
  user, bundle_id, items, billingCountry, ipCountry,
  /** Explicit opt-in to hold a second subscription for an identical cart. */
  allowDuplicate = false,
}) {
  const priced = priceOrder({ bundle_id, items });
  if (priced.subtotal_cents <= 0) {
    throw Object.assign(new Error('Order total must be greater than zero'), { status: 400 });
  }

  const subtotal = resolveBilling({
    subtotalCents: priced.subtotal_cents,
    catalogCurrency: priced.currency,
    billingCountry,
    ipCountry,
  });

  // Add tax (India GST etc.) to the recurring charge, computed the same way the
  // invoice does, so the amount charged each cycle equals the invoice total.
  // Zero without a matching active tax registration.
  const subTaxMinor = await taxOnSubtotal({
    subtotalMinor: subtotal.amountMinor,
    currency: subtotal.currency,
    buyer: { country_code: isoCountry(billingCountry) || subtotal.country || null },
    description: priced.description,
  });
  const billing = {
    ...subtotal,
    subtotalMinor: subtotal.amountMinor,
    taxMinor: subTaxMinor,
    amountMinor: subtotal.amountMinor + subTaxMinor,   // recurring charge, tax-inclusive
  };

  const hasRazorpay = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  if (!hasRazorpay) {
    console.warn('[purchase] Razorpay not configured — returning a priced quote with no gateway objects');
    return { priced, billing, subscription: null, razorpay: { plan_id: null, subscription_id: null, key_id: null } };
  }

  // ── Duplicate protection ───────────────────────────────────────────────────
  // Every call to this function creates a Razorpay plan AND subscription. With
  // no check, a double-clicked checkout produced two live subscriptions and the
  // customer was billed twice, every month, indefinitely.
  const signature = {
    name: priced.description.slice(0, 255),
    amount: billing.amountMinor,
    currency: billing.currency,
  };

  // 1. An unfinished checkout for the same cart → resume it rather than mint a
  //    second set of gateway objects. This is what makes a double-click safe.
  const inflight = await Subscription.findByCartSignature(
    user.id, signature, ['created'], INFLIGHT_REUSE_MINUTES
  );
  if (inflight) {
    console.log(`[purchase] resuming in-flight subscription ${inflight.razorpay_sub_id} for user ${user.id}`);
    return {
      priced,
      billing,
      subscription: inflight,
      reused: true,
      razorpay: {
        plan_id: null,   // the client only needs the subscription id to open checkout
        subscription_id: inflight.razorpay_sub_id,
        key_id: process.env.RAZORPAY_KEY_ID,
      },
    };
  }

  // 2. Already paying for exactly this → refuse unless the caller insists.
  //    Buying a second, different subscription stays allowed; only an identical
  //    one is treated as an accident.
  if (!allowDuplicate) {
    const active = await Subscription.findByCartSignature(
      user.id, signature, ['active', 'authenticated', 'pending']
    );
    if (active) {
      throw Object.assign(
        new Error(
          `You already have an active subscription for "${priced.description}". ` +
          'Add it again only if you intend to run a second one.'
        ),
        {
          status: 409,
          code: 'duplicate_subscription',
          existing_subscription_id: active.id,
          existing_razorpay_sub_id: active.razorpay_sub_id,
        }
      );
    }
  }

  let rzPlan, rzSub;
  try {
    rzPlan = await razorpay.plans.create({
      period: 'monthly',
      interval: 1,
      item: {
        name: priced.description.slice(0, 255),
        amount: billing.amountMinor,
        currency: billing.currency,
        description: priced.description.slice(0, 255),
      },
    });

    rzSub = await razorpay.subscriptions.create({
      plan_id: rzPlan.id,
      customer_notify: 0,
      quantity: 1,
      total_count: 120,   // 10 years; Razorpay requires >= 1
    });
  } catch (rzErr) {
    const msg = rzErr?.error?.description || rzErr?.message || 'Razorpay error';
    throw Object.assign(new Error(`Payment gateway error: ${msg}`), { status: 502 });
  }

  // Canonical rows. `plans.amount` is stored in the billing currency's minor
  // unit, matching what Razorpay will actually charge.
  const plan = await Plan.create({
    name: priced.description.slice(0, 255),
    description: priced.description,
    amount: billing.amountMinor,
    currency: billing.currency,
    interval: 'monthly',
    interval_count: 1,
    razorpay_plan_id: rzPlan.id,
  });

  const subscription = await Subscription.create({
    user_id: user.id,
    plan_id: plan.id,
    razorpay_sub_id: rzSub.id,
    total_count: 120,
  });

  return {
    priced,
    billing,
    plan,
    subscription,
    razorpay: { plan_id: rzPlan.id, subscription_id: rzSub.id, key_id: process.env.RAZORPAY_KEY_ID },
  };
}

/**
 * Step 2: the customer has paid. Verify, then record the first billing cycle as
 * a real order + payment and issue the invoice.
 *
 * Verification here is unconditional and now also checks the amount with
 * Razorpay — the previous implementation verified only a signature (and only
 * when the client chose to send one), so it never confirmed money had moved.
 */
async function activateSubscriptionPurchase({
  user,
  razorpay_subscription_id,
  razorpay_payment_id,
  razorpay_signature,
  bundle_id,
  items,
  billingCountry,
  ipCountry,
  billing: billingDetails = {},
}) {
  verifySubscriptionPayment({ razorpay_subscription_id, razorpay_payment_id, razorpay_signature });

  const priced = priceOrder({ bundle_id, items });
  const billing = resolveBilling({
    subtotalCents: priced.subtotal_cents,
    catalogCurrency: priced.currency,
    billingCountry,
    ipCountry,
  });

  // Confirm with Razorpay that this payment is real, for the amount we expect,
  // and at least authorized. Subscription charges are captured asynchronously by
  // Razorpay, so the first cycle is commonly still `authorized` at this point and
  // capture is finalized via webhook — accept `authorized` here (funds are held)
  // rather than racing Razorpay's own capture.
  let rzPayment = null;
  try {
    rzPayment = await razorpay.payments.fetch(razorpay_payment_id);
    assertPaymentMatches(
      rzPayment,
      { amount: billing.amountMinor, currency: billing.currency },
      { allowAuthorized: true }
    );
  } catch (err) {
    if (err.name === 'PaymentVerificationError') throw err;
    // A gateway read failure must not strand a customer who has paid; proceed
    // and record it, but say so loudly.
    console.error('[purchase] could not verify payment with Razorpay:', err.message);
  }

  const subscription = await Subscription.findByRazorpayId(razorpay_subscription_id);
  if (!subscription) {
    throw Object.assign(
      new Error('Subscription not found. It may have been created before this flow was consolidated.'),
      { status: 404 }
    );
  }

  await Subscription.updateStatus(razorpay_subscription_id, 'active', { paid_count: 1 });

  // First billing cycle as a first-class order + payment.
  const rzOrderId = rzPayment?.order_id || `sub_${razorpay_subscription_id}_1`;

  let order = await Order.findByRazorpayId(rzOrderId);
  if (!order) {
    order = await Order.create({
      user_id: user.id,
      subscription_id: subscription.id,
      razorpay_order_id: rzOrderId,
      amount: billing.amountMinor,
      currency: billing.currency,
      description: priced.description,
    });
  }
  await Order.updateStatus(rzOrderId, 'paid');

  const existingPayment = await Payment.findByOrderId(rzOrderId);
  if (!existingPayment) {
    await Payment.create({
      user_id: user.id,
      order_id: order.id,
      subscription_id: subscription.id,
      razorpay_order_id: rzOrderId,
      amount: billing.amountMinor,
      currency: billing.currency,
      description: priced.description,
    });
  }
  const payment = await Payment.capture(rzOrderId, razorpay_payment_id, rzPayment?.method);

  const invoiceResult = await issueInvoiceForPayment({
    userId: user.id,
    currency: billing.currency,
    lines: priced.lines.map((l) => ({
      description: l.name,
      quantity: l.qty,
      // Convert per line, then divide — keeps the total exact under FX.
      unit_price_minor: Math.round((l.subtotal_cents * (billing.fxRate ?? 1)) / l.qty),
    })),
    billing: { ...billingDetails, country: billingCountry ?? billingDetails.country },
    payment: {
      razorpay_order_id: rzOrderId,
      razorpay_payment_id,
      razorpay_subscription_id,
    },
  });

  return { priced, billing, subscription, order, payment, invoice: invoiceResult };
}

// ─── Agent credits ────────────────────────────────────────────────────────────

/**
 * Credit purchases used to run their own billing stack in
 * `apps/rachdev-backend/src/controllers/agentController.js`: a private Razorpay
 * SDK instance, a non-constant-time signature comparison, no confirmation that
 * the payment was captured, no order or payment row, and no invoice — while
 * every other purchase path had all of those. It was a third money path, missed
 * during consolidation because it lives in the other app.
 *
 * Credits are consumable and delivered instantly, so unlike a service purchase
 * there is no fulfilment record — but the money still goes through here.
 */

async function createCreditPurchase({ user, packId, billingCountry, ipCountry }) {
  const pack = credits.getCreditPack(packId);
  if (!pack) throw Object.assign(new Error('Invalid credit pack'), { status: 400, code: 'unknown_pack' });

  // Credits have no billing form, so resolve the buyer from the saved profile —
  // the same source the invoice uses. This is what makes Indian customers get
  // INR pricing + GST on credits automatically.
  const { rows: urows } = await pool.query(
    'SELECT gstin, billing_address FROM users WHERE id = $1', [user.id]
  );
  const addr = urows[0]?.billing_address || {};
  const country = isoCountry(billingCountry) || isoCountry(addr.country) || isoCountry(ipCountry) || null;
  const gstin = urows[0]?.gstin || addr.gstin || null;

  // price_cents, not price_usd * 100.
  const subtotal = resolveBilling({
    subtotalCents: pack.price_cents,
    catalogCurrency: 'USD',
    billingCountry: country,
    ipCountry,
  });

  // Add tax (India GST etc.) to the amount charged, computed the same way the
  // invoice will, so the charge and the invoice reconcile. Zero without a
  // matching active tax registration.
  const taxMinor = await taxOnSubtotal({
    subtotalMinor: subtotal.amountMinor,
    currency: subtotal.currency,
    buyer: { country_code: country, region_code: addr.state || null, gstin },
    description: `${pack.label} credit pack`,
  });
  const billing = {
    ...subtotal,
    subtotalMinor: subtotal.amountMinor,
    taxMinor,
    amountMinor: subtotal.amountMinor + taxMinor,   // total charged, tax-inclusive
  };

  const receipt = `credits_${user.id}_${Date.now()}`;

  let rzOrder;
  try {
    rzOrder = await razorpay.orders.create({
      amount: billing.amountMinor,
      currency: billing.currency,
      receipt,
      notes: {
        kind: 'agent_credits',
        pack_id: pack.id,
        credits: String(pack.credits),
        tenant_id: String(user.tenant_id ?? ''),
        user_id: String(user.id),
      },
    });
  } catch (rzErr) {
    const msg = rzErr?.error?.description || rzErr?.message || 'Razorpay error';
    throw Object.assign(new Error(`Payment gateway error: ${msg}`), { status: 502 });
  }

  const description = `${pack.label} credit pack — ${pack.credits} credits`;

  const order = await Order.create({
    user_id: user.id,
    razorpay_order_id: rzOrder.id,
    amount: billing.amountMinor,
    currency: billing.currency,
    receipt,
    description,
  });

  return {
    pack,
    billing,
    order,
    description,
    razorpay: { order_id: rzOrder.id, key_id: process.env.RAZORPAY_KEY_ID },
  };
}

async function verifyCreditPurchase({
  user,
  packId,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  billing: billingDetails = {},
}) {
  const pack = credits.getCreditPack(packId);
  if (!pack) throw Object.assign(new Error('Invalid credit pack'), { status: 400, code: 'unknown_pack' });

  // Required and constant-time — previously a plain `!==`.
  verifyOrderPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature });

  const order = await Order.findByRazorpayId(razorpay_order_id);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

  if (user.role !== 'admin' && order.user_id !== user.id) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  // The signature proves the ids were issued together; it does not prove money
  // moved. Credits were previously granted on the signature alone, so an
  // authorized-but-uncaptured payment still topped up the balance.
  const rzPayment = await razorpay.payments.fetch(razorpay_payment_id);
  assertPaymentMatches(rzPayment, {
    amount: Number(order.amount),
    currency: order.currency,
    order_id: razorpay_order_id,
  });

  const existing = await Payment.findByOrderId(razorpay_order_id);
  if (!existing) {
    await Payment.create({
      user_id: order.user_id,
      order_id: order.id,
      razorpay_order_id,
      amount: order.amount,
      currency: order.currency,
      description: order.description,
    });
  }
  const payment = await Payment.capture(razorpay_order_id, razorpay_payment_id, rzPayment.method);
  await Order.updateStatus(razorpay_order_id, 'paid');

  // addCredits is idempotent on razorpay_payment_id, so a retried verify
  // cannot double-credit.
  const balance = await credits.addCredits(user.tenant_id, user.id, pack.credits, {
    description: order.description,
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
  });

  // Credits are revenue like anything else and now produce a tax invoice.
  // The invoice line is the PRE-TAX subtotal (order.amount is tax-inclusive);
  // the invoice engine re-adds the same tax, so its total equals what we charged.
  const invoice = await issueInvoiceForPayment({
    userId: order.user_id,
    currency: order.currency,
    lines: [{
      description: order.description,
      quantity: 1,
      unit_price_minor: creditSubtotalMinor(pack, order.currency),
    }],
    billing: billingDetails,
    payment: { razorpay_order_id, razorpay_payment_id },
  });

  return { pack, order, payment, balance, invoice };
}

// ─── Fulfilment linkage ───────────────────────────────────────────────────────

/**
 * Fan out a subscription state change to the fulfilment records that reference
 * it. `vm_expansion_requests.subscription_status` had no writer other than
 * activation and user-initiated cancellation, so it never reflected reality
 * once Razorpay took over the billing cycle.
 */
async function syncFulfilmentForSubscription(razorpaySubId, { status, nextChargeAt } = {}) {
  const { rowCount } = await pool.query(
    `UPDATE vm_expansion_requests
        SET subscription_status = COALESCE($2, subscription_status),
            next_charge_at      = COALESCE($3, next_charge_at)
      WHERE razorpay_subscription_id = $1`,
    [razorpaySubId, status ?? null, nextChargeAt ?? null]
  );
  if (rowCount) {
    console.log(`[purchase] synced ${rowCount} fulfilment row(s) for subscription ${razorpaySubId} → ${status}`);
  }
  return rowCount;
}

/**
 * Cancel subscriptions whose checkout was never completed.
 *
 * Razorpay does not charge a subscription in `created` state, so an abandoned
 * one costs nothing immediately — but the object stays live and the checkout
 * link with it, so a customer returning to a stale tab days later could
 * authenticate a purchase they had walked away from. Cancelling closes that.
 *
 * Safe to run repeatedly; only touches rows still in `created`.
 */
async function cancelAbandonedSubscriptions({ olderThanMinutes = 60, dryRun = false } = {}) {
  const abandoned = await Subscription.findAbandoned(olderThanMinutes);
  if (!abandoned.length) return { examined: 0, cancelled: 0 };

  let cancelled = 0;

  for (const sub of abandoned) {
    if (dryRun) {
      console.log(`[purchase] would cancel abandoned subscription ${sub.razorpay_sub_id} (user ${sub.user_id})`);
      continue;
    }

    try {
      await razorpay.subscriptions.cancel(sub.razorpay_sub_id);
    } catch (err) {
      // Already cancelled or never reached Razorpay — still reconcile locally.
      const msg = err?.error?.description || err.message;
      console.warn(`[purchase] Razorpay cancel failed for ${sub.razorpay_sub_id}: ${msg}`);
    }

    await Subscription.updateStatus(sub.razorpay_sub_id, 'cancelled');
    cancelled++;
  }

  if (cancelled) console.log(`[purchase] cancelled ${cancelled} abandoned subscription(s)`);
  return { examined: abandoned.length, cancelled };
}

module.exports = {
  createSubscriptionPurchase,
  activateSubscriptionPurchase,
  createCreditPurchase,
  verifyCreditPurchase,
  syncFulfilmentForSubscription,
  cancelAbandonedSubscriptions,
  resolveBilling,
  isoCountry,
  INFLIGHT_REUSE_MINUTES,
};
