'use strict';

/**
 * Recurring shared-tier billing — subscribe-first, base + add-on model.
 *
 *   - You subscribe to a TIER first: a monthly **base** subscription (starter = $15 / 1 nano
 *     included; pro = $30 / 3 nano included). `tenants.plan` flips to that tier; the base
 *     row records the tier. Deploying a container is blocked until then.
 *   - Each container beyond the tier's allowance is a $10 + compute **add-on** subscription.
 *     Within the allowance a container has NO subscription (fee waived — nano = free). So a
 *     container is "free" iff it has no live sub; "billable" iff it has one. There is no
 *     single allowance holder: the first N containers (by online order) are free; deleting a
 *     free one promotes the oldest billable into the freed slot.
 *
 * Each add-on maps to a real monthly Razorpay subscription. New subs need a checkout (mandate
 * authorization); a downsize reuses the mandate via subscriptions.update; an UPSIZE is gated
 * on a one-time delta payment. Amounts come from the pricing authority; the client never
 * sends one.
 */

const { pool } = require('@rach/core');
const billing = require('@rach/billing'); // kept as the module object so tests can stub issueInvoiceForPayment
const { razorpay, proPricing } = billing;
const { Service } = require('../models/project');
const { setTenantPlan } = require('../lib/plan');
const proTax = require('./proTax');
const siteTeardown = require('./siteTeardown');
const containerBilling = require('./containerBilling'); // currency lock on webhook-activated bases (F6)

// ── Pure decision layer (unit-tested) ──────────────────────────────────────────
// Recurring amount for one container on `tier`. The tier's allowance waives the $10 fee
// while existingCount < included (compute-delta only); beyond it pays $10 + compute.
function containerAmountCents({ tier, existingCount, size, currency = 'USD' }) {
  return proPricing.deployChargeCents(tier, existingCount, size, currency);
}

// Classify a Razorpay subscription webhook event for the container lifecycle:
//   'charged'  → renewed/paid → keep online (recover if it was stopped).
//   'terminal' → halted/cancelled/completed/expired → take the container(s) offline.
//   'ignore'   → anything else.
function webhookAction(event) {
  if (event === 'charged') return 'charged';
  if (['halted', 'cancelled', 'completed', 'expired'].includes(event)) return 'terminal';
  return 'ignore';
}

