'use strict';

/**
 * Seed a tenant with the HR demo dataset (the same JSON the screens shipped as a
 * self-contained demo). Idempotent — safe to re-run.
 *
 *   node apps/rachdev-backend/scripts/seed-hr-demo.js <tenantId>
 *
 * After seeding, set the tenant's industry to 'hr' so the workspace appears, and
 * the HR screens read this data via /api/hr instead of bundled JSON.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Hr, pool } = require('@rach/core');

const DATA_DIR = path.join(__dirname, '..', '..', 'rachdev-web', 'src', 'data', 'hr');

// file → entity name expected by Hr.seedFromDemo
const FILES = {
  // Layer 1 — Hire
  requisitions: 'requisitions.json',
  applications: 'applications.json',
  candidates: 'candidates.json',
  approvals: 'approvals.json',
  interviews: 'interviews.json',
  offers: 'offers.json',
  audit: 'audit.json',
  // Layers 2–4 — Onboard · Operate · Discover
  employees: 'employees.json',
  onboarding: 'onboarding.json',
  probation: 'probation.json',
  leave: 'leave.json',
  leave_balances: 'leave_balances.json',
  payslips: 'payslips.json',
  letters: 'letters.json',
  tickets: 'tickets.json',
  review_cycles: 'review_cycles.json',
  review_evals: 'review_evals.json',
  partnerships: 'partnerships.json',
  holidays: 'holidays.json',
  announcements: 'announcements.json',
};

async function main() {
  const tenantId = Number(process.argv[2]);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    console.error('Usage: node scripts/seed-hr-demo.js <tenantId>');
    process.exit(1);
  }

  const datasets = {};
  for (const [entity, file] of Object.entries(FILES)) {
    const full = path.join(DATA_DIR, file);
    datasets[entity] = JSON.parse(fs.readFileSync(full, 'utf8'));
  }

  const written = await Hr.seedFromDemo(tenantId, datasets);
  console.log(`Seeded HR demo into tenant ${tenantId}:`);
  for (const [entity, n] of Object.entries(written)) console.log(`  ${entity.padEnd(14)} ${n}`);
}

main()
  .then(() => pool.end())
  .catch((err) => { console.error('Seed failed:', err.message); pool.end().finally(() => process.exit(1)); });
