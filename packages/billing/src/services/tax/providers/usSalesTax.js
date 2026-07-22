'use strict';

/**
 * US sales tax provider.
 *
 * US sales tax is NOT the mirror image of GST and must not be modelled as one:
 *
 *   * There is no federal sales tax. It is levied by states, and by counties
 *     and cities beneath them — roughly 11,000 jurisdictions.
 *   * You only collect where you have NEXUS: physical presence, or "economic
 *     nexus" once you cross a state's threshold (commonly $100k in sales or
 *     200 transactions in a rolling 12 months, but the numbers and the clock
 *     differ per state).
 *   * Whether SaaS is even taxable varies by state. It is taxable in states
 *     like NY, TX, PA, WA and AZ; exempt in California, Florida, Georgia and
 *     others; and several tax it only for business buyers.
 *
 * Consequently this provider does NOT ship a rate table. It collects only where
 * an explicit `tax_registrations` row exists for the buyer's state, and for
 * anything beyond a flat manual rate it delegates to Stripe Tax or TaxJar,
 * which maintain rates, boundaries and taxability rules as a product.
 *
 * Current configured position: no US registrations, therefore no US tax is
 * charged, and each invoice records `no_registration` so the reason is
 * auditable later.
 *
 * Not tax advice. Economic nexus is a threshold you can cross silently — track
 * your US sales by state and talk to an accountant before you approach $100k.
 */

const { applyRateBps } = require('../money');

/**
 * States that generally tax SaaS. Advisory only — used to warn when you appear
 * to have an obligation you have not configured. Never used to charge.
 */
const SAAS_TAXABLE_STATES = new Set([
  'AZ', 'CT', 'DC', 'HI', 'IA', 'IN', 'KY', 'MA', 'MD', 'MS',
  'NM', 'NY', 'OH', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'WA', 'WV', 'WY',
]);

function calculate({ lines, buyer, registration }) {
  const state = String(buyer.region_code || '').toUpperCase();

  // No registration for this state → no collection obligation we have accepted.
  if (!registration) {
    if (SAAS_TAXABLE_STATES.has(state)) {
      // Loud, because this is where silent liability accrues.
      console.warn(
        `[tax] Sale to ${state}, a state that generally taxes SaaS, with no tax_registrations row. ` +
        `No tax collected. If you have crossed economic nexus in ${state}, you owe this out of pocket.`
      );
    }
    return zero(lines, state, 'no_registration',
      'No US tax registration configured for this jurisdiction — no tax collected.');
  }

  if (registration.provider !== 'manual') {
    // Delegated engines are resolved before this point; reaching here means
    // the adapter was unavailable and we must not guess a rate.
    return zero(lines, state, 'provider_unavailable',
      `Tax provider "${registration.provider}" did not return a result — no tax charged.`);
  }

  const rateBps = registration.rate_bps ?? 0;
  if (rateBps === 0) {
    return zero(lines, state, 'exempt', 'Registered jurisdiction with a zero rate.');
  }

  const taxName = registration.tax_name || 'Sales Tax';
  let taxTotal = 0;

  const outLines = lines.map((l) => {
    const lineTax = applyRateBps(l.subtotal_minor, rateBps);
    taxTotal += lineTax;
    return {
      ...l,
      sac_code: null,
      tax_rate_bps: rateBps,
      tax_amount_minor: lineTax,
      tax_breakdown: [{ name: `${state} ${taxName}`, rate_bps: rateBps, amount_minor: lineTax }],
      total_minor: l.subtotal_minor + lineTax,
    };
  });

  return {
    treatment: 'us_state_tax',
    place_of_supply: `${state}, United States`,
    tax_total_minor: taxTotal,
    lines: outLines,
    notes: null,
  };
}

function zero(lines, state, treatment, notes) {
  return {
    treatment,
    place_of_supply: state ? `${state}, United States` : 'United States',
    tax_total_minor: 0,
    lines: lines.map((l) => ({
      ...l,
      sac_code: null,
      tax_rate_bps: 0,
      tax_amount_minor: 0,
      tax_breakdown: [],
      total_minor: l.subtotal_minor,
    })),
    notes,
  };
}

module.exports = { id: 'us_sales_tax', calculate, SAAS_TAXABLE_STATES };
