'use strict';

/**
 * Backfill the healthcare routing rules onto an EXISTING Care Team's conductor
 * (bed/OT/emergency → Kabir, prescription → Kiran, documentation → Naina).
 * Matches specialists by name/role so it targets the right nodes even if ids
 * were changed. Idempotent — re-running just re-sets the rules.
 *
 *   node apps/rachdev-backend/scripts/set-care-team-routing.js <tenantId>
 *   node apps/rachdev-backend/scripts/set-care-team-routing.js you@org.com
 *
 * Run where the DB env is set (locally with .env, or `railway run …`).
 */

require('dotenv').config();
const { pool, AgentTeam } = require('@rach/core');

// keyword rule → which specialist it should route to (matched by name/role).
const RULES = [
  { when: 'emergency, ICU, OT, operation, surgery, admit, admission, bed, transfer', match: ['kabir', 'coordination'] },
  { when: 'prescription, medicine, medication, dispense, pharmacy, drug, refill, dosage', match: ['kiran', 'pharmacy'] },
  { when: 'note, document, documentation, SOAP, summary, scribe, visit', match: ['naina', 'scribe'] },
];

async function resolveTenant(arg) {
  if (/^\d+$/.test(String(arg))) return Number(arg);
  const { rows } = await pool.query('SELECT tenant_id FROM users WHERE lower(email) = lower($1)', [String(arg)]);
  if (!rows[0] || rows[0].tenant_id == null) throw new Error(`No tenant found for "${arg}"`);
  return rows[0].tenant_id;
}

const textOf = (n) => `${(n.data && n.data.label) || ''} ${(n.data && n.data.role) || ''}`.toLowerCase();

async function main() {
  const arg = process.argv[2];
  if (!arg) { console.error('Usage: node scripts/set-care-team-routing.js <tenantId | account-email>'); process.exit(1); }
  const tid = await resolveTenant(arg);

  const teams = await AgentTeam.listForTenant(tid);
  const team = teams.find((t) => t.key === 'care-team')
    || teams.find((t) => ((t.graph && t.graph.nodes) || []).some((n) => n.type === 'conductor'));
  if (!team) throw new Error('No team with a conductor found for this tenant — open Agent Teams once to seed the Care Team.');

  const nodes = (team.graph && team.graph.nodes) || [];
  const conductor = nodes.find((n) => n.type === 'conductor');
  if (!conductor) throw new Error(`Team "${team.name}" has no conductor node`);

  const rules = [];
  for (const r of RULES) {
    const target = nodes.find((n) => n.type === 'specialist' && r.match.some((k) => textOf(n).includes(k)));
    if (target) rules.push({ when: r.when, to: target.id });
    else console.warn(`  (skipped) no specialist matching ${r.match.join(' / ')}`);
  }
  if (!rules.length) throw new Error('No matching specialists (Naina/Kabir/Kiran) found in the team');

  const graph = { ...team.graph, nodes: nodes.map((n) => (n.id === conductor.id ? { ...n, data: { ...(n.data || {}), rules } } : n)) };
  await AgentTeam.update(team.id, { graph });

  console.log(`Set ${rules.length} routing rule(s) on "${team.name}" (team ${team.id}, conductor ${conductor.id}):`);
  const nameById = Object.fromEntries(nodes.map((n) => [n.id, (n.data && n.data.label) || n.id]));
  rules.forEach((r) => console.log(`  when: ${r.when}\n     → ${nameById[r.to]}`));
  console.log('\nNote: editing reset the team to draft — re-publish / Deploy to push these rules to the widget/API.');
}

main()
  .then(() => pool.end())
  .catch((err) => { console.error('Failed:', err.message); pool.end().finally(() => process.exit(1)); });
