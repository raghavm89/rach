'use strict';

/**
 * Seed a tenant with a Military-Hospital healthcare DEMO dataset:
 *   • Patients   → patients (+ a few visits)
 *   • Inventory  → drug_stock (+ reorder_alerts for low stock)
 *   • Coordination → beds (+ referrals)
 *
 * Tenant-scoped and idempotent — safe to re-run (won't duplicate).
 *
 *   node apps/rachdev-backend/scripts/seed-healthcare-demo.js <tenantId>
 *   node apps/rachdev-backend/scripts/seed-healthcare-demo.js you@example.com
 *
 * The tenant's industry must be 'healthcare' for the workspace screens to show.
 * Run it where the DB env is set (locally with .env, or `railway run …` in prod).
 */

require('dotenv').config();
const { pool } = require('@rach/core');

// ── Demo content ──────────────────────────────────────────────────────────────
const PATIENTS = [
  { uhid: 'MH-1001', name: 'Sub Maj Rajinder Singh', age: '54', sex: 'M', phone: '+91 98110 20001', address: 'Officers Enclave, Delhi Cantt', dept: 'Cardiology',       reason: 'Chest pain on exertion',        status: 'in_consultation' },
  { uhid: 'MH-1002', name: 'Hav Anil Kumar',          age: '39', sex: 'M', phone: '+91 98110 20002', address: 'Unit Lines, Meerut',        dept: 'Orthopaedics',     reason: 'Knee pain, post-PT review',      status: 'waiting' },
  { uhid: 'MH-1003', name: 'Nk Suresh Yadav',         age: '31', sex: 'M', phone: '+91 98110 20003', address: 'JCO Quarters, Ambala',      dept: 'General Medicine', reason: 'Fever and body ache',            status: 'waiting' },
  { uhid: 'MH-1004', name: 'Maj Priya Nair',          age: '41', sex: 'F', phone: '+91 98110 20004', address: 'Station HQ, Pune',          dept: 'ENT',              reason: 'Recurrent sinusitis',            status: 'scheduled' },
  { uhid: 'MH-1005', name: 'Capt Vikram Rao',         age: '35', sex: 'M', phone: '+91 98110 20005', address: 'Officers Mess, Jaipur',     dept: 'Surgery',          reason: 'Post-op wound check',            status: 'completed' },
  { uhid: 'MH-1006', name: 'Sep Mohd Irfan',          age: '26', sex: 'M', phone: '+91 98110 20006', address: 'Barracks Block C, Bhopal',  dept: 'General Medicine', reason: 'Persistent cough',               status: 'waiting' },
  { uhid: 'MH-1007', name: 'Smt Kavita Sharma (Dep)', age: '48', sex: 'F', phone: '+91 98110 20007', address: 'Family Quarters, Delhi Cantt', dept: 'Gynaecology',   reason: 'Routine check-up',               status: 'scheduled' },
  { uhid: 'MH-1008', name: 'Lt Col A K Menon',        age: '50', sex: 'M', phone: '+91 98110 20008', address: 'Officers Enclave, Secunderabad', dept: 'Cardiology', reason: 'Hypertension follow-up',        status: 'waiting' },
];

// Inventory — a low quantity vs threshold triggers a reorder alert.
const DRUGS = [
  { drug: 'Paracetamol 500mg',        unit: 'tablet', quantity: 1800, reorder_threshold: 500 },
  { drug: 'Amoxicillin 500mg',        unit: 'capsule', quantity: 240,  reorder_threshold: 300 }, // low
  { drug: 'Ceftriaxone 1g Injection', unit: 'vial',   quantity: 60,   reorder_threshold: 80  }, // low
  { drug: 'ORS Sachets',              unit: 'sachet', quantity: 950,  reorder_threshold: 200 },
  { drug: 'Ibuprofen 400mg',          unit: 'tablet', quantity: 1200, reorder_threshold: 400 },
  { drug: 'Normal Saline 500ml',      unit: 'bottle', quantity: 130,  reorder_threshold: 150 }, // low
  { drug: 'Insulin (Human) 40IU',     unit: 'vial',   quantity: 44,   reorder_threshold: 50  }, // low
  { drug: 'Bandage Roll 10cm',        unit: 'roll',   quantity: 600,  reorder_threshold: 150 },
];

