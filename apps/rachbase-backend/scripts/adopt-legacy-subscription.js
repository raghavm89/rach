#!/usr/bin/env node
'use strict';

/**
 * Adopt pre-consolidation subscriptions into the billing core.
 *
 * Background
 * ----------
 * Before migration 029, `/api/expansion` wrote subscriptions only into
 * `vm_expansion_requests`. The Razorpay webhook resolves subscriptions through
 * the `subscriptions` table, so those rows were invisible to it: renewals
 * recorded nothing, and the status never changed after activation.
 *
 * This script adopts such a row — creating the `plans` and `subscriptions` rows
 * that should have existed — so that future webhook events reach it.
 *
 * Principles
 * ----------
 *  * **Razorpay is the source of truth.** Period, paid_count and status are read
 *    from the live subscription, never inferred from our own rows.
 *  * **Dry run by default.** Nothing is written without --commit.
 *  * **Historical charges are reported, not invented.** Backfilling orders and
 *    payments is opt-in, and issuing tax invoices for past periods is a separate
 *    opt-in with its own warning — see NOTE ON BACKDATED INVOICES below.
 *
 * Usage
 * -----
 *   node scripts/adopt-legacy-subscription.js                  # dry run, all candidates
 *   node scripts/adopt-legacy-subscription.js --id 42          # one fulfilment row
 *   node scripts/adopt-legacy-subscription.js --commit         # adopt (plans + subscriptions + link)
 *   node scripts/adopt-legacy-subscription.js --commit --with-history
 *                                                             # + orders/payments for past charges
 *   node scripts/adopt-legacy-subscription.js --commit --with-history --with-invoices
 *                                                             # + tax invoices (READ THE NOTE)
 *
 * NOTE ON BACKDATED INVOICES
 * --------------------------
 * Invoice numbers are allocated sequentially at issue time. Issuing an invoice
 * today for a June supply gives it today's number and today's issue date — the
 * series stays intact, but the document is late. Under Indian GST a tax invoice
 * for a service is due within 30 days of supply, so a materially backdated
 * invoice is a question for your accountant, not a script default.
 *
 * If your customer already holds Razorpay's own payment receipts for those
 * cycles, you may not want a second set of documents at all. Hence --with-invoices
 * is off unless you ask for it.
 */

require('dotenv').config();

const { pool } = require('@rach/core');
const razorpay = require('@rach/billing').razorpay;
const Plan = require('@rach/billing').Plan;
const Order = require('@rach/billing').Order;
const Payment = require('@rach/billing').Payment;
const Subscription = require('@rach/billing').Subscription;
const issueInvoiceForPayment = require('@rach/billing').issueInvoiceForPayment;

// ── args ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : null;
};

const COMMIT        = has('--commit');
const WITH_HISTORY  = has('--with-history');
const WITH_INVOICES = has('--with-invoices');
const ONLY_ID       = val('--id') ? parseInt(val('--id'), 10) : null;

const money = (minor, cur) => `${cur} ${(Number(minor) / 100).toFixed(2)}`;
const ts    = (unix) => (unix ? new Date(unix * 1000).toISOString().slice(0, 10) : '—');

function banner(t) {
  console.log(`\n${'═'.repeat(72)}\n ${t}\n${'═'.repeat(72)}`);
}

// ── candidates ────────────────────────────────────────────────────────────────

async function findCandidates() {
  const params = [];
  let where = `
    razorpay_subscription_id IS NOT NULL
    AND subscription_id IS NULL`;

  if (ONLY_ID) {
    params.push(ONLY_ID);
    where += ` AND id = $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT r.*, u.name AS user_name, u.email
       FROM vm_expansion_requests r
       LEFT JOIN users u ON u.id = r.requested_by
      WHERE ${where}
      ORDER BY r.requested_at`,
    params
  );
  return rows;
}

// ── reconcile one row against Razorpay ────────────────────────────────────────

async function reconcile(row) {
  const subId = row.razorpay_subscription_id;

  let rzSub;
  try {
    rzSub = await razorpay.subscriptions.fetch(subId);
  } catch (err) {
    return { row, error: `Razorpay could not fetch ${subId}: ${err?.error?.description || err.message}` };
  }

  let rzPlan = null;
  if (rzSub.plan_id) {
    try {
      rzPlan = await razorpay.plans.fetch(rzSub.plan_id);
    } catch (err) {
      console.warn(`  ! could not fetch plan ${rzSub.plan_id}: ${err.message}`);
    }
  }

  // Every payment Razorpay has taken for this subscription. This is the list
  // Rachbase should have recorded and did not.
  let invoices = [];
  try {
    const res = await razorpay.invoices.all({ subscription_id: subId, count: 100 });
    invoices = res.items || [];
  } catch (err) {
    console.warn(`  ! could not list Razorpay invoices: ${err.message}`);
  }

  const paidInvoices = invoices.filter((i) => i.status === 'paid');

  return { row, rzSub, rzPlan, invoices, paidInvoices };
}

