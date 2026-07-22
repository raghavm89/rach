'use strict';

/**
 * Tax engine.
 *
 * One entry point — `calculateTax(ctx)` — which resolves the jurisdiction from
 * the buyer's address, looks up whether we are registered to collect there, and
 * dispatches to the appropriate provider.
 *
 * Core principle: **we only charge tax where a `tax_registrations` row says we
 * are registered.** With no rows, every sale is untaxed and each invoice records
 * `no_registration` as the treatment, so the decision is auditable after the
 * fact rather than being an invisible default.
 *
 * Adding a jurisdiction is a data change, not a code change.
 *
 * This engine is a rate calculator, not tax advice. Rules — especially US
 * economic nexus thresholds — change, and crossing one is silent.
 */

const { pool } = require('@rach/core');
const { assertInt } = require('./money');
const indiaGst = require('./providers/indiaGst');
const usSalesTax = require('./providers/usSalesTax');
const { stripeTax, taxJar } = require('./providers/external');

const SELLER = () => ({
  legal_name  : process.env.SELLER_LEGAL_NAME  || 'Rach Dev LLP',
  gstin       : process.env.SELLER_GSTIN       || null,
  pan         : process.env.SELLER_PAN         || null,
  region_code : process.env.SELLER_STATE_CODE  || null,
  country_code: process.env.SELLER_COUNTRY     || 'IN',
  address     : process.env.SELLER_ADDRESS     || null,
  email       : process.env.SELLER_EMAIL       || process.env.BREVO_FROM_EMAIL || null,
});

/** Country-level providers. */
const COUNTRY_PROVIDERS = {
  IN: indiaGst,
  US: usSalesTax,
};

/**
 * Find the active registration covering a jurisdiction.
 * A state-specific row wins over a country-wide one.
 */
async function findRegistration(countryCode, regionCode) {
  if (!countryCode) return null;

  const { rows } = await pool.query(
    `SELECT * FROM tax_registrations
      WHERE is_active
        AND country_code = $1
        AND (region_code = $2 OR region_code IS NULL)
        AND effective_from <= CURRENT_DATE
        AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
      ORDER BY region_code NULLS LAST
      LIMIT 1`,
    [String(countryCode).toUpperCase(), regionCode ? String(regionCode).toUpperCase() : null]
  );
  return rows[0] ?? null;
}

/**
 * Calculate tax for a set of lines.
 *
 * @param {object}  ctx
 * @param {Array}   ctx.lines     [{ description, quantity, unit_price_minor, subtotal_minor }]
 * @param {string}  ctx.currency  ISO-4217
 * @param {object}  ctx.buyer     { country_code, region_code, postal_code, city, gstin }
 * @returns {Promise<{
 *   provider: string, treatment: string, place_of_supply: string,
 *   subtotal_minor: number, tax_total_minor: number, total_minor: number,
 *   lines: Array, notes: string|null, seller: object
 * }>}
 */
