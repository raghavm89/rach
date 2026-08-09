'use strict';

/**
 * ABDM (Ayushman Bharat Digital Mission) seam — ABHA linkage.
 *
 * When ABDM_BASE_URL / ABDM_TOKEN are set, implement `linkAbha` against the real
 * ABHA APIs (link/verify + demographics). Until then the seam runs in STUB mode:
 * it derives a deterministic ABHA number + address so the "records follow the
 * soldier" story is demoable. Responses are tagged `source` ('stub' vs 'abdm').
 */

const BASE_URL = (process.env.ABDM_BASE_URL || '').replace(/\/$/, '');
const TOKEN = process.env.ABDM_TOKEN || '';

function enabled() {
  return Boolean(BASE_URL && TOKEN);
}

// Deterministic 14-digit ABHA number from a seed (stub only).
function stubAbhaNumber(seed) {
  let h = 0;
  const s = String(seed || 'abha');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const digits = (h.toString().padStart(14, '0') + '00000000000000').slice(0, 14);
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`;
}

/**
 * Link (or verify) a patient's ABHA.
 * @param {object} patient  a patient row
 * @param {object} [opts]   { abha_address, abha_number } if the patient supplies one
 * @returns {{abha_number, abha_address, verified, status, source, raw}}
 */
async function linkAbha(patient, opts = {}) {
  if (enabled()) {
    throw new Error('ABDM live integration is configured but not implemented in this adapter.');
  }
  const suppliedAddr = (opts.abha_address || '').trim();
  const seed = patient?.uhid || patient?.id || patient?.name || 'abha';
  const abha_number = (opts.abha_number || '').trim() || stubAbhaNumber(seed);
  const abha_address = suppliedAddr || `${String(patient?.uhid || 'user').toLowerCase()}@sbx`;
  return {
    abha_number,
    abha_address,
    verified: true,
    status: 'linked',
    source: 'stub',
    raw: { linked_at: new Date().toISOString().slice(0, 10), demo: true },
  };
}

module.exports = { enabled, linkAbha, stubAbhaNumber };
