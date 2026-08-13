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
 * Telemetry source: agent_runs (migration 094). Every handled message — test,
 * widget, WhatsApp, Slack, or API — writes one row attributed by subject id, so
 * per-entity runs/credits/last-active are exact (no fragile ledger-description
 * parsing). The credit ledger still supplies the workspace balance and the
 * running spend total (which also covers non-run costs like edits/routing).
 */

const { pool, AgentDefinition, AgentTeam, AgentRun } = require('@rach/core');
const { credits } = require('@rach/billing');

const isToday = (d) => {
  if (!d) return false;
  const t = new Date(d); const n = new Date();
  return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate();
};

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

  const [defs, teams, balance, txnsRes, runStats] = await Promise.all([
    AgentDefinition.listOwned(tid).catch(() => []),
    AgentTeam.listForTenant(tid).catch(() => []),
    credits.getOrCreateBalance(tid).catch(() => 0),
    pool.query(
      `SELECT type, amount, tokens_used, description, created_at
         FROM credit_transactions WHERE tenant_id = $1
         ORDER BY created_at DESC LIMIT 2000`,
      [tid]
    ),
    AgentRun.statsBySubject(tid).catch(() => ({})),
  ]);
  const txns = txnsRes.rows;

  // Workspace-wide spend from the ledger (covers runs + edits/routing).
  let spentToday = 0; let spentTotal = 0;
  for (const t of txns) {
    const spend = t.type === 'usage' ? -Number(t.amount) : 0;
    if (spend > 0) { spentTotal += spend; if (isToday(t.created_at)) spentToday += spend; }
  }

  // Per-entity activity comes from agent_runs, attributed by subject id.
  let activityToday = 0;
  for (const k of Object.keys(runStats)) activityToday += runStats[k].runs_today || 0;

  const entityFor = (kind, id, name, subtitle, status, model) => {
    const a = runStats[`${kind}:${id}`] || {};
    return {
      kind, id, name, subtitle, status, model,
      runs_today: a.runs_today || 0,
      runs_total: a.runs_total || 0,
      credits_spent: a.credits_spent || 0,
      last_run: a.last_run || null,
    };
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

// GET /api/agent-monitor/conversations — the Conversations inbox. Recent runs
// across every channel, newest first, with optional ?channel= / ?subject_type= /
// ?subject_id= filters. Each row is one handled message (grouped loosely by
// conversation_id where the channel provides one).
exports.conversations = async (req, res) => {
  const tid = req.user.tenant_id;
  if (tid == null) return res.json({ runs: [] });
  const runs = await AgentRun.recent(tid, {
    limit: req.query.limit ? Number(req.query.limit) : 100,
    channel: req.query.channel || null,
    subjectType: req.query.subject_type || null,
    subjectId: req.query.subject_id ? Number(req.query.subject_id) : null,
  }).catch(() => []);
  res.json({ runs });
};
