'use strict';

/**
 * Make a tenant's patient UHIDs consistent: set its prefix and reformat EVERY
 * patient to `<PREFIX><zero-padded id>` (the same scheme the app uses). Fixes a
 * demo that mixes seeded IDs (MH-1002) and app-generated IDs (UH000009).
 *
 *   node apps/rachdev-backend/scripts/normalize-uhids.js <tenantId|email> [PREFIX]
 *
 * PREFIX is optional — if given it's saved as the tenant's uhid_prefix (so new
 * patients use it too); otherwise the tenant's existing prefix (or 'UH') is used.
 * Run where the DB env is set (locally with .env, or `railway run …`).
 */

require('dotenv').config();
const { pool, Settings } = require('@rach/core');
const { formatUhid } = require('../src/services/patientId');

async function resolveTenant(arg) {
  if (/^\d+$/.test(String(arg))) return Number(arg);
  const { rows } = await pool.query('SELECT tenant_id FROM users WHERE lower(email) = lower($1)', [String(arg)]);
  if (!rows[0] || rows[0].tenant_id == null) throw new Error(`No tenant found for "${arg}"`);
  return rows[0].tenant_id;
}

async function main() {
  const arg = process.argv[2];
  const prefixArg = (process.argv[3] || '').trim().toUpperCase();
  if (!arg) { console.error('Usage: node scripts/normalize-uhids.js <tenantId | email> [PREFIX]'); process.exit(1); }
  const tid = await resolveTenant(arg);

  if (prefixArg) { await Settings.set(tid, 'uhid_prefix', { prefix: prefixArg }); console.log(`Set uhid_prefix = ${prefixArg} for tenant ${tid}.`); }
  const setting = await Settings.get(tid, 'uhid_prefix');
  const prefix = prefixArg || (setting && (setting.prefix || setting)) || 'UH';

  const { rows } = await pool.query('SELECT id, uhid FROM patients WHERE tenant_id = $1 ORDER BY id', [tid]);
  let changed = 0;
  for (const r of rows) {
    const next = formatUhid(prefix, r.id);
    if (r.uhid === next) continue;
    await pool.query('UPDATE patients SET uhid = $1, updated_at = NOW() WHERE id = $2', [next, r.id]);
    changed++;
  }
  console.log(`Reformatted ${changed} of ${rows.length} patient UHID(s) to ${prefix}###### for tenant ${tid}.`);
  console.log('Note: historical references (encounters/visits) keep the id they were created with; new records use the normalized UHID.');
}

main()
  .then(() => pool.end())
  .catch((err) => { console.error('Failed:', err.message); pool.end().finally(() => process.exit(1)); });
