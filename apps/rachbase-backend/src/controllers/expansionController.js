'use strict';

const crypto    = require('crypto');
const geoip     = require('geoip-lite');
const pool      = require('@rach/core').pool;
const razorpay  = require('@rach/billing').razorpay;
const asyncHandler = require('@rach/core').asyncHandler;
const { sendInvoiceEmail } = require('@rach/core').brevo;

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

  // Verify signature if Razorpay payment IDs are present
  if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }
  }

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

// Prices in cents — single source of truth shared with the frontend catalog
const SERVICE_PRICES = {
  vm: 10000,  // $100
  lb:  2500,  // $25
  db: 10000,  // $100
};

// POST /api/expansion/custom/orders — tenant_admin
// Creates a Razorpay order for an arbitrary basket of services
async function createCustomOrder(req, res) {
  const { items, currency = 'USD' } = req.body;
  const caller = req.user;

  // tenant_id may be null — still allow
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' });
  }

  let totalCents = 0;
  const lineItems = [];

  for (const item of items) {
    const unitPrice = SERVICE_PRICES[item.id];
    if (!unitPrice) return res.status(400).json({ error: `Unknown service: ${item.id}` });
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      return res.status(400).json({ error: `Invalid quantity for ${item.id}` });
    }
    totalCents += unitPrice * item.qty;
    lineItems.push({ id: item.id, name: item.name, qty: item.qty, unit_price_cents: unitPrice });
  }

  const description = lineItems.map((li) => `${li.qty}× ${li.name}`).join(', ');
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
  const { items, total_cents, currency = 'USD', razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const caller = req.user;

  if (!caller.tenant_id) return res.status(403).json({ error: 'Forbidden' });
  if (!total_cents || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'total_cents and items are required' });
  }

  if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }
  }

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

  res.status(201).json({
    message: 'Resource expansion request submitted. Our team will provision your services shortly.',
    request: rows[0],
  });
}

// ── Subscription Orders ───────────────────────────────────────────────────────

// POST /api/expansion/subscriptions — tenant_admin
// Creates a Razorpay plan + subscription that starts immediately.
// Razorpay handles all billing dates automatically — no manual proration.
// No DB record is written until activateSubscription confirms payment.
async function createSubscriptionOrder(req, res) {
  const { items, description, total_cents, currency = 'USD', billing_country } = req.body;
  const caller = req.user;

  // tenant_id may be null — still allow
  if (!total_cents || !description) return res.status(400).json({ error: 'total_cents and description are required' });

  // ── Currency: detect country, convert USD → INR for Indian customers ────────
  // Map billing form country name → ISO code as fallback when IP detection fails
  const COUNTRY_NAME_TO_ISO = { 'India': 'IN', 'United States': 'US', 'United Kingdom': 'GB', 'Singapore': 'SG', 'Australia': 'AU', 'Canada': 'CA', 'Germany': 'DE', 'UAE': 'AE' };
  const ipCountry         = countryFromReq(req);
  const formCountry       = billing_country ? (COUNTRY_NAME_TO_ISO[billing_country] ?? billing_country) : null;
  const customerCountry   = ipCountry || formCountry;
  const isIndia           = customerCountry === 'IN';
  const USD_TO_INR        = parseFloat(process.env.USD_TO_INR || '90');

  console.log(`[expansion] country: ${customerCountry || 'unknown'} → billing in ${isIndia ? 'INR' : currency}`);

  let billingCurrency    = currency;
  let monthlyAmountSmall = total_cents; // smallest unit of billing currency

  if (currency === 'USD' && isIndia) {
    billingCurrency    = 'INR';
    monthlyAmountSmall = Math.round((total_cents / 100) * USD_TO_INR * 100);
  }

  let razorpayKeyId  = null;
  let planId         = null;
  let subscriptionId = null;

  const hasRazorpay = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

  if (hasRazorpay) {
    try {
      // Create plan for the monthly amount
      const plan = await razorpay.plans.create({
        period  : 'monthly',
        interval: 1,
        item    : { name: description, amount: monthlyAmountSmall, currency: billingCurrency, description },
      });
      planId = plan.id;

      // Create subscription — starts immediately, Razorpay charges on its own cycle
      const sub = await razorpay.subscriptions.create({
        plan_id        : plan.id,
        customer_notify: 0,
        quantity       : 1,
        total_count    : 120, // 10 years max; Razorpay requires ≥ 1
      });
      subscriptionId = sub.id;
      razorpayKeyId  = process.env.RAZORPAY_KEY_ID;
    } catch (rzErr) {
      console.error('[expansion] Razorpay setup failed:', rzErr.message || rzErr);
      const rzMsg = rzErr?.error?.description || rzErr?.message || 'Razorpay error';
      const err502 = new Error(`Payment gateway error: ${rzMsg}`);
      err502.status = 502;
      throw err502;
    }
  } else {
    console.warn('[expansion] Razorpay not configured — returning null IDs (dev mode)');
  }

  res.status(201).json({
    subscription_id : subscriptionId,
    plan_id         : planId,
    razorpay_key_id : razorpayKeyId,
    description,
    total_cents,
    currency,
    billing_currency: billingCurrency,
    monthly_amount  : monthlyAmountSmall,
    customer_country: customerCountry,
    converted       : billingCurrency !== currency,
  });
}

