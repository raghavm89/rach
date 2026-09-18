'use strict';

/**
 * Backfill `subscriptions.billing_json` for subscriptions that were activated
 * before the billing-snapshot fix, so their recurring invoices become proper GST
 * tax invoices (IGST/CGST/SGST broken out, place of supply resolved) instead of
 * the tax-inclusive single line.
 *
 * Jurisdiction is taken from the customer's saved billing profile
 * (`users.billing_address` + `users.gstin`). Where that's empty, pass overrides.
 *
 * Usage:
 *   node scripts/backfill-subscription-billing.js                # all active subs missing a snapshot
 *   node scripts/backfill-subscription-billing.js --dry          # show what it would do, change nothing
 *   node scripts/backfill-subscription-billing.js --sub sub_ABC  # one subscription
 *   node scripts/backfill-subscription-billing.js --sub sub_ABC --country IN --state HR --gstin 06ABCDE1234F1Z5
 *
 * The pre-tax subtotal is derived from the plan's (tax-inclusive) amount using
 * the buyer's applicable GST rate, so subtotal + tax reconciles to the charge.
 */

const { pool } = require('@rach/core');
const { Subscription, tax } = require('@rach/billing');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
}
const DRY = process.argv.includes('--dry');
const ONE_SUB = arg('sub');
const OV = { country: arg('country'), state: arg('state'), gstin: arg('gstin') };

async function main() {
  const { rows: subs } = await pool.query(
    `SELECT s.razorpay_sub_id, s.status, s.user_id,
            p.name AS plan_name, p.amount AS plan_amount, p.currency AS plan_currency,
            u.name AS user_name, u.email AS user_email, u.gstin AS user_gstin,
            u.billing_address
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       JOIN users u ON u.id = s.user_id
      WHERE s.billing_json IS NULL
        AND s.status IN ('active','authenticated','pending')
        ${ONE_SUB ? 'AND s.razorpay_sub_id = $1' : ''}
      ORDER BY s.created_at DESC`,
    ONE_SUB ? [ONE_SUB] : []
  );

  console.log(`Found ${subs.length} subscription(s) missing a billing snapshot.\n`);
  let done = 0, skipped = 0;

  for (const s of subs) {
    const addr = parseJson(s.billing_address) || {};
    const country = (OV.country || addr.country || addr.country_code || 'IN').toUpperCase();
    const state   = OV.state || addr.state || addr.region_code || null;
    const gstin   = OV.gstin || s.user_gstin || addr.gstin || null;

    if (!state && !gstin && country === 'IN') {
      console.warn(`  SKIP ${s.razorpay_sub_id}: no state/GSTIN on file — pass --sub ${s.razorpay_sub_id} --state <XX> [--gstin ...]`);
      skipped++;
      continue;
    }

    const amount = Number(s.plan_amount);
    const currency = s.plan_currency;
    const buyer = { name: s.user_name, email: s.user_email, country_code: country, region_code: state, gstin };

    // Applicable rate for this buyer → back out the pre-tax subtotal.
    const probe = await tax.calculateTax({
      lines: [{ description: 'probe', quantity: 1, unit_price_minor: amount, subtotal_minor: amount }],
      currency, buyer,
    });
    const rateBps = probe.lines[0]?.tax_rate_bps || 0;
    const subtotal = rateBps > 0 ? Math.round((amount * 10000) / (10000 + rateBps)) : amount;

    const billingJson = {
      currency,
      lines: [{ description: s.plan_name || 'Monthly subscription billing cycle', quantity: 1, unit_price_minor: subtotal }],
      billing: { name: s.user_name, email: s.user_email, country, state, gstin },
    };

    const tax_est = amount - subtotal;
    console.log(`  ${DRY ? 'WOULD SET' : 'SET'} ${s.razorpay_sub_id}: subtotal ${subtotal} + tax ~${tax_est} = ${amount} ${currency}  [${probe.treatment}, place ${probe.place_of_supply}]`);

    if (!DRY) {
      await Subscription.saveBilling(s.razorpay_sub_id, billingJson);
    }
    done++;
  }

  console.log(`\n${DRY ? '(dry run) ' : ''}Backfilled ${done}, skipped ${skipped}.`);
  await pool.end();
}

function parseJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}

main().catch((e) => { console.error('backfill failed:', e); process.exit(1); });
