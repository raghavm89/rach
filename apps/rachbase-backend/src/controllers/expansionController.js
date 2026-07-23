'use strict';

const geoip     = require('geoip-lite');
const pool      = require('@rach/core').pool;
const razorpay  = require('@rach/billing').razorpay;
const { priceCart, PricingError } = require('@rach/billing').catalog;
const { verifyOrderPayment } = require('@rach/billing').paymentSecurity;
const purchase = require('@rach/billing').purchase;
const asyncHandler = require('@rach/core').asyncHandler;
const { sendInvoiceEmail, sendOrderNotificationEmail } = require('@rach/core').brevo;

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

  // Fetch the request — must belong to caller's tenant and be cancellable
  const { rows: found } = await pool.query(
    `SELECT * FROM vm_expansion_requests
     WHERE id = $1 AND tenant_id = $2 AND status NOT IN ('cancelled')`,
    [id, caller.tenant_id]
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
  const { items, bundle_id, billing_country, allow_duplicate } = req.body;

  let result;
  try {
    result = await purchase.createSubscriptionPurchase({
      user          : req.user,
      bundle_id,
      items,
      billingCountry: billing_country,
      ipCountry     : countryFromReq(req),
      // The client must opt in explicitly to run a second identical
      // subscription; an accidental repeat is refused with 409.
      allowDuplicate: allow_duplicate === true,
    });
  } catch (err) {
    if (err instanceof PricingError) return res.status(400).json({ error: err.message, code: err.code });
    if (err.code === 'duplicate_subscription') {
      return res.status(409).json({
        error: err.message,
        code : err.code,
        existing_subscription_id: err.existing_subscription_id,
        // Retry with allow_duplicate: true to proceed anyway.
        retry_with: { allow_duplicate: true },
      });
    }
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const { priced, billing, subscription, razorpay: rz } = result;

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

  const { priced, billing, subscription, order: billingOrder, payment, invoice } = result;

  const notes = `Monthly: ${(billing.amountMinor / 100).toFixed(2)} ${billing.currency}`;

  // The fulfilment record. Amounts here mirror the billing rows for display;
  // subscriptions/orders remain the source of truth for money.
  const { rows } = await pool.query(
    `INSERT INTO vm_expansion_requests
       (tenant_id, requested_by, amount_paid, currency, status,
        custom_description, items_json, notes,
        razorpay_payment_id, razorpay_plan_id, razorpay_subscription_id,
        subscription_status, subscription_id, order_id)
     VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,'active',$11,$12)
     RETURNING *`,
    [
      caller.tenant_id,
      caller.id,
      billing.amountMinor,
      billing.currency,
      priced.description,
      JSON.stringify(priced.lines),
      notes,
      req.body.razorpay_payment_id || null,
      razorpay_plan_id || null,
      req.body.razorpay_subscription_id || null,
      subscription?.id ?? null,
      billingOrder?.id ?? null,
    ]
  );

  const order = rows[0];
  if (invoice?.ok) order.invoice_number = invoice.invoice.invoice_number;

  // Order-confirmation email (fire-and-forget). The tax invoice with its PDF is
  // sent separately by the purchase service.
  try {
    const userRow = await pool.query('SELECT name, email FROM users WHERE id = $1', [caller.id]);
    const customer = userRow.rows[0] || {};
    sendInvoiceEmail({
      orderId       : order.id,
      customerName  : customer.name  || caller.name  || 'Customer',
      customerEmail : customer.email || caller.email || '',
      description   : priced.description,
      items         : priced.lines,
      amountPaid    : billing.amountMinor,
      currency      : billing.currency,
      subscriptionId: req.body.razorpay_subscription_id,
      requestedAt   : order.requested_at,
    }).catch((e) => console.error('[expansion] confirmation email failed:', e.message));
  } catch (e) {
    console.error('[expansion] confirmation email failed:', e.message);
  }

  // Notify admin the order completed (fire-and-forget)
  notifyOrderPlaced(order, (priced.lines || []).map((l) => ({ name: l.name, qty: l.qty })));

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
async function assignObs(req, res) {
  const { tenant_id, vm_id } = req.body;
  const caller = req.user;
  if (!tenant_id || !vm_id) return res.status(400).json({ error: 'tenant_id and vm_id are required' });

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

module.exports = {
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
};