// POST /api/expansion/subscriptions/activate — tenant_admin
// Called after Razorpay subscription checkout succeeds.
// Verifies the subscription payment signature and creates the DB record.
async function activateSubscription(req, res) {
  const {
    // Subscription payment (Razorpay subscription flow)
    razorpay_subscription_id,
    razorpay_payment_id,
    razorpay_signature,
    razorpay_plan_id,
    // Cart metadata
    items,
    description,
    total_cents,
    currency = 'USD',
    billing_currency,
    monthly_amount,
  } = req.body;
  const caller = req.user;

  if (!description) return res.status(400).json({ error: 'description is required' });

  const secret = process.env.RAZORPAY_KEY_SECRET || '';

  // ── Verify subscription payment signature (payment_id|subscription_id) ───────
  if (razorpay_subscription_id && razorpay_payment_id && razorpay_signature) {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex');
    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Subscription payment signature verification failed' });
    }
  }

  // ── Create DB record ─────────────────────────────────────────────────────────
  const effectiveCurrency = billing_currency || currency;
  const effectiveAmount   = monthly_amount   || total_cents || 0;

  const notes = `Monthly: ${(effectiveAmount / 100).toFixed(2)} ${effectiveCurrency}`;

  const { rows } = await pool.query(
    `INSERT INTO vm_expansion_requests
       (tenant_id, requested_by, amount_paid, currency, status,
        custom_description, items_json, notes,
        razorpay_payment_id,
        razorpay_plan_id, razorpay_subscription_id,
        subscription_status)
     VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,'active')
     RETURNING *`,
    [
      caller.tenant_id,
      caller.id,
      effectiveAmount,
      effectiveCurrency,
      description,
      JSON.stringify(items || []),
      notes,
      razorpay_payment_id || null,
      razorpay_plan_id    || null,
      razorpay_subscription_id || null,
    ]
  );

  const order = rows[0];

  // Send invoice email to customer + admin (fire-and-forget)
  try {
    const userRow = await pool.query('SELECT name, email FROM users WHERE id = $1', [caller.id]);
    const customer = userRow.rows[0] || {};
    sendInvoiceEmail({
      orderId       : order.id,
      customerName  : customer.name  || caller.name  || 'Customer',
      customerEmail : customer.email || caller.email || '',
      description,
      items         : items || [],
      amountPaid    : effectiveAmount,
      currency      : effectiveCurrency,
      subscriptionId: razorpay_subscription_id || null,
      requestedAt   : order.requested_at,
    }).catch((err) => console.error('[invoice] email failed:', err.message));
  } catch (err) {
    console.error('[invoice] failed to send:', err.message);
  }

  res.status(201).json({
    message: 'Subscription activated. Resources will be provisioned shortly.',
    request: order,
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