function report(r) {
  const { row, rzSub, rzPlan, paidInvoices } = r;

  console.log(`\n── fulfilment row #${row.id} ${'─'.repeat(45)}`);
  console.log(`  customer        : ${row.user_name || '?'} <${row.email || '?'}>  (tenant ${row.tenant_id})`);
  console.log(`  description     : ${row.custom_description || '—'}`);
  console.log(`  created         : ${new Date(row.requested_at).toISOString().slice(0, 10)}`);
  console.log(`  rachbase says   : status=${row.status} subscription_status=${row.subscription_status} ` +
              `amount=${money(row.amount_paid, row.currency || '?')} next_charge_at=${row.next_charge_at ?? 'NULL'}`);

  if (r.error) {
    console.log(`  RAZORPAY        : ${r.error}`);
    return;
  }

  console.log(`  razorpay says   : status=${rzSub.status} paid_count=${rzSub.paid_count} ` +
              `period=${ts(rzSub.current_start)}→${ts(rzSub.current_end)}`);
  if (rzPlan) {
    console.log(`  plan            : ${rzPlan.id} ${money(rzPlan.item?.amount, rzPlan.item?.currency)} / ` +
                `${rzPlan.period}`);
  }

  console.log(`  charges taken   : ${paidInvoices.length}`);
  for (const inv of paidInvoices) {
    console.log(`      ${ts(inv.paid_at)}  ${money(inv.amount_paid, inv.currency)}  ` +
                `order=${inv.order_id || '—'} payment=${inv.payment_id || '—'}`);
  }

  // The headline discrepancy.
  const recorded = 1; // activation only — renewals recorded nothing
  const missing = Math.max(0, paidInvoices.length - recorded);
  if (missing > 0) {
    console.log(`  ⚠  ${missing} charge(s) were taken by Razorpay and never recorded in Rachbase.`);
  }
  if (rzSub.status !== row.subscription_status) {
    console.log(`  ⚠  status drift: Rachbase "${row.subscription_status}" vs Razorpay "${rzSub.status}"`);
  }
}

// ── adopt ─────────────────────────────────────────────────────────────────────

