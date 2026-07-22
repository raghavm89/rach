#!/usr/bin/env node
'use strict';

/**
 * Configure GST collection.
 *
 * Until a row exists in `tax_registrations`, the tax engine charges **zero** on
 * every sale. That is the deliberate default — charging tax you are not
 * registered to collect is worse than charging none — but it means this script
 * must be run before the first Indian sale, or you under-collect 18% and owe it
 * out of your own pocket.
 *
 * What it configures, per Rach Dev LLP's position:
 *
 *   Buyer in your own state    → CGST 9% + SGST 9%
 *   Buyer in another IN state  → IGST 18%
 *   Buyer outside India        → zero-rated export under LUT
 *
 * The intra/inter split is decided by comparing the buyer's state to yours, so
 * a wrong seller state silently mis-files every invoice. This script refuses to
 * proceed if SELLER_GSTIN and SELLER_STATE_CODE disagree.
 *
 * Usage:
 *   node scripts/setup-tax-registration.js            # dry run
 *   node scripts/setup-tax-registration.js --commit
 */

require('dotenv').config();

const { pool } = require('@rach/core');
const { indiaGst } = require('@rach/billing').tax;

const COMMIT = process.argv.includes('--commit');
const RATE_BPS = 1800; // 18%

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

async function main() {
  console.log('\n═══ GST registration setup ═══\n');

  const gstin = (process.env.SELLER_GSTIN || '').trim().toUpperCase();
  const stateCode = (process.env.SELLER_STATE_CODE || '').trim().toUpperCase();
  const legalName = process.env.SELLER_LEGAL_NAME;

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!gstin) {
    fail('SELLER_GSTIN is not set in .env — cannot register GST collection without it.');
  }
  if (!indiaGst.isValidGstinFormat(gstin)) {
    fail(`SELLER_GSTIN "${gstin}" is not a valid GSTIN.\n` +
         '  Expected 15 characters: 2 state digits, 10-char PAN, entity digit, "Z", checksum.');
  }

  const gstinState = indiaGst.stateFromGstin(gstin);
  if (!gstinState) {
    fail(`SELLER_GSTIN "${gstin}" begins with "${gstin.slice(0, 2)}", which is not a recognised GST state code.`);
  }

  // The check that matters. A mismatch here does not error at runtime — it
  // quietly produces CGST+SGST where IGST is due, or the reverse, on every
  // Indian invoice.
  if (stateCode && stateCode !== gstinState) {
    fail(`Seller state mismatch.\n` +
         `  SELLER_GSTIN "${gstin}" is registered in ${gstinState}.\n` +
         `  SELLER_STATE_CODE says ${stateCode}.\n` +
         '  These decide CGST+SGST vs IGST — fix .env before continuing.');
  }

  console.log(`  Legal name  : ${legalName || '(SELLER_LEGAL_NAME unset — invoices will use the code default)'}`);
  console.log(`  GSTIN       : ${gstin}`);
  console.log(`  State       : ${gstinState}${stateCode ? '' : '  (SELLER_STATE_CODE unset — derived from GSTIN)'}`);
  console.log(`  Rate        : ${RATE_BPS / 100}%  ·  SAC ${indiaGst.SAC_CLOUD_HOSTING} (cloud hosting)`);
  console.log(`  LUT export  : ${process.env.GST_EXPORT_UNDER_LUT === 'false' ? 'NO — exports charged IGST' : 'yes — exports zero-rated'}`);

  console.log('\n  Resulting treatment:');
  console.log(`    buyer in ${gstinState}            → CGST 9% + SGST 9%`);
  console.log('    buyer in another IN state → IGST 18%');
  console.log(`    buyer outside India       → ${process.env.GST_EXPORT_UNDER_LUT === 'false' ? 'IGST 18% (refundable)' : 'zero-rated export'}`);

  // ── Existing ───────────────────────────────────────────────────────────────
  const { rows: existing } = await pool.query(
    `SELECT * FROM tax_registrations WHERE country_code = 'IN' AND is_active`
  );

  if (existing.length) {
    const r = existing[0];
    console.log(`\n  Already registered: ${r.registration_number} @ ${r.rate_bps / 100}% (since ${String(r.effective_from).slice(0, 10)})`);
    if (r.registration_number === gstin && r.rate_bps === RATE_BPS) {
      console.log('  Matches .env — nothing to do.\n');
      return;
    }
    console.log('  Differs from .env. Deactivate the old row before adding a new one:');
    console.log(`    UPDATE tax_registrations SET is_active = FALSE, effective_to = CURRENT_DATE WHERE id = ${r.id};\n`);
    return;
  }

  if (!COMMIT) {
    console.log('\n  DRY RUN — no row written. Re-run with --commit to enable GST collection.');
    console.log('  Until then every sale is taxed at 0% and recorded as "no_registration".\n');
    return;
  }

  const { rows } = await pool.query(
    `INSERT INTO tax_registrations
       (country_code, region_code, registration_number, provider, rate_bps, tax_name)
     VALUES ('IN', NULL, $1, 'manual', $2, 'GST')
     RETURNING *`,
    [gstin, RATE_BPS]
  );

  console.log(`\n  ✓ Registered. tax_registrations #${rows[0].id}`);
  console.log('  GST is now charged on Indian sales. Exports remain zero-rated.\n');
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('\nFAILED:', err.message);
    pool.end().finally(() => process.exit(1));
  });