// ── DB rows (pro_subscriptions) ─────────────────────────────────────────────────
const ProSub = {
  async baseForTenant(tenantId) {
    const { rows } = await pool.query(
      `SELECT * FROM pro_subscriptions WHERE tenant_id = $1 AND kind = 'base' AND status <> 'cancelled' LIMIT 1`, [tenantId]);
    return rows[0] || null;
  },
  async liveForService(serviceId) {
    const { rows } = await pool.query(
      `SELECT * FROM pro_subscriptions WHERE service_id = $1 AND status <> 'cancelled' LIMIT 1`, [serviceId]);
    return rows[0] || null;
  },
  async findByRazorpaySub(subId) {
    const { rows } = await pool.query(`SELECT * FROM pro_subscriptions WHERE razorpay_sub_id = $1 LIMIT 1`, [subId]);
    return rows[0] || null;
  },
  async setStatus(id, status) {
    await pool.query(`UPDATE pro_subscriptions SET status = $2, updated_at = NOW() WHERE id = $1`, [id, status]);
  },
  async listLiveByTenant(tenantId) {
    const { rows } = await pool.query(
      `SELECT * FROM pro_subscriptions WHERE tenant_id = $1 AND status <> 'cancelled' ORDER BY id ASC`, [tenantId]);
    return rows;
  },
  // All CONTAINER subs for a tenant in a given status (used to pause/resume on base halt).
  async containersByStatus(tenantId, status) {
    const { rows } = await pool.query(
      `SELECT * FROM pro_subscriptions WHERE tenant_id = $1 AND kind = 'container' AND status = $2 ORDER BY id ASC`,
      [tenantId, status]);
    return rows;
  },
  async create({ tenantId, serviceId, kind, razorpaySubId, razorpayPlanId, amountCents, currency, size, tier, userId }) {
    const { rows } = await pool.query(
      `INSERT INTO pro_subscriptions
         (tenant_id, service_id, kind, razorpay_sub_id, razorpay_plan_id, amount_cents, currency, compute_size, tier, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'created',$10) RETURNING *`,
      [tenantId, serviceId, kind, razorpaySubId, razorpayPlanId, amountCents, currency, size, tier || null, userId || null]);
    return rows[0];
  },
  async activate(razorpaySubId) {
    await pool.query(`UPDATE pro_subscriptions SET status = 'active', updated_at = NOW() WHERE razorpay_sub_id = $1`, [razorpaySubId]);
  },
  async cancelRow(id) {
    await pool.query(`UPDATE pro_subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);
  },
  async reprice(id, { kind, amountCents, size, razorpayPlanId }) {
    await pool.query(
      `UPDATE pro_subscriptions SET kind = $2, amount_cents = $3, compute_size = $4, razorpay_plan_id = $5, updated_at = NOW() WHERE id = $1`,
      [id, kind, amountCents, size, razorpayPlanId]);
  },
  // Tier change on the BASE row (upgrade in place — mandate and razorpay_sub_id unchanged).
  async repriceBase(id, { tier, amountCents, razorpayPlanId }) {
    await pool.query(
      `UPDATE pro_subscriptions SET tier = $2, amount_cents = $3, razorpay_plan_id = $4, updated_at = NOW() WHERE id = $1 AND kind = 'base'`,
      [id, tier, amountCents, razorpayPlanId]);
  },
  // Point the base row at the service currently holding the included allowance (or null).
  async setBaseService(baseId, serviceId) {
    await pool.query(`UPDATE pro_subscriptions SET service_id = $2, updated_at = NOW() WHERE id = $1`, [baseId, serviceId]);
  },
};

// ── Razorpay ops (mirrors purchase.js: monthly plan + subscription) ─────────────
// `amountCents` is EX-GST (from proPricing). We gross it up to the tax-inclusive amount the
// invoice will reconcile to, and charge THAT through Razorpay — so the recurring plan, the
// checkout total shown to the customer, and every reissued tax invoice all agree. Zero tax
// (Rest-of-World, or India before the GST registration is inserted) → gross == subtotal.
async function rzCreateSubscription({ amountCents, currency, description, userId }) {
  const { grossCents } = await proTax.grossUpFor({ userId, subtotalCents: amountCents, currency, description });
  const plan = await razorpay.plans.create({
    period: 'monthly', interval: 1,
    item: { name: description.slice(0, 255), amount: grossCents, currency, description: description.slice(0, 255) },
  });
  const sub = await razorpay.subscriptions.create({ plan_id: plan.id, customer_notify: 0, quantity: 1, total_count: 120 });
  return { plan, sub, grossCents };
}

// Change a live subscription's recurring amount without a new checkout: a fresh plan
// swapped in immediately (the existing mandate keeps charging the new amount). The new
// recurring is charged GST-inclusive too (gross up the ex-GST target).
async function rzUpdateAmount(subId, { amountCents, currency, description, userId }) {
  const { grossCents } = await proTax.grossUpFor({ userId, subtotalCents: amountCents, currency, description });
  const plan = await razorpay.plans.create({
    period: 'monthly', interval: 1,
    item: { name: description.slice(0, 255), amount: grossCents, currency, description: description.slice(0, 255) },
  });
  await razorpay.subscriptions.update(subId, { plan_id: plan.id, schedule_change_at: 'now', quantity: 1 });
  return plan;
}

async function rzCancel(subId) {
  if (!subId) return;
  try { await razorpay.subscriptions.cancel(subId); }
  catch (e) { console.warn(`[pro-sub] Razorpay cancel failed for ${subId}: ${e.message}`); }
}

// Pause / resume a Razorpay subscription so it stops / restarts billing without losing
// the mandate (used when the tenant BASE halts and later recovers). Best-effort: if the
// SDK/plan doesn't support pause, we log and carry on (local status still reflects it).
async function rzPause(subId) {
  if (!subId) return false;
  try {
    if (typeof razorpay.subscriptions.pause !== 'function') throw new Error('pause unsupported');
    await razorpay.subscriptions.pause(subId, { pause_at: 'now' });
    return true;
  } catch (e) { console.warn(`[pro-sub] Razorpay pause failed for ${subId}: ${e.message}`); return false; }
}
async function rzResume(subId) {
  if (!subId) return false;
  try {
    if (typeof razorpay.subscriptions.resume !== 'function') throw new Error('resume unsupported');
    await razorpay.subscriptions.resume(subId, { resume_at: 'now' });
    return true;
  } catch (e) { console.warn(`[pro-sub] Razorpay resume failed for ${subId}: ${e.message}`); return false; }
}

// One-time order for an UPSIZE delta (charged now; the recurring is repriced on verify).
// `amountCents` is the EX-GST delta; charge it GST-inclusive so it matches the resize invoice.
async function rzCreateOrder({ amountCents, currency, tenantId, serviceId, userId }) {
  const { grossCents } = await proTax.grossUpFor({ userId, subtotalCents: amountCents, currency, description: 'RachBase container resize' });
  const order = await razorpay.orders.create({
    amount: grossCents,
    currency,
    receipt: `resize_${serviceId}_${Date.now()}`,
    notes: { kind: 'container_resize', tenant_id: String(tenantId), service_id: String(serviceId) },
  });
  return { order, grossCents };
}

// ── Orchestration ───────────────────────────────────────────────────────────────

// Waive one container ROW's fee — repriced to compute-only, or its sub cancelled outright
// when it becomes free nano (the container keeps running either way).
async function waiveContainerFee(row, tier) {
  const newAmount = proPricing.deployChargeCents(tier, 0, row.compute_size, row.currency); // fee waived → compute only
  if (newAmount === 0) { await rzCancel(row.razorpay_sub_id); await ProSub.cancelRow(row.id); } // free nano
  else {
    const plan = await rzUpdateAmount(row.razorpay_sub_id, { amountCents: newAmount, currency: row.currency, description: `RachBase container — ${row.compute_size}`, userId: row.created_by });
    await ProSub.reprice(row.id, { kind: 'container', amountCents: newAmount, size: row.compute_size, razorpayPlanId: plan.id });
  }
}

// A row is promotable only when it is an ACTIVE container subscription still PAYING the
// container fee (recurring == fee + compute). Anything else must never consume a freed
// allowance slot (audit #3, F5): a 'created' row is an abandoned checkout, a 'halted' one
// is unpaid, a 'paused' one is frozen behind a halted base, and an active row already at
// compute-only pricing had its fee waived by an earlier promotion — "promoting" any of
// those burns the slot while a genuinely paying container keeps a fee it should not owe.
function isFeePayingContainer(r) {
  return r.kind === 'container'
    && r.status === 'active'
    && r.amount_cents === proPricing.containerSubscriptionCents(r.compute_size, r.currency);
}

// Promote the tenant's OLDEST fee-paying container into a free allowance slot. Used by
// cancelForService (a free container was deleted → exactly one slot opened). Returns true
// if a container was promoted, false when none qualifies.
async function promoteOldestIntoFreeSlot(tenantId, tier, excludeServiceId = 0) {
  const live = await ProSub.listLiveByTenant(tenantId); // ordered by id ASC (oldest first)
  const promote = live.find((r) => isFeePayingContainer(r) && r.service_id !== excludeServiceId);
  if (!promote) return false;
  await waiveContainerFee(promote, tier);
  return true;
}

/**
 * Upgrade an ACTIVE base to a bigger tier in place (starter → pro), reusing the mandate:
 * reprice the recurring to the new tier's base (GST-inclusive via rzUpdateAmount; the next
 * renewal bills the new amount — no immediate charge for the partial month, deliberately in
 * the customer's favor), record the new tier, reopen the gate, and PROMOTE the oldest
 * billable containers into the allowance slots the upgrade just created. Before this,
 * requesting Pro on an active Starter silently no-opped while the UI showed a success
 * screen (go-live audit H4: lost upsell + a lying confirmation).
 */
async function upgradeBase(base, { tenantId, tier }) {
  const label = (proPricing.TIERS[tier]?.label) || tier;
  const amountCents = proPricing.baseSubscriptionCents(tier, 'nano', base.currency); // ex-GST
  const plan = await rzUpdateAmount(base.razorpay_sub_id, {
    amountCents, currency: base.currency, description: `RachBase ${label} — monthly base`, userId: base.created_by,
  });
  await ProSub.repriceBase(base.id, { tier, amountCents, razorpayPlanId: plan.id });
  await setTenantPlan(tenantId, tier).catch(() => {});
  // The allowance grew by (new included − old included): waive the fee on the OLDEST
  // FEE-PAYING containers, one per freed slot. Snapshot the rows FIRST — a promoted micro
  // keeps a live compute-only sub, so re-querying each iteration would pick the same row
  // twice — and filter to active fee-paying rows only (audit #3, F5: an abandoned 'created'
  // checkout or an already-waived row must not eat a slot from a paying container).
  const freed = proPricing.baseIncludes(tier) - proPricing.baseIncludes(base.tier || proPricing.DEFAULT_TIER);
  const live = await ProSub.listLiveByTenant(tenantId);
  const oldestBillable = live.filter(isFeePayingContainer).slice(0, Math.max(0, freed));
  for (const row of oldestBillable) await waiveContainerFee(row, tier);
  const promoted = oldestBillable.length;
  const { grossCents } = await proTax.grossUpFor({ userId: base.created_by, subtotalCents: amountCents, currency: base.currency, description: `RachBase ${label} — monthly base` });
  return { upgraded: true, tier, amountCents: grossCents, subtotalCents: amountCents, currency: base.currency, promotedContainers: promoted };
}

/**
 * Subscribe to a shared TIER — create the tenant's monthly base subscription (no container
 * yet). starter = $15/1-incl, pro = $30/3-incl. On payment the caller activates it and flips
 * `tenants.plan` to the tier. An active base at the SAME tier returns { alreadyActive }; a
 * BIGGER tier upgrades in place (see upgradeBase); a smaller one returns
 * { downgradeUnsupported } — shrinking the allowance would force-bill currently-free
 * containers, so downgrades go through unsubscribe/resubscribe (or support) deliberately.
 */
async function beginProBase({ tenantId, tier = proPricing.DEFAULT_TIER, currency = 'USD', userId }) {
  const base = await ProSub.baseForTenant(tenantId); // at most one live (active|created)
  if (base && base.status === 'active') {
    const currentTier = base.tier || proPricing.DEFAULT_TIER;
    if (currentTier === tier) return { alreadyActive: true, tier: currentTier };
    if (proPricing.baseIncludes(tier) > proPricing.baseIncludes(currentTier)) {
      return upgradeBase(base, { tenantId, tier });
    }
    return { downgradeUnsupported: true, tier: currentTier, requestedTier: tier };
  }
  // A base row exists but payment never cleared (status 'created') → RESUME that checkout —
  // unless the customer now wants a DIFFERENT tier: resuming used to hand back the stale
  // tier's subscription while the review page showed the requested one (go-live audit M2).
  // A mismatched stale checkout is cancelled and a fresh one created below.
  //
  // A HALTED base is treated the same way regardless of tier (audit #3, F7): Razorpay
  // checkout cannot re-authorize a halted subscription, so "resuming" it hands the customer
  // a dead checkout. An explicit re-subscribe is their intent to pay fresh — cancel the
  // halted sub (ending Razorpay's own retry loop, deliberately) and mint a new one. The
  // charged-webhook path (retried card succeeding on its own) still recovers a halt in place.
  if (base && (base.status === 'halted' || (base.tier || proPricing.DEFAULT_TIER) !== tier)) {
    await rzCancel(base.razorpay_sub_id);
    await ProSub.cancelRow(base.id);
  } else if (base) {
    const { grossCents } = await proTax.grossUpFor({ userId, subtotalCents: base.amount_cents, currency: base.currency, description: 'RachBase base — monthly' });
    return { subscriptionId: base.razorpay_sub_id, planId: base.razorpay_plan_id, amountCents: grossCents, subtotalCents: base.amount_cents, currency: base.currency, tier: base.tier || tier, resumed: true };
  }
  const label = (proPricing.TIERS[tier]?.label) || 'Starter';
  const amountCents = proPricing.baseSubscriptionCents(tier, 'nano', currency); // ex-GST
  const { plan: rzPlan, sub, grossCents } = await rzCreateSubscription({ amountCents, currency, description: `RachBase ${label} — monthly base`, userId });
  await ProSub.create({ tenantId, serviceId: null, kind: 'base', razorpaySubId: sub.id, razorpayPlanId: rzPlan.id, amountCents, currency, size: 'nano', tier, userId });
  return { subscriptionId: sub.id, planId: rzPlan.id, amountCents: grossCents, subtotalCents: amountCents, currency, tier };
}

/**
 * Bring a container online, or resize an already-billed one (requires an active base).
 *  - live ACTIVE sub for this service → billable container → RESIZE (downsize inline / upsize
 *    via one-time delta).
 *  - a free (within-allowance) container being upsized → a fresh $?(compute) add-on sub.
 *  - a brand-new container within the tier allowance at nano → { free: true }, no sub.
 *  - otherwise a $10(+compute) add-on subscription → checkout.
 * The tier (starter=1 incl / pro=3 incl) comes from the tenant's base subscription.
 */
async function beginOnline({ tenantId, service, size, currency, userId }) {
  const base = await ProSub.baseForTenant(tenantId);
  const tier = base?.tier || proPricing.DEFAULT_TIER;
  const buyerId = userId || service.created_by;
  const existing = await ProSub.liveForService(service.id);

  // A sub row that is NOT yet paid ('created') = an abandoned checkout. It must NOT be
  // treated as an active container (that's how a cancelled payment used to bring the
  // container online). Resume its checkout if the size still matches; otherwise cancel
  // the stale one and create a fresh subscription below.
  if (existing && existing.status === 'created') {
    if (existing.compute_size === size) {
      const { grossCents } = await proTax.grossUpFor({ userId: buyerId, subtotalCents: existing.amount_cents, currency: existing.currency, description: `RachBase container — ${size}` });
      return { subscriptionId: existing.razorpay_sub_id, planId: existing.razorpay_plan_id, amountCents: grossCents, subtotalCents: existing.amount_cents, currency: existing.currency, kind: existing.kind, resumed: true };
    }
    await rzCancel(existing.razorpay_sub_id);
    await ProSub.cancelRow(existing.id);
  } else if (existing && existing.status === 'active') { // PAID, BILLABLE container → resize
    if (existing.compute_size === size) return { resized: true, unchanged: true };
    // A billable container always pays $10 + compute (its fee is not part of any allowance).
    const newAmount = proPricing.containerSubscriptionCents(size, existing.currency);
    const currentAmount = existing.amount_cents;

    if (newAmount <= currentAmount) { // downsize (cheaper) → reprice down + apply now (no payment)
      const plan = await rzUpdateAmount(existing.razorpay_sub_id, { amountCents: newAmount, currency: existing.currency, description: `RachBase container — ${size}`, userId: existing.created_by });
      await ProSub.reprice(existing.id, { kind: 'container', amountCents: newAmount, size, razorpayPlanId: plan.id });
      return { resized: true, amountCents: newAmount, size };
    }
    // UPSIZE (more expensive) → collect a one-time DELTA payment FIRST. Do NOT reprice the
    // recurring or bring the bigger size online yet; that happens on verify (commitResize).
    const deltaCents = newAmount - currentAmount; // ex-GST
    const { order, grossCents } = await rzCreateOrder({ amountCents: deltaCents, currency: existing.currency, tenantId, serviceId: service.id, userId: existing.created_by });
    return { resizeCheckout: true, orderId: order.id, deltaCents: grossCents, subtotalDeltaCents: deltaCents, newAmountCents: newAmount, currency: existing.currency, size };
  } else if (existing && existing.status === 'halted') {
    // A halted (failed-payment) subscription must NOT be resized back online. Drop it and
    // fall through to a fresh subscription + checkout below.
    await rzCancel(existing.razorpay_sub_id);
    await ProSub.cancelRow(existing.id);
  }

  // No live sub for this service. Two cases:
  //   • the service is already ONLINE with no sub → it occupies a FREE allowance slot; an
  //     upsize costs only the compute delta (fee stays waived → existingCount 0).
  //   • otherwise a brand-new deploy → its fee depends on how many containers are already
  //     billable-online (existingCount) vs the tier's included allowance.
  const isFreeSlot = service.status === 'online';
  const existingCount = isFreeSlot ? 0 : await Service.countBillableShared(tenantId, service.id);
  const amountCents = containerAmountCents({ tier, existingCount, size, currency });

  if (amountCents === 0) return { free: true }; // within allowance at nano — no sub
  const { plan: rzPlan, sub, grossCents } = await rzCreateSubscription({ amountCents, currency, description: `RachBase container — ${service.name} (${size})`, userId: buyerId });
  await ProSub.create({ tenantId, serviceId: service.id, kind: 'container', razorpaySubId: sub.id, razorpayPlanId: rzPlan.id, amountCents, currency, size, tier, userId: buyerId });
  return { subscriptionId: sub.id, planId: rzPlan.id, amountCents: grossCents, subtotalCents: amountCents, currency, kind: 'container' };
}

async function activate(razorpaySubId) { await ProSub.activate(razorpaySubId); }

/**
 * Apply a verified UPSIZE: reprice the container's recurring subscription up to the new
 * amount (the one-time delta was already paid + verified by the caller). Returns the new
 * recurring amount so the caller can respond. The caller then marks the service online at
 * the new size. No-op-safe if the sub isn't active (returns the computed amount).
 */
async function commitResize({ tenantId, service, size, currency = 'USD' }) {
  const existing = await ProSub.liveForService(service.id);
  const newAmount = proPricing.containerSubscriptionCents(size, existing?.currency || currency); // billable: $10 + compute
  if (existing && existing.status === 'active') {
    const plan = await rzUpdateAmount(existing.razorpay_sub_id, { amountCents: newAmount, currency: existing.currency, description: `RachBase container — ${size}`, userId: existing.created_by });
    await ProSub.reprice(existing.id, { kind: 'container', amountCents: newAmount, size, razorpayPlanId: plan.id });
  }
  return { newAmountCents: newAmount };
}

// Cancel a service's container subscription. Deleting a FREE (no-sub) container opens an
// allowance slot → promote the oldest billable container into it (its $10 fee waived —
// repriced to compute-only, or its sub cancelled when it becomes free nano). The tenant
// base is untouched here.
async function cancelForService({ tenantId, service }) {
  const base = await ProSub.baseForTenant(tenantId);
  const tier = base?.tier || proPricing.DEFAULT_TIER;
  const row = await ProSub.liveForService(service.id);
  if (row) { await rzCancel(row.razorpay_sub_id); await ProSub.cancelRow(row.id); }

  // A slot only opens if the deleted service was actually OCCUPYING a free allowance slot — i.e.
  // it was a live (online) shared container with no subscription. A draft or pending-checkout
  // service has no sub either, but never held a slot; promoting on its deletion used to cancel a
  // paying container's Razorpay subscription while it kept running (revenue leak, go-live P0 #5a).
  const heldFreeSlot = !row && service.compute_target === 'shared' && service.status === 'online';
  if (heldFreeSlot) { // the deleted container was within the free allowance → a slot just opened
    await promoteOldestIntoFreeSlot(tenantId, tier, service.id);
  }
  return { cancelled: row ? 1 : 0 };
}

// Cancel every live subscription for a tenant (unsubscribe Pro).
async function cancelAllForTenant(tenantId) {
  const rows = await ProSub.listLiveByTenant(tenantId);
  for (const r of rows) { await rzCancel(r.razorpay_sub_id); await ProSub.cancelRow(r.id); }
  return rows.length;
}

/**
 * Issue the GST tax invoice for one webhook-reported subscription charge (renewal cycles —
 * the FIRST cycle is invoiced by the /verify endpoints, idempotently on the same payment id).
 *
 * The line is the row's EX-GST recurring amount; the invoice engine re-adds GST from the
 * buyer's profile, so the invoice total equals the grossed amount Razorpay charged. Keyed on
 * `razorpay_payment_id`, so webhook retries and the verify/webhook overlap on cycle 1 can't
 * double-issue. Never throws (invoice issuance is downstream of money that already moved) —
 * but a charge/invoice total mismatch is logged LOUDLY because it means the recurring plan
 * and the buyer's tax profile have drifted (e.g. the plan predates a GST registration).
 */
async function invoiceChargedCycle(row, { razorpaySubId, paymentId, amountMinor }) {
  if (!paymentId) return { skipped: 'no_payment_id' }; // defensive: hook always sends it for 'charged'
  const userId = row.created_by;
  if (!userId) {
    console.error(`[pro-sub] cannot invoice charge ${paymentId}: pro_subscription ${row.id} has no created_by user`);
    return { skipped: 'no_user' };
  }
  const label = row.kind === 'base'
    ? `RachBase ${(proPricing.TIERS[row.tier]?.label) || 'Starter'} — monthly base`
    : `RachBase container — ${row.compute_size || 'nano'} (monthly)`;
  const out = await billing.issueInvoiceForPayment({
    userId,
    currency: row.currency,
    lines: [{ description: label, quantity: 1, unit_price_minor: row.amount_cents }],
    payment: { razorpay_subscription_id: razorpaySubId, razorpay_payment_id: paymentId },
  });
  const total = out && out.invoice ? Number(out.invoice.total_minor) : null;
  if (out && out.ok && !out.duplicate && Number.isFinite(total) && Number.isFinite(Number(amountMinor)) && total !== Number(amountMinor)) {
    console.error(
      `[pro-sub] INVOICE/CHARGE MISMATCH sub=${razorpaySubId} payment=${paymentId}: ` +
      `invoice total ${total} ≠ charged ${amountMinor} ${row.currency} — recurring plan and tax profile have drifted; reprice the subscription.`);
  }
  return out;
}

/**
 * React to a Razorpay subscription webhook (fired via billing hooks). Idempotent and a
 * no-op for subscriptions that aren't ours.
 *
 * Subscription → feature mapping is authoritative here:
 *   - a CONTAINER subscription funds exactly its `service_id` (at its current size);
 *   - the BASE subscription funds the whole Pro tier (the `plan='pro'` gate + every
 *     shared container).
 *
 * Cascade on failure ("if a subscription halts, its feature halts"):
 *   - container halt/cancel → that one container stops.
 *   - base HALT (transient, retrying) → stop ALL shared containers, close the Pro gate
 *     (plan → 'max'), and PAUSE every container subscription so nothing bills while the
 *     base is unpaid. A later base renewal RESUMES them and brings everything back —
 *     no re-subscribe.
 *   - base CANCEL/EXPIRE (permanent) → tear the tier down: stop all shared containers,
 *     cancel every container subscription, and revert to 'max'.
 */
async function handleWebhook({ razorpaySubId, event, paymentId, amountMinor }) {
  const action = webhookAction(event);
  if (action === 'ignore') return { handled: false };
  const row = await ProSub.findByRazorpaySub(razorpaySubId);
  if (!row) return { handled: false }; // not a Pro subscription

  // CANCELLED IS TERMINAL. A webhook delivered (or retried by Razorpay, up to days later)
  // after unsubscribe/tenant-delete must never resurrect the subscription: without this
  // guard a late `charged` flipped the row back to active, reopened the Pro gate — even on
  // a soft-deleted tenant — and marked services online with no live mandate behind them
  // (re-audit 6 Sep, N5). If money DID move on that final charge we still paper it with an
  // invoice below (the customer paid; the refund/credit is an ops decision), but nothing
  // else changes state.
  if (row.status === 'cancelled') {
    if (action === 'charged') await invoiceChargedCycle(row, { razorpaySubId, paymentId, amountMinor });
    return { handled: true, stale: true, action, kind: row.kind };
  }

  if (action === 'charged') {
    // Renewal cycles get their GST tax invoice HERE — the webhook is the only place that
    // sees cycle ≥2 charges (re-audit 6 Sep, N2: month-2+ Indian charges had no invoice).
    // Idempotent per payment id, so the cycle-1 verify/webhook overlap issues exactly one.
    await invoiceChargedCycle(row, { razorpaySubId, paymentId, amountMinor });

    if (row.status !== 'active') await ProSub.setStatus(row.id, 'active');

    if (row.kind === 'base') {
      // Base recovered → reopen the gate at the base's TIER and RESUME every container we
      // paused when it halted, bringing each back online.
      await setTenantPlan(row.tenant_id, row.tier || 'starter').catch(() => {});
      // Money moved without /pro/verify running (tab closed — the very case this webhook
      // backstops), so apply verify's side effect here too: lock the tenant's billing
      // currency. Idempotent; never overwrites an existing lock (audit #3, F6).
      await containerBilling.lockBillingCurrency(row.tenant_id, row.currency).catch(() => {});
      const paused = await ProSub.containersByStatus(row.tenant_id, 'paused');
      for (const c of paused) {
        await rzResume(c.razorpay_sub_id);
        await ProSub.setStatus(c.id, 'active');
        if (c.service_id) await Service.markOnline(c.service_id, c.compute_size);
      }
      // Lift any site-level suspension UNCONDITIONALLY on a paid base charge. Deriving this
      // from `wasHalted` missed every other way the tenant got suspended — unsubscribe →
      // re-subscribe (fresh 'created' row), a halted row replaced by the stale-checkout
      // branch, or a crash after setStatus('active') made the retry read 'active' — leaving
      // paying customers at 0 replicas forever (audit #3, F1). tenant.resume is idempotent
      // on the site (a running tenant is a no-op), so a routine renewal enqueues a cheap
      // no-op op; a suspended tenant comes back. Best-effort by contract.
      await siteTeardown.enqueueTenantResumeOp(row.tenant_id, 'base_charge_paid');
    }
    if (row.service_id) await Service.markOnline(row.service_id, row.compute_size); // recover/keep online
    return { handled: true, action: 'charged', kind: row.kind };
  }

  // ── terminal: halted (transient) vs cancelled/completed/expired (permanent) ──
  const transient = event === 'halted';

  if (row.kind === 'base') {
    await ProSub.setStatus(row.id, transient ? 'halted' : 'cancelled');
    await Service.stopAllShared(row.tenant_id);      // every shared container offline
    await setTenantPlan(row.tenant_id, 'max').catch(() => {}); // close the Pro gate

    if (transient) {
      // Pause each active container sub so it stops billing while the base is unpaid; a
      // base renewal will resume them (see the 'charged' branch above).
      const active = await ProSub.containersByStatus(row.tenant_id, 'active');
      for (const c of active) { await rzPause(c.razorpay_sub_id); await ProSub.setStatus(c.id, 'paused'); }
      // Suspend the tenant's workloads ON THE SITE too — flipping services.status alone stops
      // nothing (the reconciler re-asserts desired state), and a halted tenant also drops out
      // of the drift sweep, so its containers used to keep serving traffic unbilled for as
      // long as the card kept failing (re-audit 6 Sep, N6). WORKLOADS_STOPPED keeps all data
      // and is reversed by tenant.resume when the retried charge lands (see 'charged' above).
      await siteTeardown.enqueueTenantStop(row.tenant_id, 'payment_halted');
    } else {
      // Permanent — cancel every remaining container subscription outright, and STOP the tenant's
      // workloads on the site. Without this the reconciler keeps every container running for free.
      await cancelAllForTenant(row.tenant_id);
      await siteTeardown.enqueueTenantStop(row.tenant_id, 'subscription_cancelled');
    }
    return { handled: true, action: 'terminal', kind: 'base', transient };
  }

  // Container subscription — just its own feature.
  await ProSub.setStatus(row.id, transient ? 'halted' : 'cancelled');
  if (row.service_id) await Service.setStatus(row.service_id, 'stopped');
  // Permanent cancel → tear the workload down on the site too (status alone won't stop it).
  if (!transient && row.service_id) await siteTeardown.enqueueServiceTeardown(row.tenant_id, row.service_id, 'subscription cancelled');
  return { handled: true, action: 'terminal', kind: 'container', transient };
}

module.exports = {
  containerAmountCents, webhookAction,   // pure
  ProSub, beginProBase, beginOnline, activate, commitResize, cancelForService, cancelAllForTenant, handleWebhook,
  invoiceChargedCycle, upgradeBase, promoteOldestIntoFreeSlot, isFeePayingContainer, // exported for tests
};