async function calculateTax({ lines, currency = 'USD', buyer = {} }) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new TypeError('calculateTax requires a non-empty lines array');
  }
  lines.forEach((l, i) => assertInt(l.subtotal_minor, `lines[${i}].subtotal_minor`));

  const subtotalMinor = lines.reduce((s, l) => s + l.subtotal_minor, 0);
  const seller = SELLER();
  const country = String(buyer.country_code || '').toUpperCase();
  const sellerCountry = String(seller.country_code || 'IN').toUpperCase();

  // Dispatch is NOT simply "the buyer's country".
  //
  // Two different jurisdictions can have a claim on one sale:
  //   * the buyer's, if we are registered to collect there;
  //   * the seller's, whose export rules apply to every outbound sale.
  //
  // For an Indian seller shipping to the US, the correct treatment is a
  // zero-rated export under §16 IGST — the amount is zero either way, but the
  // invoice must carry the LUT declaration. Dispatching on the buyer alone
  // would silently label it "no registration" and omit that declaration.
  const registration = await findRegistration(country, buyer.region_code);
  const isCrossBorder = Boolean(country) && country !== sellerCountry;

  // Cross-border sale, and we are NOT registered in the destination →
  // the seller's own export rules govern.
  if (isCrossBorder && !registration) {
    const sellerProvider = COUNTRY_PROVIDERS[sellerCountry];
    const sellerRegistration = await findRegistration(sellerCountry, seller.region_code);

    // Warn if the destination is a state that would tax this, so a growing US
    // book doesn't quietly accrue an unregistered liability.
    if (country === 'US' && usSalesTax.SAAS_TAXABLE_STATES.has(String(buyer.region_code || '').toUpperCase())) {
      console.warn(
        `[tax] Export to ${buyer.region_code}, US — a state that generally taxes SaaS — with no US registration. ` +
        'No US tax collected. Track your US sales by state against economic-nexus thresholds.'
      );
    }

    if (sellerProvider && sellerRegistration) {
      const result = sellerProvider.calculate({
        lines, currency, buyer, registration: sellerRegistration, seller,
      });
      return finalize({ result, subtotalMinor, seller, provider: sellerProvider.id });
    }

    // Not registered anywhere relevant: charge nothing, and say why.
    return finalize({
      provider: 'none',
      subtotalMinor,
      seller,
      result: zeroResult(lines, `${country} (export)`, 'no_registration',
        `No tax registration in ${sellerCountry} or ${country} — no tax charged.`),
    });
  }

  // ── Delegated providers ────────────────────────────────────────────────────
  // Try the external engine first when configured; fall back to built-in on any
  // failure so a provider outage cannot block checkout.
  if (registration && registration.provider !== 'manual') {
    const adapter = registration.provider === 'stripe_tax' ? stripeTax
                  : registration.provider === 'taxjar'     ? taxJar
                  : null;

    if (adapter) {
      const result = await adapter({ lines, currency, buyer });
      if (result && Array.isArray(result.lines)) {
        return finalize({ result, subtotalMinor, seller, provider: registration.provider });
      }
      console.warn(`[tax] ${registration.provider} unavailable — falling back to built-in provider`);
    }
  }

  // ── Built-in providers ─────────────────────────────────────────────────────
  const provider = COUNTRY_PROVIDERS[country];

  if (!provider) {
    // Somewhere we have no provider and no registration: charge nothing, say so.
    return finalize({
      provider: 'none',
      subtotalMinor,
      seller,
      result: zeroResult(
        lines,
        country || 'unknown',
        'no_registration',
        country
          ? `No tax registration or provider configured for ${country} — no tax charged.`
          : 'Buyer country unknown — no tax charged.'
      ),
    });
  }

  // India needs a registration to charge GST at all; the US provider handles a
  // missing registration itself (and warns on likely-taxable states).
  if (country === 'IN' && !registration) {
    console.warn(
      '[tax] Sale to India with no IN row in tax_registrations — no GST charged. ' +
      'If you are GST-registered, insert your registration (see migration 028).'
    );
    return finalize({
      provider: 'none',
      subtotalMinor,
      seller,
      result: zeroResult(lines, 'India', 'no_registration',
        'No GST registration configured — no tax charged.', indiaGst.SAC_CLOUD_HOSTING),
    });
  }

  const result = provider.calculate({ lines, currency, buyer, registration, seller });
  return finalize({ result, subtotalMinor, seller, provider: provider.id });
}

/** A zero-tax result that still records why nothing was charged. */
function zeroResult(lines, placeOfSupply, treatment, notes, sacCode = null) {
  return {
    treatment,
    place_of_supply: placeOfSupply,
    tax_total_minor: 0,
    lines: lines.map((l) => ({
      ...l,
      sac_code: sacCode,
      tax_rate_bps: 0,
      tax_amount_minor: 0,
      tax_breakdown: [],
      total_minor: l.subtotal_minor,
    })),
    notes,
  };
}

function finalize({ result, subtotalMinor, seller, provider }) {
  const taxTotal = result.tax_total_minor ?? 0;

  // Reconciliation guard: line tax must sum to the header tax, or the invoice
  // will not add up and we would rather fail than issue a wrong document.
  const lineSum = result.lines.reduce((s, l) => s + (l.tax_amount_minor ?? 0), 0);
  if (lineSum !== taxTotal) {
    throw new Error(
      `Tax reconciliation failed: line tax ${lineSum} != header tax ${taxTotal} (provider=${provider})`
    );
  }

  return {
    provider,
    treatment: result.treatment,
    place_of_supply: result.place_of_supply,
    subtotal_minor: subtotalMinor,
    tax_total_minor: taxTotal,
    total_minor: subtotalMinor + taxTotal,
    lines: result.lines,
    notes: result.notes ?? null,
    seller,
  };
}

/** Whether we hold any active registration at all — used for startup warnings. */
async function hasAnyRegistration() {
  const { rows } = await pool.query('SELECT 1 FROM tax_registrations WHERE is_active LIMIT 1');
  return rows.length > 0;
}

module.exports = {
  calculateTax,
  findRegistration,
  hasAnyRegistration,
  SELLER,
  indiaGst,
  usSalesTax,
};
