'use strict';

/**
 * One-time cleanup: reopen visits that were marked 'completed' but have NO
 * clinical note linked to that visit (visit_id). These are legacy rows created
 * before the completion guard required a per-visit note. Cancelled visits are
 * left alone (cancelling never needs notes).
 *
 *   node apps/rachdev-backend/scripts/reopen-undocumented-visits.js [tenantId] [--dry]
 *
 * With no tenantId it scans every tenant. Pass --dry to preview without writing.
 */

require('dotenv').config();
const { pool } = require('@rach/core');

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const tenantArg = args.find((a) => /^\d+$/.test(a));
  const tenantId = tenantArg ? Number(tenantArg) : null;

  const params = [];
  let where = `v.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM clinical_notes n
       WHERE n.visit_id = v.id AND n.tenant_id = v.tenant_id
    )`;
  if (tenantId) { params.push(tenantId); where += ` AND v.tenant_id = $${params.length}`; }

  const { rows } = await pool.query(
    `SELECT v.id, v.tenant_id, v.token_no, v.doctor_id, p.name AS patient_name
       FROM visits v JOIN patients p ON p.id = v.patient_id
      WHERE ${where}
      ORDER BY v.tenant_id, v.id`,
    params
  );

  if (!rows.length) { console.log('No completed-without-notes visits found. Nothing to do.'); await pool.end(); return; }

  console.log(`Found ${rows.length} completed visit(s) with no linked notes:`);
  for (const r of rows) console.log(`  · tenant ${r.tenant_id} · visit #${r.id} (token ${r.token_no ?? '—'}) · ${r.patient_name}`);

  if (dry) { console.log('\n--dry: no changes written.'); await pool.end(); return; }

  const ids = rows.map((r) => r.id);
  // Reopen to 'in_consultation' if a doctor is assigned, else back to 'waiting'.
  const { rowCount } = await pool.query(
    `UPDATE visits
        SET status = CASE WHEN doctor_id IS NOT NULL THEN 'in_consultation' ELSE 'waiting' END,
            updated_at = NOW()
      WHERE id = ANY($1::int[])`,
    [ids]
  );
  console.log(`\nReopened ${rowCount} visit(s). Record notes in Scribe, then complete them.`);
  await pool.end();
}

main().catch((err) => { console.error('Cleanup failed:', err.message); process.exit(1); });
