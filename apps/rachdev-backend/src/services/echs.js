'use strict';

/**
 * ECHS (Ex-Servicemen Contributory Health Scheme) payer seam.
 *
 * When ECHS_BASE_URL / ECHS_TOKEN are set, implement `verifyEligibility` and
 * `preAuth` against the real ECHS endpoints. Until then the seam runs in STUB
 * mode: it derives a realistic, deterministic result from the AFMS fields we
 * already capture on the patient (ECHS number, category, validity), so intake and
 * billing demos work end-to-end. Every response is tagged with its `source`
 * ('stub' vs 'echs') so the audit trail never misrepresents a stub as live.
 */

const BASE_URL = (process.env.ECHS_BASE_URL || '').replace(/\/$/, '');
const TOKEN = process.env.ECHS_TOKEN || '';

function enabled() {
  return Boolean(BASE_URL && TOKEN);
}

function addYears(date, n) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Verify a patient's ECHS eligibility.
 * @param {object} patient  a patient row (uses military.echs_number/category/validity)
 * @returns {{eligible, valid_from, valid_to, category, cashless, status, remarks, source, raw}}
 */
async function verifyEligibility(patient /* , opts */) {
  if (enabled()) {
    // TODO: call the real ECHS eligibility API and normalize to the shape below.
    throw new Error('ECHS live integration is configured but not implemented in this adapter.');
  }
  const mil = (patient && patient.military) || {};
  const echsNo = mil.echs_number || mil.service_number || null;
  const today = new Date().toISOString().slice(0, 10);

  if (!echsNo) {
    return {
      eligible: false, valid_from: null, valid_to: null, category: mil.category || null,
      cashless: false, status: 'ineligible', remarks: 'No ECHS/service number on record — capture it to verify.',
      source: 'stub', raw: { checked_at: today },
    };
  }
  const validFrom = mil.validity_from || today;
  const validTo = mil.validity_to || addYears(today, 1);
  const expired = new Date(validTo) < new Date(today);
  return {
    eligible: !expired,
    valid_from: validFrom,
    valid_to: validTo,
    category: mil.category || 'ECHS Beneficiary',
    cashless: !expired,
    status: expired ? 'ineligible' : 'verified',
    remarks: expired ? `ECHS card expired ${validTo}.` : 'Eligible — cashless available (demo verification).',
    source: 'stub',
    raw: { echs_number: echsNo, checked_at: today },
  };
}

/**
 * Raise a cashless pre-authorisation for a claim.
 * @returns {{reference_id, status, amount, remarks, source, raw}}
 */
async function preAuth({ amount, denial_risk }) {
  if (enabled()) {
    throw new Error('ECHS live integration is configured but not implemented in this adapter.');
  }
  const amt = Number(amount) || 0;
  // Deterministic demo rule: small, low-risk claims auto-approve; else pending review.
  const approved = amt > 0 && amt <= 50000 && denial_risk !== 'high';
  const ref = 'ECHS-PA-' + Date.now().toString(36).toUpperCase();
  return {
    reference_id: ref,
    status: approved ? 'approved' : 'pending',
    amount: amt,
    remarks: approved ? 'Cashless pre-authorisation approved (demo).' : 'Referred for manual pre-auth review (amount/risk threshold).',
    source: 'stub',
    raw: { requested: amt, denial_risk: denial_risk || 'low' },
  };
}

module.exports = { enabled, verifyEligibility, preAuth };
