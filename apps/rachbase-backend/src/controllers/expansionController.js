'use strict';

const geoip     = require('geoip-lite');
const pool      = require('@rach/core').pool;
const razorpay  = require('@rach/billing').razorpay;
const { priceCart, getBundle, PricingError } = require('@rach/billing').catalog;
const { verifyOrderPayment } = require('@rach/billing').paymentSecurity;
const purchase = require('@rach/billing').purchase;
const Subscription = require('@rach/billing').Subscription;
const asyncHandler = require('@rach/core').asyncHandler;
const { sendInvoiceEmail, sendOrderNotificationEmail, sendVmKeyProvisioningEmail } = require('@rach/core').brevo;
const { VmKey } = require('../models/vmKey');
const keyCrypto = require('../services/keyCrypto');
const { purchasedQty } = require('../lib/entitlements');

// jsonb columns arrive parsed from pg; tolerate a string too.
function parseJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}

/**
 * Idempotently fulfil a subscription's VM order: create the fulfilment record,
 * email the order notification, and provision SSH keypairs. Called from BOTH the
 * synchronous activate handler and the `subscription.charged` webhook, so a VM
 * order is fulfilled exactly once even if activation was interrupted.
 *
 * Idempotency: a transaction-scoped advisory lock keyed on the subscription
 * serializes concurrent callers, and an existing fulfilment row short-circuits —
 * so renewals and webhook retries never re-provision.
 *
 * Inputs come from the fulfilment snapshot stored at creation; `ctx` supplies a
 * fallback (the synchronous path has the live cart) plus the payment id.
 */
