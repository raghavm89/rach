'use strict';

/**
 * India GST provider.
 *
 * Rules implemented (SaaS / cloud infrastructure, SAC 998315):
 *
 *   Place of supply is the buyer's state (§12(2) IGST Act for registered
 *   recipients; recorded address otherwise).
 *
 *   Seller state == buyer state  → CGST 9% + SGST 9%   (intra-state)
 *   Seller state != buyer state  → IGST 18%            (inter-state)
 *   Buyer outside India          → zero-rated export   (§16 IGST Act)
 *
 * Export zero-rating assumes supply under a Letter of Undertaking. If you do
 * NOT hold a valid LUT you must instead charge IGST and claim a refund — set
 * GST_EXPORT_UNDER_LUT=false and this provider will apply IGST to exports.
 *
 * This is a rate engine, not tax advice. Confirm treatment with your CA before
 * relying on it — particularly the LUT position and your SAC classification.
 */

const { applyRateBps, splitTax } = require('../money');

// GST state codes — first two digits of a GSTIN.
const GSTIN_STATE_CODES = {
  '01': 'JK', '02': 'HP', '03': 'PB', '04': 'CH', '05': 'UT', '06': 'HR',
  '07': 'DL', '08': 'RJ', '09': 'UP', '10': 'BR', '11': 'SK', '12': 'AR',
  '13': 'NL', '14': 'MN', '15': 'MZ', '16': 'TR', '17': 'ML', '18': 'AS',
  '19': 'WB', '20': 'JH', '21': 'OR', '22': 'CT', '23': 'MP', '24': 'GJ',
  '26': 'DH', '27': 'MH', '29': 'KA', '30': 'GA', '31': 'LD', '32': 'KL',
  '33': 'TN', '34': 'PY', '35': 'AN', '36': 'TG', '37': 'AP', '38': 'LA',
};

const SAC_CLOUD_HOSTING = '998315';

/** Extract the state code from a GSTIN, or null if malformed. */
function stateFromGstin(gstin) {
  if (!gstin || typeof gstin !== 'string') return null;
  const code = gstin.trim().slice(0, 2);
  return GSTIN_STATE_CODES[code] ?? null;
}

/** Basic GSTIN structural check. Does not prove the number is live at GSTN. */
function isValidGstinFormat(gstin) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
    String(gstin || '').trim().toUpperCase()
  );
}

/**
 * @param {object} ctx
 * @param {Array}  ctx.lines            [{ description, quantity, unit_price_minor, subtotal_minor }]
 * @param {string} ctx.currency
 * @param {object} ctx.buyer            { country_code, region_code, gstin }
 * @param {object} ctx.registration     row from tax_registrations for 'IN'
 * @param {object} ctx.seller           { gstin, region_code }
 */
function calculate({ lines, buyer, registration, seller }) {
  const rateBps = registration.rate_bps ?? 1800;

  const buyerCountry = String(buyer.country_code || '').toUpperCase();
  const exportUnderLut = process.env.GST_EXPORT_UNDER_LUT !== 'false';

  // ── Export of services ─────────────────────────────────────────────────────
  if (buyerCountry && buyerCountry !== 'IN') {
    if (exportUnderLut) {
      return {
        treatment: 'export_zero_rated',
        place_of_supply: `${buyerCountry} (export of services)`,
        tax_total_minor: 0,
        lines: lines.map((l) => ({
          ...l,
          sac_code: SAC_CLOUD_HOSTING,
          tax_rate_bps: 0,
          tax_amount_minor: 0,
          tax_breakdown: [],
          total_minor: l.subtotal_minor,
        })),
        notes: 'Export of services — zero-rated supply under LUT, §16 IGST Act. No GST charged.',
      };
    }
    // No LUT held: export is taxable at the IGST rate, refundable later.
    return taxed({
      lines,
      rateBps,
      components: [{ name: 'IGST', rate_bps: rateBps }],
      treatment: 'export_taxable',
      placeOfSupply: `${buyerCountry} (export, IGST paid)`,
      notes: 'Export of services taxed under IGST (no LUT on file). Refund claimable.',
    });
  }

  // ── Domestic ───────────────────────────────────────────────────────────────
  // Prefer the state implied by the buyer's GSTIN — it is the authoritative
  // place of supply for a registered recipient — and fall back to the address.
  const buyerState =
    stateFromGstin(buyer.gstin) ||
    (buyer.region_code ? String(buyer.region_code).toUpperCase() : null);

  const sellerState =
    stateFromGstin(seller.gstin) ||
    (seller.region_code ? String(seller.region_code).toUpperCase() : null);

  // Unknown buyer state: treat as inter-state. IGST is the safer default —
  // it cannot under-collect, and it is correctable on a revised invoice.
  const intraState = Boolean(buyerState && sellerState && buyerState === sellerState);

  const components = intraState
    ? [
        { name: 'CGST', rate_bps: Math.floor(rateBps / 2) },
        { name: 'SGST', rate_bps: Math.ceil(rateBps / 2) },
      ]
    : [{ name: 'IGST', rate_bps: rateBps }];

  return taxed({
    lines,
    rateBps,
    components,
    treatment: intraState ? 'intra_state' : 'inter_state',
    placeOfSupply: buyerState ? `${buyerState}, India` : 'India (state not provided)',
    notes: buyerState
      ? null
      : 'Buyer state could not be determined; IGST applied. Collect a state or GSTIN to refine.',
  });
}

function taxed({ lines, rateBps, components, treatment, placeOfSupply, notes }) {
  let taxTotal = 0;

  const outLines = lines.map((l) => {
    const lineTax = applyRateBps(l.subtotal_minor, rateBps);
    taxTotal += lineTax;
    return {
      ...l,
      sac_code: SAC_CLOUD_HOSTING,
      tax_rate_bps: rateBps,
      tax_amount_minor: lineTax,
      // Split per line so the components always reconcile to the line total.
      tax_breakdown: splitTax(lineTax, components),
      total_minor: l.subtotal_minor + lineTax,
    };
  });

  return {
    treatment,
    place_of_supply: placeOfSupply,
    tax_total_minor: taxTotal,
    lines: outLines,
    notes,
  };
}

module.exports = {
  id: 'india_gst',
  calculate,
  stateFromGstin,
  isValidGstinFormat,
  GSTIN_STATE_CODES,
  SAC_CLOUD_HOSTING,
};
