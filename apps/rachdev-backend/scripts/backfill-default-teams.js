'use strict';

/**
 * Backfill the editable default Agent Team into EXISTING workspaces that have
 * none. Idempotent — a workspace that already has any team is skipped. The team
 * seeded matches the tenant's industry (Care Team / People Team) or a generic
 * starter. Run where the DB env is set (locally with .env, or `railway run …`).
 *
 *   node apps/rachdev-backend/scripts/backfill-default-teams.js            # all tenants missing a team
 *   node apps/rachdev-backend/scripts/backfill-default-teams.js <tenantId> # one tenant
 *   node apps/rachdev-backend/scripts/backfill-default-teams.js you@org.com# resolve tenant by account email
 */

require('dotenv').config();
const { pool, AgentTeam } = require('@rach/core');

async function targets(arg) {
  if (!arg || arg === '--all') {
    const { rows } = await pool.query(
      `SELECT t.id FROM tenants t
        WHERE NOT EXISTS (SELECT 1 FROM agent_teams a WHERE a.tenant_id = t.id)
        ORDER BY t.id`
    );
    return rows.map((r) => r.id);
  }
  if (/^\d+$/.test(String(arg))) return [Number(arg)];
  const { rows } = await pool.query('SELECT tenant_id FROM users WHERE lower(email) = lower($1)', [String(arg)]);
  if (!rows[0] || rows[0].tenant_id == null) throw new Error(`No tenant found for "${arg}"`);
  return [rows[0].tenant_id];
}

async function main() {
  const ids = await targets(process.argv[2]);
  if (!ids.length) { console.log('No workspaces need a default team.'); return; }
  let created = 0;
  for (const id of ids) {
    const r = await AgentTeam.ensureDefaultForTenant(id);
    console.log(`  tenant ${id}: ${r.created ? `created "${r.team.name}"` : 'already has a team — skipped'}`);
    if (r.created) created++;
  }
  console.log(`Done. ${created} team(s) created across ${ids.length} workspace(s).`);
}

main()
  .then(() => pool.end())
  .catch((err) => { console.error('Backfill failed:', err.message); pool.end().finally(() => process.exit(1)); });