async function ensureSubscriptionFulfilment(razorpaySubId, ctx = {}) {
  if (!razorpaySubId) return null;

  const client = await pool.connect();
  let order = null;
  let sideEffects = null;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sub_fulfil:${razorpaySubId}`]);

    const { rows: existing } = await client.query(
      'SELECT * FROM vm_expansion_requests WHERE razorpay_subscription_id = $1 ORDER BY id LIMIT 1',
      [razorpaySubId]
    );
    if (existing.length) { await client.query('COMMIT'); return existing[0]; }

    const { rows: subRows } = await client.query(
      `SELECT s.*, p.name AS plan_name, p.amount AS plan_amount, p.currency AS plan_currency
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.razorpay_sub_id = $1`,
      [razorpaySubId]
    );
    const sub = subRows[0];
    if (!sub) { await client.query('ROLLBACK'); console.error(`[expansion] fulfilment: subscription ${razorpaySubId} not found`); return null; }

    const snap = parseJson(sub.fulfilment_json) || {};
    const requestedBy = snap.requested_by ?? ctx.requested_by ?? sub.user_id;
    let tenantId = snap.tenant_id ?? ctx.tenant_id ?? null;
    if (tenantId == null) {
      const { rows: uRows } = await client.query('SELECT tenant_id FROM users WHERE id = $1', [requestedBy]);
      tenantId = uRows[0]?.tenant_id ?? null;
    }
    const amountMinor  = snap.amount_minor ?? ctx.amountMinor ?? Number(sub.plan_amount);
    const currency     = snap.currency || ctx.currency || sub.plan_currency;
    const items        = Array.isArray(snap.items) ? snap.items : (Array.isArray(ctx.items) ? ctx.items : []);
    const description  = snap.description || ctx.description || sub.plan_name || 'Subscription';
    const vmCount      = snap.vm_count ?? ctx.vm_count ?? 0;
    const notes        = `Monthly: ${(Number(amountMinor) / 100).toFixed(2)} ${currency}`;

    const { rows: ordRows } = await client.query(
      'SELECT id FROM orders WHERE subscription_id = $1 ORDER BY id DESC LIMIT 1',
      [sub.id]
    );

    const { rows } = await client.query(
      `INSERT INTO vm_expansion_requests
         (tenant_id, requested_by, amount_paid, currency, status,
          custom_description, items_json, notes,
          razorpay_payment_id, razorpay_plan_id, razorpay_subscription_id,
          subscription_status, subscription_id, order_id)
       VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,'active',$11,$12)
       RETURNING *`,
      [
        tenantId, requestedBy, amountMinor, currency, description,
        JSON.stringify(items), notes,
        ctx.paymentId || null,
        snap.razorpay_plan_id || ctx.razorpay_plan_id || null,
        razorpaySubId,
        snap.subscription_id ?? ctx.subscription_id ?? sub.id ?? null,
        ordRows[0]?.id ?? null,
      ]
    );
    order = rows[0];
    sideEffects = { items, vmCount, requestedBy };
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[expansion] ensureSubscriptionFulfilment failed:', err.message);
    return null;
  } finally {
    client.release();
  }

  // Side effects run outside the lock — never block or fail on them.
  if (order && sideEffects) {
    try {
      const { rows: uRows } = await pool.query('SELECT name, email FROM users WHERE id = $1', [sideEffects.requestedBy]);
      const customer = uRows[0] || {};
      sendInvoiceEmail({
        orderId       : order.id,
        customerName  : customer.name  || 'Customer',
        customerEmail : customer.email || '',
        description   : order.custom_description,
        items         : sideEffects.items,
        amountPaid    : order.amount_paid,
        currency      : order.currency,
        subscriptionId: razorpaySubId,
        requestedAt   : order.requested_at,
      }).catch((e) => console.error('[expansion] confirmation email failed:', e.message));
    } catch (e) {
      console.error('[expansion] confirmation email failed:', e.message);
    }
    notifyOrderPlaced(order, (sideEffects.items || []).map((l) => ({ name: l.name, qty: l.qty })));
    provisionVmKeysForOrder(order, sideEffects.vmCount || 0);
  }
  return order;
}

/**
 * Notify raghav@rachdev.com that an order completed. Fire-and-forget: never
 * blocks or fails the order response. `order` is a vm_expansion_requests row
 * (needs id, requested_by, requested_at, amount_paid, currency); `items` is a
 * list of { name, qty }.
 */
async function notifyOrderPlaced(order, items) {
  try {
    const { rows } = await pool.query('SELECT name, email FROM users WHERE id = $1', [order.requested_by]);
    const u = rows[0] || {};
    await sendOrderNotificationEmail({
      orderId      : order.id,
      items,
      customerName : u.name  || 'Customer',
      customerEmail: u.email || '',
      placedAt     : order.requested_at,
      amount       : order.amount_paid,
      currency     : order.currency,
    });
  } catch (e) {
    console.error('[expansion] order notification email failed:', e.message);
  }
}

/**
 * Generate one per-VM SSH keypair for each VM in a completed order, store the
 * private keys encrypted (pending), and email raghav+ARKA the PUBLIC keys to
 * install. Fire-and-forget: never blocks or fails the order response.
 */
async function provisionVmKeysForOrder(order, vmCount) {
  if (!vmCount || vmCount < 1) return;
  if (!keyCrypto.isConfigured()) {
    console.warn(`[expansion] RACHBASE_KEY_ENC_SECRET not set — skipping VM keypair generation for order ${order.id}`);
    return;
  }
  try {
    const keys = [];
    for (let i = 0; i < vmCount; i++) {
      const k = await VmKey.createPending({
        orderId : order.id,
        userId  : order.requested_by,
        tenantId: order.tenant_id,
        comment : `rachbase:order=${order.id}`,
      });
      keys.push({ fingerprint: k.fingerprint, publicKey: k.public_key });
    }
    const { rows } = await pool.query('SELECT name, email FROM users WHERE id = $1', [order.requested_by]);
    const cust = rows[0] || {};
    await sendVmKeyProvisioningEmail({
      orderId      : order.id,
      customerName : cust.name  || 'Customer',
      customerEmail: cust.email || '',
      sshUser      : 'rachops',
      keys,
    });
  } catch (e) {
    console.error('[expansion] VM key provisioning failed:', e.message);
  }
}

/**
 * This controller owns FULFILMENT, not billing.
 *
 * It used to implement its own parallel billing stack — pricing, Razorpay plan
 * and subscription creation, signature checking — writing everything into
 * vm_expansion_requests. Because the webhook resolves subscriptions through the
 * `subscriptions` table, those subscriptions were invisible to it: renewals
 * recorded nothing and a dead subscription still read 'active'.
 *
 * Money now goes through `@rach/billing`'s purchase service, which writes the
 * canonical plans/subscriptions/orders/payments rows. What remains here is the
 * provisioning workflow — a vm_expansion_requests row linked to those billing
 * rows by FK (migration 029), moving pending → fulfilled by an admin.
 */

// Resolve the real client IP, accounting for reverse proxies / ngrok.
function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || '';
}

// Returns the ISO 3166-1 alpha-2 country code for the request's IP, or null.
function countryFromReq(req) {
  const ip = clientIp(req);
  // Skip loopback / private ranges — geoip-lite returns null for these
  if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null;
  }
  const geo = geoip.lookup(ip);
  return geo?.country ?? null;
}

// ── VM Packages ───────────────────────────────────────────────────────────────

// GET /api/expansion/packages — any authenticated user
async function listPackages(req, res) {
  const { rows } = await pool.query(
    `SELECT id, name, description, vm_count, price_cents, currency, billing_period, is_active
     FROM vm_packages
     WHERE is_active = TRUE
     ORDER BY vm_count ASC`
  );
  res.json({ packages: rows });
}

// POST /api/expansion/packages — admin only
async function createPackage(req, res) {
  const { name, description, vm_count, price_cents, currency = 'USD', billing_period = 'monthly' } = req.body;
  if (!name || !vm_count || price_cents == null) {
    return res.status(400).json({ error: 'name, vm_count, price_cents are required' });
  }
  const { rows } = await pool.query(
    `INSERT INTO vm_packages (name, description, vm_count, price_cents, currency, billing_period)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, description || null, vm_count, price_cents, currency, billing_period]
  );
  res.status(201).json({ message: 'Package created', package: rows[0] });
}