const WARDS = [
  { ward: 'Officers Ward',  kind: 'general', beds: ['O-01', 'O-02', 'O-03'] },
  { ward: 'General Ward A',  kind: 'general', beds: ['A-01', 'A-02', 'A-03', 'A-04'] },
  { ward: 'ICU',             kind: 'ICU',     beds: ['ICU-1', 'ICU-2', 'ICU-3'] },
];

const REFERRALS = [
  { patient: 'MH-1001', from_dept: 'Cardiology',       to_dept: 'Cardiac Surgery',  to_hospital: 'Army R&R Hospital, Delhi', reason: 'Angiography advised',        priority: 'urgent',  status: 'open' },
  { patient: 'MH-1005', from_dept: 'Surgery',          to_dept: 'Physiotherapy',    to_hospital: null,                        reason: 'Post-op rehabilitation',     priority: 'routine', status: 'accepted' },
  { patient: 'MH-1004', from_dept: 'ENT',              to_dept: 'Radiology',        to_hospital: null,                        reason: 'CT PNS required',            priority: 'routine', status: 'open' },
  { patient: 'MH-1008', from_dept: 'General Medicine', to_dept: 'Cardiology',       to_hospital: null,                        reason: 'Uncontrolled hypertension',  priority: 'urgent',  status: 'completed' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function resolveTenantId(arg) {
  if (/^\d+$/.test(String(arg))) return Number(arg);
  const { rows } = await pool.query('SELECT tenant_id FROM users WHERE lower(email) = lower($1)', [String(arg)]);
  if (!rows[0] || rows[0].tenant_id == null) throw new Error(`No tenant found for "${arg}" (pass a numeric tenantId or a valid account email)`);
  return rows[0].tenant_id;
}

// Insert if a natural key is absent; returns the row id either way.
async function upsertPatient(tid, p) {
  const found = await pool.query('SELECT id FROM patients WHERE tenant_id=$1 AND uhid=$2', [tid, p.uhid]);
  if (found.rows[0]) return { id: found.rows[0].id, created: false };
  const { rows } = await pool.query(
    `INSERT INTO patients (tenant_id, uhid, source_system, name, age, sex, phone, address)
     VALUES ($1,$2,'local',$3,$4,$5,$6,$7) RETURNING id`,
    [tid, p.uhid, p.name, p.age, p.sex, p.phone, p.address]
  );
  return { id: rows[0].id, created: true };
}

async function upsertDrug(tid, d) {
  const found = await pool.query('SELECT id FROM drug_stock WHERE tenant_id=$1 AND drug=$2', [tid, d.drug]);
  if (found.rows[0]) return { id: found.rows[0].id, created: false };
  const { rows } = await pool.query(
    `INSERT INTO drug_stock (tenant_id, drug, unit, quantity, reorder_threshold)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [tid, d.drug, d.unit, d.quantity, d.reorder_threshold]
  );
  return { id: rows[0].id, created: true };
}

async function main() {
  const arg = process.argv[2];
  if (!arg) { console.error('Usage: node scripts/seed-healthcare-demo.js <tenantId | account-email>'); process.exit(1); }
  const tid = await resolveTenantId(arg);

  const t = await pool.query('SELECT name, industry FROM tenants WHERE id=$1', [tid]);
  if (!t.rows[0]) throw new Error(`Tenant ${tid} not found`);
  console.log(`Seeding tenant ${tid} — ${t.rows[0].name} (industry: ${t.rows[0].industry || 'unset'})`);
  if (t.rows[0].industry !== 'healthcare') {
    console.log('  ⚠  industry is not "healthcare" — the workspace screens will stay hidden until it is set to healthcare.');
  }

  const counts = { patients: 0, visits: 0, drugs: 0, alerts: 0, beds: 0, referrals: 0 };
  const idByUhid = {};

  // 1. Patients (+ visits)
  for (const p of PATIENTS) {
    const { id, created } = await upsertPatient(tid, p);
    idByUhid[p.uhid] = id;
    if (created) counts.patients++;
  }
  // Visits: only seed if this tenant has none yet (keeps re-runs clean).
  const vCount = await pool.query('SELECT COUNT(*)::int AS n FROM visits WHERE tenant_id=$1', [tid]);
  if (vCount.rows[0].n === 0) {
    let token = 1;
    for (const p of PATIENTS) {
      await pool.query(
        `INSERT INTO visits (tenant_id, patient_id, department, doctor_name, token_no, status, reason, source_system)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'local')`,
        [tid, idByUhid[p.uhid], p.dept, 'Duty MO', token++, p.status, p.reason]
      );
      counts.visits++;
    }
  }

  // 2. Inventory — drug_stock (+ reorder_alerts for low stock)
  for (const d of DRUGS) {
    const { id, created } = await upsertDrug(tid, d);
    if (created) counts.drugs++;
    if (d.quantity < d.reorder_threshold) {
      const existing = await pool.query(
        `SELECT id FROM reorder_alerts WHERE tenant_id=$1 AND drug_stock_id=$2 AND status='open'`, [tid, id]
      );
      if (!existing.rows[0]) {
        const suggested = Math.max(d.reorder_threshold * 2 - d.quantity, d.reorder_threshold);
        await pool.query(
          `INSERT INTO reorder_alerts (tenant_id, drug_stock_id, drug, quantity, qty_suggested, message, status)
           VALUES ($1,$2,$3,$4,$5,$6,'open')`,
          [tid, id, d.drug, d.quantity, suggested, `${d.drug} below reorder level (${d.quantity}/${d.reorder_threshold})`]
        );
        counts.alerts++;
      }
    }
  }

  // 3. Coordination — beds (+ referrals)
  // Beds have a UNIQUE(tenant_id, ward, bed_number) constraint → ON CONFLICT.
  const occupancy = { 'Officers Ward:O-01': 'MH-1001', 'General Ward A:A-02': 'MH-1005', 'ICU:ICU-1': 'MH-1008' };
  for (const w of WARDS) {
    for (const bed of w.beds) {
      const uhid = occupancy[`${w.ward}:${bed}`];
      const patientId = uhid ? idByUhid[uhid] : null;
      const status = patientId ? 'occupied' : 'available';
      const res = await pool.query(
        `INSERT INTO beds (tenant_id, ward, bed_number, kind, status, patient_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (tenant_id, ward, bed_number) DO NOTHING RETURNING id`,
        [tid, w.ward, bed, w.kind, status, patientId]
      );
      if (res.rows[0]) counts.beds++;
    }
  }
  // Referrals: only if none yet for this tenant.
  const rCount = await pool.query('SELECT COUNT(*)::int AS n FROM referrals WHERE tenant_id=$1', [tid]);
  if (rCount.rows[0].n === 0) {
    for (const r of REFERRALS) {
      await pool.query(
        `INSERT INTO referrals (tenant_id, patient_id, patient_ref, from_dept, to_dept, to_hospital, reason, priority, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [tid, idByUhid[r.patient] || null, r.patient, r.from_dept, r.to_dept, r.to_hospital, r.reason, r.priority, r.status]
      );
      counts.referrals++;
    }
  }

  console.log('Seeded (new rows this run):');
  for (const [k, n] of Object.entries(counts)) console.log(`  ${k.padEnd(10)} ${n}`);
  console.log('Done. Re-running is safe — existing rows are left as-is.');
}

main()
  .then(() => pool.end())
  .catch((err) => { console.error('Seed failed:', err.message); pool.end().finally(() => process.exit(1)); });
