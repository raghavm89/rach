'use strict';

/**
 * Dhanvantri (AFMS HIS) integration seam.
 *
 * Not wired in the POC — Dhanvantri is a closed military HIS with no open API we
 * can build against yet. This is the single place a real client plugs in when
 * API access is available: implement the methods against the Dhanvantri
 * endpoints and set DHANVANTRI_BASE_URL / DHANVANTRI_TOKEN.
 *
 * Our patient/visit records carry `source_system` + `external_id`, so records
 * fetched from Dhanvantri upsert against local ones without duplication.
 */

const BASE_URL = (process.env.DHANVANTRI_BASE_URL || '').replace(/\/$/, '');
const TOKEN = process.env.DHANVANTRI_TOKEN || '';

function enabled() {
  return Boolean(BASE_URL && TOKEN);
}

async function notWired() {
  throw new Error('Dhanvantri integration is not configured (set DHANVANTRI_BASE_URL / DHANVANTRI_TOKEN and implement this adapter).');
}

// Search Dhanvantri for patients (by name / CR number / phone). → normalized rows.
async function searchPatients(/* query */) { if (!enabled()) return null; return notWired(); }
// Fetch one Dhanvantri patient by its external id. → normalized row.
async function getPatient(/* externalId */) { if (!enabled()) return null; return notWired(); }
// Push a locally-created visit/registration back to Dhanvantri (if two-way).
async function pushVisit(/* visit */) { if (!enabled()) return null; return notWired(); }

module.exports = { enabled, searchPatients, getPatient, pushVisit };
