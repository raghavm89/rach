'use strict';

/**
 * Patient UHID generation — one scheme, one place.
 *
 * A UHID is `<PREFIX><zero-padded row id>` (e.g. UH000009). The PREFIX is a
 * per-tenant setting (tenant_settings key `uhid_prefix`, default 'UH') so a
 * hospital can brand its IDs — e.g. a Military Hospital uses 'MH' → MH000009.
 * Both the OPD register and the reception-confirm flow call assignUhid so IDs
 * never diverge again.
 */

const { Settings } = require('@rach/core');

const PAD = 6;

async function uhidPrefix(tenantId) {
  try {
    const v = await Settings.get(tenantId, 'uhid_prefix');
    const p = v && (typeof v === 'string' ? v : v.prefix);
    if (typeof p === 'string' && p.trim()) return p.trim().toUpperCase().slice(0, 6);
  } catch { /* fall through */ }
  return 'UH';
}

function formatUhid(prefix, id) {
  return `${prefix}${String(id).padStart(PAD, '0')}`;
}

/** Assign (and persist) the UHID for a freshly-created patient row. `db` = pool or a tx client. */
async function assignUhid(db, tenantId, patientId) {
  const prefix = await uhidPrefix(tenantId);
  const uhid = formatUhid(prefix, patientId);
  await db.query('UPDATE patients SET uhid = $1 WHERE id = $2', [uhid, patientId]);
  return uhid;
}

module.exports = { uhidPrefix, formatUhid, assignUhid };