async function adopt(r) {
  const { row, rzSub, rzPlan, paidInvoices } = r;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. plans row mirroring the live Razorpay plan
    const amount   = rzPlan?.item?.amount ?? row.amount_paid;
    const currency = (rzPlan?.item?.currency ?? row.currency ?? 'USD').toUpperCase();

    const { rows: planRows } = await client.query(
      `INSERT INTO plans (name, description, amount, currency, interval, interval_count, razorpay_plan_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        rzPlan?.item?.name || row.custom_description || 'Adopted plan',
        `Adopted from Razorpay plan ${rzSub.plan_id} by adopt-legacy-subscription`,
        amount, currency,
        rzPlan?.period || 'monthly',
        rzPlan?.interval || 1,
        rzSub.plan_id,
      ]
    );
    const plan = planRows[0];

    // 2. subscriptions row — period and paid_count come from Razorpay
    const { rows: subRows } = await client.query(
      `INSERT INTO subscriptions
         (user_id, plan_id, razorpay_sub_id, status, current_start, current_end, total_count, paid_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        row.requested_by, plan.id, rzSub.id, rzSub.status,
        rzSub.current_start ? new Date(rzSub.current_start * 1000) : null,
        rzSub.current_end   ? new Date(rzSub.current_end   * 1000) : null,
        rzSub.total_count ?? null,
        rzSub.paid_count ?? 0,
      ]
    );
    const subscription = subRows[0];

    // 3. link the fulfilment record, and correct its drifted status
    await client.query(
      `UPDATE vm_expansion_requests
          SET subscription_id     = $2,
              subscription_status = $3,
              next_charge_at      = $4,
              notes = COALESCE(notes || ' | ', '') ||
                      'Adopted into billing core on ' || NOW()::date
        WHERE id = $1`,
      [
        row.id, subscription.id, rzSub.status,
        rzSub.current_end ? new Date(rzSub.current_end * 1000) : null,
      ]
    );

    await client.query('COMMIT');
    console.log(`  ✓ adopted → plan #${plan.id}, subscription #${subscription.id}, linked to row #${row.id}`);

    return { plan, subscription };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── optional history backfill ─────────────────────────────────────────────────

async function backfillHistory({ row, subscription, paidInvoices }) {
  const created = [];

  for (const inv of paidInvoices) {
    const rzOrderId = inv.order_id;
    if (!rzOrderId) {
      console.log(`  · skipping a charge with no order_id (${ts(inv.paid_at)})`);
      continue;
    }

    let order = await Order.findByRazorpayId(rzOrderId);
    if (!order) {
      order = await Order.create({
        user_id: row.requested_by,
        subscription_id: subscription.id,
        razorpay_order_id: rzOrderId,
        amount: inv.amount_paid,
        currency: String(inv.currency).toUpperCase(),
        description: row.custom_description || 'Monthly subscription billing cycle',
      });
    }
    await Order.updateStatus(rzOrderId, 'paid');

    const existing = await Payment.findByOrderId(rzOrderId);
    if (!existing) {
      await Payment.create({
        user_id: row.requested_by,
        order_id: order.id,
        subscription_id: subscription.id,
        razorpay_order_id: rzOrderId,
        amount: inv.amount_paid,
        currency: String(inv.currency).toUpperCase(),
        description: row.custom_description || 'Monthly subscription billing cycle',
      });
    }
    if (inv.payment_id) await Payment.capture(rzOrderId, inv.payment_id, null);

    console.log(`  ✓ recorded charge ${ts(inv.paid_at)} ${money(inv.amount_paid, inv.currency)} (order ${rzOrderId})`);
    created.push({ order, invoice: inv });
  }

  return created;
}

async function backfillInvoices({ row, created }) {
  for (const { invoice: inv } of created) {
    const result = await issueInvoiceForPayment({
      userId: row.requested_by,
      currency: String(inv.currency).toUpperCase(),
      lines: [{
        description: row.custom_description || 'Monthly subscription billing cycle',
        quantity: 1,
        unit_price_minor: inv.amount_paid,
      }],
      payment: {
        razorpay_order_id: inv.order_id,
        razorpay_payment_id: inv.payment_id,
        razorpay_subscription_id: row.razorpay_subscription_id,
      },
      // Do not email a months-old invoice unannounced.
      sendEmail: false,
    });

    if (result.ok) {
      console.log(`  ✓ invoice ${result.invoice.invoice_number} for the ${ts(inv.paid_at)} charge` +
                  `${result.duplicate ? ' (already existed)' : ''} — NOT emailed`);
    } else {
      console.log(`  ! invoice failed for ${ts(inv.paid_at)}: ${result.error}`);
    }
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  banner(COMMIT ? 'ADOPT LEGACY SUBSCRIPTIONS  (COMMIT)' : 'ADOPT LEGACY SUBSCRIPTIONS  (dry run)');

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are required — Razorpay is the source of truth here.');
    process.exit(1);
  }

  const candidates = await findCandidates();

  if (!candidates.length) {
    console.log('\nNo unlinked subscriptions found. Nothing to adopt.\n');
    return;
  }

  console.log(`\nFound ${candidates.length} fulfilment row(s) with a Razorpay subscription and no billing link.`);

  const reconciled = [];
  for (const row of candidates) {
    const r = await reconcile(row);
    report(r);
    reconciled.push(r);
  }

  if (!COMMIT) {
    banner('DRY RUN — nothing written');
    console.log('Re-run with --commit to create the plans/subscriptions rows and link them.');
    console.log('Add --with-history to also record past charges as orders + payments.');
    console.log('Add --with-invoices to issue tax invoices for those charges (read the note in this file first).\n');
    return;
  }

  banner('WRITING');

  for (const r of reconciled) {
    if (r.error) {
      console.log(`\n  skipping row #${r.row.id}: ${r.error}`);
      continue;
    }

    const { subscription } = await adopt(r);

    if (WITH_HISTORY) {
      const created = await backfillHistory({
        row: r.row, subscription, paidInvoices: r.paidInvoices,
      });
      if (WITH_INVOICES && created.length) {
        await backfillInvoices({ row: r.row, created });
      }
    }
  }

  banner('DONE');
  console.log('These subscriptions now receive webhook updates: renewals will record');
  console.log('orders, payments and invoices, and status changes will propagate.\n');
  if (!WITH_HISTORY) {
    console.log('Past charges were NOT backfilled (no --with-history).\n');
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('\nFAILED:', err.message);
    console.error(err.stack);
    pool.end().finally(() => process.exit(1));
  });
