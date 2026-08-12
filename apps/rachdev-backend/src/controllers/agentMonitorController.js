'use strict';

/**
 * Agent Monitor — the operations view for the agent product.
 *
 * Repurposed from the old fixed healthcare-persona roster to the tenant's OWN
 * work: the agents they built (Agent Builder) and the teams they assembled
 * (canvas), each with real activity and credit spend derived from the metered
 * credit ledger. This is the "are my agents running and what are they costing me"
 * screen — the one that matters once usage is billed per credit.
 *
 * Telemetry source: credit_transactions. Every metered LLM call writes a `usage`
 * row with a structured description we can attribute back to a team or agent:
 *   "Team run: <name> · <specialist>" | "Team route: <name>" | "Team edit: <name>"
 *   "Agent test: <name>"
 * Attribution is by exact name parsed out of that prefix.
 */

const { pool, AgentDefinition, AgentTeam } = require('@rach/core');
const { credits } = require('@rach/billing');

const isToday = (d) => {
  const t = new Date(d); const n = new Date();
  return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate();
};

// Parse a ledger description → which entity it belongs to (or null).
function attribute(desc) {
  const s = String(desc || '');
  if (s.startsWith('Team run: ')) return { kind: 'team', name: s.slice('Team run: '.length).split(' · ')[0] };
  if (s.startsWith('Team route: ')) return { kind: 'team', name: s.slice('Team route: '.length) };
  if (s.startsWith('Team edit: ')) return { kind: 'team', name: s.slice('Team edit: '.length) };
  if (s.startsWith('Team test: ')) return { kind: 'team', name: s.slice('Team test: '.length) };
  if (s.startsWith('Agent test: ')) return { kind: 'agent', name: s.slice('Agent test: '.length) };
  return null;
}

const agentStatus = (row) => {
  if (typeof row.enabled === 'boolean' && !row.enabled) return 'disabled';
  return row.status || 'draft';
};
const channelsOf = (team) => {
  const nodes = (team.graph && Array.isArray(team.graph.nodes)) ? team.graph.nodes : [];
  const chans = nodes.filter((n) => n.type === 'channel')
    .map((n) => String((n.data && (n.data.channel || n.data.label)) || '').trim())
    .filter(Boolean);
  return Array.from(new Set(chans));
};

// GET /api/agent-monitor — the tenant's agents + teams with activity & spend.
exports.overview = async (req, res) => {
  const tid = req.user.tenant_id;
  if (tid == null) {
    return res.json({ summary: null, entities: [], recent: [] });
  }

  const [defs, teams, balance, txnsRes] = await Promise.all([
    AgentDefinition.listOwned(tid).catch(() => []),
    AgentTeam.listForTenant(tid).catch(() => []),
    credits.getOrCreateBalance(tid).catch(() => 0),
    pool.query(
      `SELECT type, amount, tokens_used, description, created_at
         FROM credit_transactions WHERE tenant_id = $1
         ORDER BY created_at DESC LIMIT 2000`,
      [tid]
    ),
  ]);
  const txns = txnsRes.rows;

  // Aggregate spend/activity per attributed entity.
  const agg = new Map(); // key `${kind}:${name}` → { runsToday, runsTotal, credits, lastRun }
  let spentToday = 0; let spentTotal = 0; let activityToday = 0;
  for (const t of txns) {
    const spend = t.type === 'usage' ? -Number(t.amount) : 0;
    if (spend > 0) { spentTotal += spend; if (isToday(t.created_at)) { spentToday += spend; activityToday += 1; } }
    const a = attribute(t.description);
    if (!a) continue;
    const key = `${a.kind}:${a.name}`;
    const cur = agg.get(key) || { runsToday: 0, runsTotal: 0, credits: 0, lastRun: null };
    cur.runsTotal += 1;
    cur.credits += Math.max(0, spend);
    if (isToday(t.created_at)) cur.runsToday += 1;
    if (!cur.lastRun || new Date(t.created_at) > new Date(cur.lastRun)) cur.lastRun = t.created_at;
    agg.set(key, cur);
  }

  const entityFor = (kind, id, name, subtitle, status, model) => {
    const a = agg.get(`${kind}:${name}`) || { runsToday: 0, runsTotal: 0, credits: 0, lastRun: null };
    return { kind, id, name, subtitle, status, model, runs_today: a.runsToday, runs_total: a.runsTotal, credits_spent: a.credits, last_run: a.lastRun };
  };

  const agents = defs.map((d) => entityFor(
    'agent', d.id, d.name || d.key || `Agent ${d.id}`, d.industry || 'agent',
    agentStatus(d), d.model_class ? `claude · ${d.model_class}` : 'claude (gateway default)'));

  const teamEntities = teams.map((t) => {
    const chans = channelsOf(t);
    return entityFor('team', t.id, t.name, chans.length ? chans.join(', ') : 'team',
      t.status || 'draft', 'multi-agent');
  });

  const entities = [...teamEntities, ...agents]
    .sort((a, b) => (new Date(b.last_run || 0).getTime()) - (new Date(a.last_run || 0).getTime()));

  const recent = txns.slice(0, 15).map((t) => ({
    type: t.type,
    description: t.description || (t.type === 'purchase' ? 'Credit purchase' : 'Usage'),
    credits: t.type === 'usage' ? -Number(t.amount) : Number(t.amount),
    tokens: t.tokens_used != null ? Number(t.tokens_used) : null,
    at: t.created_at,
  }));

  res.json({
    summary: {
      agents: agents.length,
      teams: teamEntities.length,
      deployed: [...agents, ...teamEntities].filter((e) => e.status === 'deployed').length,
      balance,
      spent_today: spentToday,
      spent_total: spentTotal,
      activity_today: activityToday,
    },
    entities,
    recent,
  });
};