// PATCH /api/expansion/packages/:id — admin only
async function updatePackage(req, res) {
  const { id } = req.params;
  const { name, description, vm_count, price_cents, currency, billing_period, is_active } = req.body;
  const { rows } = await pool.query(
    `UPDATE vm_packages SET
       name           = COALESCE($1, name),
       description    = COALESCE($2, description),
       vm_count       = COALESCE($3, vm_count),
       price_cents    = COALESCE($4, price_cents),
       currency       = COALESCE($5, currency),
       billing_period = COALESCE($6, billing_period),
       is_active      = COALESCE($7, is_active),
       updated_at     = NOW()
     WHERE id = $8 RETURNING *`,
    [name, description, vm_count, price_cents, currency, billing_period, is_active, id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Package not found' });
  res.json({ message: 'Package updated', package: rows[0] });
}

// ── Expansion Orders ──────────────────────────────────────────────────────────

// POST /api/expansion/orders — tenant_admin only
// Creates a Razorpay order for a VM package purchase
async function createExpansionOrder(req, res) {
  const { package_id } = req.body;
  const caller = req.user;

  if (!package_id) return res.status(400).json({ error: 'package_id is required' });
  // tenant_id may be null for users not yet linked to a tenant — still allow

  const { rows } = await pool.query(
    'SELECT * FROM vm_packages WHERE id = $1 AND is_active = TRUE',
    [package_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Package not found or inactive' });

  const pkg = rows[0];
  const receipt = `expand_${caller.tenant_id}_${pkg.id}_${Date.now()}`;

  let razorpayOrderId = null;
  let razorpayKeyId   = null;

  try {
    const rzOrder = await razorpay.orders.create({
      amount  : pkg.price_cents,
      currency: pkg.currency,
      receipt,
      notes   : {
        tenant_id  : String(caller.tenant_id),
        package_id : String(pkg.id),
        vm_count   : String(pkg.vm_count),
      },
    });
    razorpayOrderId = rzOrder.id;
    razorpayKeyId   = process.env.RAZORPAY_KEY_ID;
  } catch (rzErr) {
    // Razorpay not configured (dev/test env) — allow offline flow
    console.warn('[expansion] Razorpay order creation skipped:', rzErr.message);
  }

  res.json({
    package: pkg,
    razorpay_order_id: razorpayOrderId,
    razorpay_key_id  : razorpayKeyId,
    // If razorpay_order_id is null, frontend shows "Request without payment" fallback
  });
}

// POST /api/expansion/verify — tenant_admin
// Called after Razorpay checkout succeeds; creates the expansion request
async function verifyExpansionPayment(req, res) {
  const { package_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const caller = req.user;

  if (!package_id) return res.status(400).json({ error: 'package_id is required' });
  if (!caller.tenant_id) return res.status(403).json({ error: 'Forbidden' });

  const { rows: pkgRows } = await pool.query('SELECT * FROM vm_packages WHERE id = $1', [package_id]);
  if (!pkgRows.length) return res.status(404).json({ error: 'Package not found' });
  const pkg = pkgRows[0];

  // Unconditional — see verifyOrderPayment. This check used to be skippable by
  // omitting any one of the three fields.
  verifyOrderPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature });

  // Create expansion request
  const { rows } = await pool.query(
    `INSERT INTO vm_expansion_requests
       (tenant_id, package_id, requested_by, razorpay_order_id, razorpay_payment_id,
        amount_paid, currency, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING *`,
    [
      caller.tenant_id,
      pkg.id,
      caller.id,
      razorpay_order_id || null,
      razorpay_payment_id || null,
      pkg.price_cents,
      pkg.currency,
    ]
  );

  // Notify admin the order completed (fire-and-forget)
  const pkgLabel = pkg.vm_count ? `${pkg.name} (${pkg.vm_count} VMs)` : pkg.name;
  notifyOrderPlaced(rows[0], [{ name: pkgLabel, qty: 1 }]);
  // Mint one SSH keypair per VM in the package and email the public keys to ARKA
  provisionVmKeysForOrder(rows[0], pkg.vm_count || 0);

  res.status(201).json({
    message : 'Resource expansion request submitted. Our team will assign your VMs shortly.',
    request : rows[0],
    package : pkg,
  });
}

// ── Expansion Requests (admin view) ──────────────────────────────────────────

// GET /api/expansion/requests — admin only; lists all pending/all requests
async function listExpansionRequests(req, res) {
  const { status } = req.query;
  const where = status ? `WHERE r.status = $1` : '';
  const params = status ? [status] : [];

  const { rows } = await pool.query(
    `SELECT r.*,
            t.name        AS tenant_name,
            p.name        AS package_name,
            p.vm_count    AS vm_count,
            u.name        AS requested_by_name,
            u.email       AS requested_by_email
     FROM vm_expansion_requests r
     LEFT JOIN tenants     t ON t.id = r.tenant_id
     LEFT JOIN vm_packages p ON p.id = r.package_id
     JOIN      users       u ON u.id = r.requested_by
     ${where}
     ORDER BY r.requested_at DESC`,
    params
  );
  res.json({ requests: rows });
}

// PATCH /api/expansion/requests/:id/fulfil — admin only
async function fulfilRequest(req, res) {
  const { id } = req.params;
  const { notes } = req.body;
  const caller = req.user;

  const { rows } = await pool.query(
    `UPDATE vm_expansion_requests
     SET status = 'fulfilled', fulfilled_at = NOW(), fulfilled_by = $1,
         notes = COALESCE($2, notes)
     WHERE id = $3 AND status = 'pending'
     RETURNING *`,
    [caller.id, notes || null, id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Request not found or already fulfilled' });
  res.json({ message: 'Expansion request marked as fulfilled', request: rows[0] });
}

// PATCH /api/expansion/requests/:id/cancel — admin only
async function cancelRequest(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query(
    `UPDATE vm_expansion_requests SET status = 'cancelled'
     WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Request not found or already actioned' });
  res.json({ message: 'Expansion request cancelled', request: rows[0] });
}

// PATCH /api/expansion/requests/:id/cancel-my — tenant_admin cancels their own subscription
// Cancels at period end: the Razorpay subscription is cancelled so no further
// charges are made after the current billing cycle (26th), but the order
// status stays 'pending' (still active this cycle) and is marked 'cancelled'
// once the admin fulfils/closes it, or you can mark it immediately here.
async function cancelMySubscription(req, res) {
  const { id }    = req.params;
  const caller    = req.user;

  if (!caller.tenant_id) return res.status(403).json({ error: 'Forbidden' });

  // Fetch the request — must belong to caller's tenant and be cancellable.
  // tenant_admin can cancel any order in the tenant; tenant_user only their own
  // (otherwise a low-privilege user could cancel the admin's subscription — T2).
  const isTenantAdmin = caller.role === 'tenant_admin';
  const { rows: found } = isTenantAdmin
    ? await pool.query(
        `SELECT * FROM vm_expansion_requests
         WHERE id = $1 AND tenant_id = $2 AND status NOT IN ('cancelled')`,
        [id, caller.tenant_id]
      )
    : await pool.query(
        `SELECT * FROM vm_expansion_requests
         WHERE id = $1 AND tenant_id = $2 AND requested_by = $3 AND status NOT IN ('cancelled')`,
        [id, caller.tenant_id, caller.id]
      );
  if (!found.length) return res.status(404).json({ error: 'Order not found or already cancelled' });

  const request = found[0];

  const isSubscription = !!request.razorpay_subscription_id;

  if (isSubscription) {
    // Cancel the Razorpay subscription at period end (cancel_at_cycle_end = true)
    // so the customer keeps access until the 26th and isn't charged afterwards.
    try {
      await razorpay.subscriptions.cancel(request.razorpay_subscription_id, true /* cancel_at_cycle_end */);
      console.log(`[expansion] Razorpay subscription ${request.razorpay_subscription_id} scheduled for end-of-cycle cancellation`);
    } catch (rzErr) {
      console.warn('[expansion] Razorpay subscription cancel failed (marking DB anyway):', rzErr?.error?.description || rzErr?.message);
    }
  }

  let newStatus, newSubStatus, message;
  if (isSubscription) {
    // Preserve current status (pending or fulfilled) — the subscription_status
    // field drives the "Cancels at cycle end" badge; no charges after cycle end.
    newStatus    = request.status;
    newSubStatus = 'cancel_at_period_end';
    message      = 'Subscription cancelled. You retain access until the end of the current billing cycle.';
  } else {
    // One-time order — cancel immediately, no billing cycle to respect.
    newStatus    = 'cancelled';
    newSubStatus = null;
    message      = 'Order cancelled successfully.';
  }

  const { rows } = await pool.query(
    `UPDATE vm_expansion_requests
     SET status              = $2,
         subscription_status = $3,
         notes               = COALESCE(notes || ' | ', '') || 'Cancelled by tenant on ' || NOW()::date
     WHERE id = $1
     RETURNING *`,
    [id, newStatus, newSubStatus]
  );

  res.json({ message, request: rows[0] });
}

// GET /api/expansion/requests/my — tenant_admin sees their own tenant's requests
async function myExpansionRequests(req, res) {
  const caller = req.user;

  // tenant_admin → all orders for their tenant (or own orders if no tenant linked)
  // tenant_user  → only their own orders
  const isTenantAdmin = caller.role === 'tenant_admin';

  const { rows } = (isTenantAdmin && caller.tenant_id)
    ? await pool.query(
        `SELECT r.*,
                p.name     AS package_name,
                p.vm_count AS vm_count,
                u.name     AS requested_by_name
         FROM vm_expansion_requests r
         LEFT JOIN vm_packages p ON p.id = r.package_id
         JOIN      users       u ON u.id = r.requested_by
         WHERE r.tenant_id = $1
         ORDER BY r.requested_at DESC`,
        [caller.tenant_id]
      )
    : await pool.query(
        `SELECT r.*,
                p.name     AS package_name,
                p.vm_count AS vm_count,
                u.name     AS requested_by_name
         FROM vm_expansion_requests r
         LEFT JOIN vm_packages p ON p.id = r.package_id
         JOIN      users       u ON u.id = r.requested_by
         WHERE r.requested_by = $1
         ORDER BY r.requested_at DESC`,
        [caller.id]
      );

  res.json({ requests: rows });
}

// ── Custom (line-item) Orders ─────────────────────────────────────────────────

// NOTE: the local SERVICE_PRICES map that used to live here has been removed.
// It claimed to be the "single source of truth shared with the frontend
// catalog" but nothing enforced that, and it had drifted: Managed PostgreSQL
// was priced at $100 against an advertised $200, and five of the eight
// advertised services were missing entirely so they could not be ordered.
// Pricing now comes from packages/billing/catalog.json via priceCart().

// POST /api/expansion/custom/orders — tenant_admin / tenant_user
// Creates a Razorpay order for an arbitrary basket of services.
async function createCustomOrder(req, res) {
  const { items } = req.body;
  const caller = req.user;

  // Server-side pricing. Only `id` and `qty` are read from the request; any
  // price the client sends is ignored.
  let priced;
  try {
    priced = priceCart(items);
  } catch (err) {
    if (err instanceof PricingError) return res.status(400).json({ error: err.message, code: err.code });
    throw err;
  }

  const totalCents = priced.subtotal_cents;
  const lineItems  = priced.lines;
  const currency   = priced.currency;
  const description = priced.description;
  const receipt = `custom_${caller.tenant_id}_${Date.now()}`;

  let razorpayOrderId = null;
  let razorpayKeyId   = null;

  try {
    const rzOrder = await razorpay.orders.create({
      amount  : totalCents,
      currency,
      receipt,
      notes   : { tenant_id: String(caller.tenant_id), type: 'custom', description },
    });
    razorpayOrderId = rzOrder.id;
    razorpayKeyId   = process.env.RAZORPAY_KEY_ID;
  } catch (rzErr) {
    console.warn('[expansion] Razorpay custom order skipped:', rzErr.message);
  }

  res.json({ description, total_cents: totalCents, currency, items: lineItems, razorpay_order_id: razorpayOrderId, razorpay_key_id: razorpayKeyId });
}

// POST /api/expansion/custom/verify — tenant_admin
// Verifies payment and records the expansion request (no package_id)
async function verifyCustomPayment(req, res) {
  const { items, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const caller = req.user;

  if (!caller.tenant_id) return res.status(403).json({ error: 'Forbidden' });

  // Re-price server-side. `total_cents` from the body is deliberately ignored —
  // it used to be written straight to the ledger.
  let priced;
  try {
    priced = priceCart(items);
  } catch (err) {
    if (err instanceof PricingError) return res.status(400).json({ error: err.message, code: err.code });
    throw err;
  }
  const total_cents = priced.subtotal_cents;
  const currency = priced.currency;

  // Unconditional. Previously this was wrapped in a truthiness check on the
  // same fields it verifies, so omitting the signature skipped it entirely.
  verifyOrderPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature });

  const description = items.map((i) => `${i.qty}× ${i.name}`).join(', ');

  const { rows } = await pool.query(
    `INSERT INTO vm_expansion_requests
       (tenant_id, requested_by, razorpay_order_id, razorpay_payment_id,
        amount_paid, currency, status, custom_description, items_json)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)
     RETURNING *`,
    [
      caller.tenant_id,
      caller.id,
      razorpay_order_id   || null,
      razorpay_payment_id || null,
      total_cents,
      currency,
      description,
      JSON.stringify(items),
    ]
  );

  // Notify admin the order completed (fire-and-forget)
  notifyOrderPlaced(rows[0], (items || []).map((i) => ({ name: i.name, qty: i.qty })));
  // Mint one SSH keypair per VM ordered
  const customVmCount = (items || [])
    .filter((i) => i.id === 'vm' || i.name === 'Virtual Machine')
    .reduce((n, i) => n + (Number(i.qty) || 0), 0);
  provisionVmKeysForOrder(rows[0], customVmCount);

  res.status(201).json({
    message: 'Resource expansion request submitted. Our team will provision your services shortly.',
    request: rows[0],
  });
}

// ── Subscription Orders ───────────────────────────────────────────────────────

// POST /api/expansion/subscriptions
// Prices the cart and creates the Razorpay plan + subscription through the
// shared purchase service, which persists the canonical plans/subscriptions
// rows. Persisting the subscription BEFORE payment is what lets the webhook
// find it later; it stays in Razorpay's `created` state until activation.
async function createSubscriptionOrder(req, res) {
  const { items, bundle_id, billing_country } = req.body;

  let result;
  try {
    result = await purchase.createSubscriptionPurchase({
      user          : req.user,
      bundle_id,
      items,
      billingCountry: billing_country,
      ipCountry     : countryFromReq(req),
    });
  } catch (err) {
    if (err instanceof PricingError) return res.status(400).json({ error: err.message, code: err.code });
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const { priced, billing, subscription, razorpay: rz } = result;

  // Snapshot the cart so the webhook can fulfil this VM order even if the
  // activation call never runs (browser closed after payment).
  const vmCount = bundle_id
    ? (getBundle(bundle_id)?.items?.vm || 0)
    : (priced.lines || []).filter((l) => l.id === 'vm').reduce((n, l) => n + (Number(l.qty) || 0), 0);
  if (rz.subscription_id) {
    await Subscription.saveFulfilment(rz.subscription_id, {
      tenant_id       : req.user.tenant_id,
      requested_by    : req.user.id,
      description     : priced.description,
      currency        : billing.currency,
      amount_minor    : billing.amountMinor,
      items           : priced.lines,
      vm_count        : vmCount,
      razorpay_plan_id: rz.plan_id,
      subscription_id : subscription?.id ?? null,
    }).catch((e) => console.error('[expansion] saveFulfilment failed:', e.message));
  }

  res.status(201).json({
    subscription_id : rz.subscription_id,
    plan_id         : rz.plan_id,
    razorpay_key_id : rz.key_id,
    description     : priced.description,
    total_cents     : priced.subtotal_cents,   // server-priced
    currency        : priced.currency,
    billing_currency: billing.currency,
    monthly_amount  : billing.amountMinor,
    customer_country: billing.country,
    converted       : billing.currency !== priced.currency,
    fx_rate         : billing.fxRate,
    lines           : priced.lines,
    db_subscription_id: subscription?.id ?? null,
    // True when an unfinished checkout was resumed rather than a new Razorpay
    // subscription created — i.e. the double-click case.
    reused          : result.reused === true,
    ...(priced.bundle_id ? {
      bundle_id       : priced.bundle_id,
      list_price_cents: priced.list_price_cents,
      saving_cents    : priced.saving_cents,
    } : {}),
  });
}

// POST /api/expansion/subscriptions/activate
// Called after Razorpay subscription checkout succeeds. Billing is handled by
// the shared purchase service (verification, order + payment rows, invoice);
// this handler adds the FULFILMENT record and links it to the subscription.
async function activateSubscription(req, res) {
  const { razorpay_plan_id, items, bundle_id, billing_country } = req.body;
  const caller = req.user;

  let result;
  try {
    result = await purchase.activateSubscriptionPurchase({
      user                    : caller,
      razorpay_subscription_id: req.body.razorpay_subscription_id,
      razorpay_payment_id     : req.body.razorpay_payment_id,
      razorpay_signature      : req.body.razorpay_signature,
      bundle_id,
      items,
      billingCountry          : billing_country,
      ipCountry               : countryFromReq(req),
      billing                 : req.body.billing || {},
    });
  } catch (err) {
    if (err instanceof PricingError) return res.status(400).json({ error: err.message, code: err.code });
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    throw err;
  }

  const { priced, billing, subscription, payment, invoice } = result;

  const subVmCount = bundle_id
    ? (getBundle(bundle_id)?.items?.vm || 0)
    : (priced.lines || []).filter((l) => l.id === 'vm').reduce((n, l) => n + (Number(l.qty) || 0), 0);

  // Fulfilment goes through the same idempotent path the webhook uses, so the
  // synchronous activation and a `subscription.charged` webhook that arrives at
  // the same time can't double-provision. Pass the live cart as a fallback in
  // case the creation-time snapshot is missing.
  const order = await ensureSubscriptionFulfilment(req.body.razorpay_subscription_id, {
    paymentId       : req.body.razorpay_payment_id,
    amountMinor     : billing.amountMinor,
    currency        : billing.currency,
    items           : priced.lines,
    vm_count        : subVmCount,
    description     : priced.description,
    tenant_id       : caller.tenant_id,
    requested_by    : caller.id,
    razorpay_plan_id: razorpay_plan_id || null,
    subscription_id : subscription?.id ?? null,
  });
  if (order && invoice?.ok) order.invoice_number = invoice.invoice.invoice_number;

  res.status(201).json({
    message: 'Subscription activated. Resources will be provisioned shortly.',
    request: order,
    payment_id: payment?.id ?? null,
  });
}

// GET /api/expansion/has-observability — any authenticated user
// Returns the list of vm_ids with obs assigned for the caller's tenant.
// Admins (no tenant_id) get unlimited: true so they can always open graphs.
async function hasObservability(req, res) {
  const caller = req.user;
  if (!caller.tenant_id) {
    return res.json({ obs_vm_ids: null, unlimited: true });
  }
  const { rows } = await pool.query(
    'SELECT vm_id FROM vm_observability_assignments WHERE tenant_id = $1',
    [caller.tenant_id]
  );
  res.json({ obs_vm_ids: rows.map((r) => r.vm_id), unlimited: false });
}

// ── Per-VM Observability Assignment (admin) ───────────────────────────────────

// GET /api/expansion/observability/assignments?tenant_id=X — admin
async function listObsAssignments(req, res) {
  const { tenant_id } = req.query;
  const where  = tenant_id ? 'WHERE oa.tenant_id = $1' : '';
  const params = tenant_id ? [tenant_id] : [];
  const { rows } = await pool.query(
    `SELECT oa.id, oa.tenant_id, oa.vm_id, oa.assigned_at,
            t.name  AS tenant_name,
            u.name  AS assigned_by_name
     FROM vm_observability_assignments oa
     JOIN  tenants t ON t.id = oa.tenant_id
     LEFT JOIN users u ON u.id = oa.assigned_by
     ${where}
     ORDER BY oa.assigned_at DESC`,
    params
  );
  res.json({ assignments: rows });
}

// GET /api/expansion/observability/quota — admin
// Returns per-tenant obs quota (purchased) vs used (assigned).
async function getObsQuota(req, res) {
  const { rows } = await pool.query(`
    SELECT
      t.id   AS tenant_id,
      t.name AS tenant_name,
      COALESCE((
        SELECT SUM((item->>'qty')::int)
        FROM   vm_expansion_requests r,
               jsonb_array_elements(r.items_json::jsonb) item
        WHERE  r.tenant_id = t.id
          AND  r.status    NOT IN ('cancelled')
          AND  item->>'id' = 'obs'
      ), 0)::int AS quota,
      COUNT(oa.id)::int AS used
    FROM   tenants t
    LEFT JOIN vm_observability_assignments oa ON oa.tenant_id = t.id
    GROUP  BY t.id, t.name
    ORDER  BY t.name
  `);
  res.json({ quotas: rows });
}

// POST /api/expansion/observability/assign — admin
// Body: { tenant_id, vm_id }
const OBS_VMID_RE = /^(qemu|lxc)\/\d+$/;

async function assignObs(req, res) {
  const { tenant_id, vm_id } = req.body;
  const caller = req.user;
  if (!tenant_id || !vm_id) return res.status(400).json({ error: 'tenant_id and vm_id are required' });
  if (!OBS_VMID_RE.test(vm_id)) {
    return res.status(400).json({ error: 'Invalid vm_id — expected qemu/<n> or lxc/<n>' });
  }

  // Check quota
  const { rows: quotaRows } = await pool.query(`
    SELECT COALESCE(SUM((item->>'qty')::int), 0)::int AS quota
    FROM   vm_expansion_requests r,
           jsonb_array_elements(r.items_json::jsonb) item
    WHERE  r.tenant_id = $1
      AND  r.status    NOT IN ('cancelled')
      AND  item->>'id' = 'obs'
  `, [tenant_id]);
  const quota = quotaRows[0].quota;

  const { rows: usedRows } = await pool.query(
    'SELECT COUNT(*)::int AS used FROM vm_observability_assignments WHERE tenant_id = $1',
    [tenant_id]
  );
  const used = usedRows[0].used;

  if (used >= quota) {
    return res.status(400).json({
      error: `Quota exceeded: tenant has ${quota} obs slot(s) purchased, all ${used} are already assigned.`,
    });
  }

  const { rows } = await pool.query(
    `INSERT INTO vm_observability_assignments (tenant_id, vm_id, assigned_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, vm_id) DO NOTHING
     RETURNING *`,
    [tenant_id, vm_id, caller.id]
  );
  res.status(201).json({ message: 'Observability assigned to VM', assignment: rows[0] ?? null });
}

// DELETE /api/expansion/observability/assign — admin
// Body: { tenant_id, vm_id }
async function unassignObs(req, res) {
  const { tenant_id, vm_id } = req.body;
  if (!tenant_id || !vm_id) return res.status(400).json({ error: 'tenant_id and vm_id are required' });
  const { rowCount } = await pool.query(
    'DELETE FROM vm_observability_assignments WHERE tenant_id = $1 AND vm_id = $2',
    [tenant_id, vm_id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ message: 'Observability removed from VM' });
}

// ── VM Logs entitlement (per-VM, admin-assigned; mirrors Observability) ───────

// GET /api/expansion/has-logs — any authenticated user
async function hasLogs(req, res) {
  const caller = req.user;
  if (!caller.tenant_id) return res.json({ logs_vm_ids: null, unlimited: true });
  const { rows } = await pool.query(
    'SELECT vm_id FROM vm_logs_assignments WHERE tenant_id = $1',
    [caller.tenant_id]
  );
  res.json({ logs_vm_ids: rows.map((r) => r.vm_id), unlimited: false });
}

// GET /api/expansion/logs/assignments?tenant_id=X — admin
async function listLogsAssignments(req, res) {
  const { tenant_id } = req.query;
  const where  = tenant_id ? 'WHERE la.tenant_id = $1' : '';
  const params = tenant_id ? [tenant_id] : [];
  const { rows } = await pool.query(
    `SELECT la.id, la.tenant_id, la.vm_id, la.assigned_at,
            t.name AS tenant_name, u.name AS assigned_by_name
     FROM vm_logs_assignments la
     JOIN tenants t ON t.id = la.tenant_id
     LEFT JOIN users u ON u.id = la.assigned_by
     ${where}
     ORDER BY la.assigned_at DESC`,
    params
  );
  res.json({ assignments: rows });
}

// GET /api/expansion/logs/quota — admin (purchased vs used per tenant)
async function getLogsQuota(req, res) {
  const { rows } = await pool.query(`
    SELECT t.id AS tenant_id, t.name AS tenant_name,
      COALESCE((
        SELECT SUM((item->>'qty')::int)
        FROM vm_expansion_requests r, jsonb_array_elements(r.items_json::jsonb) item
        WHERE r.tenant_id = t.id AND r.status NOT IN ('cancelled') AND item->>'id' = 'logs'
      ), 0)::int AS quota,
      COUNT(la.id)::int AS used
    FROM tenants t
    LEFT JOIN vm_logs_assignments la ON la.tenant_id = t.id
    GROUP BY t.id, t.name
    ORDER BY t.name
  `);
  res.json({ quotas: rows });
}

// POST /api/expansion/logs/assign — admin  { tenant_id, vm_id }
const LOGS_VMID_RE = /^(qemu|lxc)\/\d+$/;
async function assignLogs(req, res) {
  const { tenant_id, vm_id } = req.body;
  const caller = req.user;
  if (!tenant_id || !vm_id) return res.status(400).json({ error: 'tenant_id and vm_id are required' });
  if (!LOGS_VMID_RE.test(vm_id)) return res.status(400).json({ error: 'Invalid vm_id — expected qemu/<n> or lxc/<n>' });

  const quota = await purchasedQty(tenant_id, 'logs');
  const { rows: usedRows } = await pool.query(
    'SELECT COUNT(*)::int AS used FROM vm_logs_assignments WHERE tenant_id = $1', [tenant_id]
  );
  if (usedRows[0].used >= quota) {
    return res.status(400).json({ error: `Quota exceeded: tenant has ${quota} VM Logs slot(s) purchased, all ${usedRows[0].used} are already assigned.` });
  }

  const { rows } = await pool.query(
    `INSERT INTO vm_logs_assignments (tenant_id, vm_id, assigned_by)
     VALUES ($1, $2, $3) ON CONFLICT (tenant_id, vm_id) DO NOTHING RETURNING *`,
    [tenant_id, vm_id, caller.id]
  );
  res.status(201).json({ message: 'VM Logs assigned to VM', assignment: rows[0] ?? null });
}

// DELETE /api/expansion/logs/assign — admin  { tenant_id, vm_id }
async function unassignLogs(req, res) {
  const { tenant_id, vm_id } = req.body;
  if (!tenant_id || !vm_id) return res.status(400).json({ error: 'tenant_id and vm_id are required' });
  const { rowCount } = await pool.query(
    'DELETE FROM vm_logs_assignments WHERE tenant_id = $1 AND vm_id = $2', [tenant_id, vm_id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ message: 'VM Logs removed from VM' });
}

// ── Additional Public IPs (per-VM, admin-recorded; catalog id 'ip') ───────────

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IP_VMID_RE = /^(qemu|lxc)\/\d+$/;

// GET /api/expansion/ips/quota — admin (purchased vs active per tenant)
async function getIpQuota(req, res) {
  const { rows } = await pool.query(`
    SELECT t.id AS tenant_id, t.name AS tenant_name,
      COALESCE((
        SELECT SUM((item->>'qty')::int)
        FROM vm_expansion_requests r, jsonb_array_elements(r.items_json::jsonb) item
        WHERE r.tenant_id = t.id AND r.status NOT IN ('cancelled') AND item->>'id' = 'ip'
      ), 0)::int AS quota,
      COUNT(ip.id) FILTER (WHERE ip.status = 'active')::int AS used
    FROM tenants t
    LEFT JOIN vm_additional_ips ip ON ip.tenant_id = t.id
    GROUP BY t.id, t.name
    ORDER BY t.name
  `);
  res.json({ quotas: rows });
}

// GET /api/expansion/ips/assignments?tenant_id=X — admin
async function listIpAssignments(req, res) {
  const { tenant_id } = req.query;
  const where  = tenant_id ? 'WHERE ip.tenant_id = $1' : '';
  const params = tenant_id ? [tenant_id] : [];
  const { rows } = await pool.query(
    `SELECT ip.id, ip.tenant_id, ip.vm_id, host(ip.ip_address) AS ip_address, ip.purpose,
            ip.status, ip.created_at, ip.released_at,
            t.name AS tenant_name, u.name AS assigned_by_name
     FROM vm_additional_ips ip
     JOIN tenants t ON t.id = ip.tenant_id
     LEFT JOIN users u ON u.id = ip.assigned_by
     ${where}
     ORDER BY ip.status ASC, ip.created_at DESC`,
    params
  );
  res.json({ assignments: rows });
}

// POST /api/expansion/ips/assign — admin
// Body: { tenant_id, vm_id, ip_address, purpose?, request_id? }
async function assignIp(req, res) {
  const { tenant_id, vm_id, ip_address, purpose, request_id } = req.body;
  const caller = req.user;
  if (!tenant_id || !vm_id || !ip_address) {
    return res.status(400).json({ error: 'tenant_id, vm_id and ip_address are required' });
  }
  if (!IP_VMID_RE.test(vm_id)) return res.status(400).json({ error: 'Invalid vm_id — expected qemu/<n> or lxc/<n>' });
  if (!IPV4_RE.test(String(ip_address).trim())) return res.status(400).json({ error: 'Invalid IPv4 address' });

  const quota = await purchasedQty(tenant_id, 'ip');
  const { rows: usedRows } = await pool.query(
    "SELECT COUNT(*)::int AS used FROM vm_additional_ips WHERE tenant_id = $1 AND status = 'active'", [tenant_id]
  );
  if (usedRows[0].used >= quota) {
    return res.status(400).json({ error: `Quota exceeded: tenant has ${quota} IP slot(s) purchased, all ${usedRows[0].used} are already allocated.` });
  }

  let row;
  try {
    const { rows } = await pool.query(
      `INSERT INTO vm_additional_ips (tenant_id, vm_id, ip_address, purpose, request_id, assigned_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, tenant_id, vm_id, host(ip_address) AS ip_address, purpose, status, created_at`,
      [tenant_id, vm_id, String(ip_address).trim(), purpose ? String(purpose).slice(0, 200) : null, request_id || null, caller.id]
    );
    row = rows[0];
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'That IP is already allocated to a VM' });
    throw e;
  }

  // If tied to an expansion request, mark it fulfilled in the same action.
  if (request_id) {
    await pool.query(
      `UPDATE vm_expansion_requests SET status = 'fulfilled', fulfilled_at = NOW(), fulfilled_by = $1
       WHERE id = $2 AND tenant_id = $3 AND status = 'pending'`,
      [caller.id, request_id, tenant_id]
    ).catch(() => {});
  }

  res.status(201).json({ message: 'IP allocated to VM', assignment: row });
}

// DELETE /api/expansion/ips/assign — admin  { id }
async function releaseIp(req, res) {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id is required' });
  const { rowCount } = await pool.query(
    "UPDATE vm_additional_ips SET status = 'released', released_at = NOW() WHERE id = $1 AND status = 'active'", [id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Active IP assignment not found' });
  res.json({ message: 'IP released' });
}

// GET /api/expansion/my-ips — tenant read-only (active IPs, by VM)
async function myIps(req, res) {
  if (!req.user.tenant_id) return res.json({ ips: [] });
  const { rows } = await pool.query(
    `SELECT id, vm_id, host(ip_address) AS ip_address, purpose, created_at
     FROM vm_additional_ips WHERE tenant_id = $1 AND status = 'active'
     ORDER BY vm_id, created_at`,
    [req.user.tenant_id]
  );
  res.json({ ips: rows });
}

module.exports = {
  // Not an HTTP handler — invoked by the billing webhook hook (see app.js).
  ensureSubscriptionFulfilment,
  listPackages:           asyncHandler(listPackages),
  createPackage:          asyncHandler(createPackage),
  updatePackage:          asyncHandler(updatePackage),
  createExpansionOrder:   asyncHandler(createExpansionOrder),
  verifyExpansionPayment: asyncHandler(verifyExpansionPayment),
  listExpansionRequests:  asyncHandler(listExpansionRequests),
  fulfilRequest:          asyncHandler(fulfilRequest),
  cancelRequest:          asyncHandler(cancelRequest),
  myExpansionRequests:    asyncHandler(myExpansionRequests),
  createCustomOrder:        asyncHandler(createCustomOrder),
  verifyCustomPayment:      asyncHandler(verifyCustomPayment),
  createSubscriptionOrder:  asyncHandler(createSubscriptionOrder),
  activateSubscription:     asyncHandler(activateSubscription),
  cancelMySubscription:     asyncHandler(cancelMySubscription),
  hasObservability:         asyncHandler(hasObservability),
  listObsAssignments:       asyncHandler(listObsAssignments),
  getObsQuota:              asyncHandler(getObsQuota),
  assignObs:                asyncHandler(assignObs),
  unassignObs:              asyncHandler(unassignObs),
  hasLogs:                  asyncHandler(hasLogs),
  listLogsAssignments:      asyncHandler(listLogsAssignments),
  getLogsQuota:             asyncHandler(getLogsQuota),
  assignLogs:               asyncHandler(assignLogs),
  unassignLogs:             asyncHandler(unassignLogs),
  getIpQuota:               asyncHandler(getIpQuota),
  listIpAssignments:        asyncHandler(listIpAssignments),
  assignIp:                 asyncHandler(assignIp),
  releaseIp:                asyncHandler(releaseIp),
  myIps:                    asyncHandler(myIps),
};
