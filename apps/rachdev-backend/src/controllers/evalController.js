'use strict';

/**
 * Agent evals — per-agent test cases + a readiness score.
 * Define input→expectation cases, run them against the agent (metered like a
 * test, or on the tenant's BYOK key), and cache pass/fail so readiness is instant
 * at Ship-it. Evals run against the working draft, so you can gate before publish.
 */

const { AgentDefinition, AgentEval, agentSpec } = require('@rach/core');
const { credits } = require('@rach/billing');
const { runAgent } = require('../services/agentRun');
const { resolveModelRun } = require('../services/tenantLlm');

async function ownedAgent(req, res) {
  if (req.user.tenant_id == null) { res.status(400).json({ error: 'No workspace provisioned', code: 'no_tenant' }); return null; }
  const def = await AgentDefinition.findById(Number(req.params.id));
  if (!def || def.tenant_id !== req.user.tenant_id) { res.status(404).json({ error: 'Agent not found' }); return null; }
  return def;
}

// GET /api/agent/definitions/:id/evals
exports.list = async (req, res) => {
  const def = await ownedAgent(req, res); if (!def) return;
  const [evals, readiness] = await Promise.all([
    AgentEval.listForAgent(req.user.tenant_id, def.id),
    AgentEval.readiness(req.user.tenant_id, def.id),
  ]);
  res.json({ evals, readiness });
};

// POST /api/agent/definitions/:id/evals  { name, input, expect_type, expect_value }
exports.create = async (req, res) => {
  const def = await ownedAgent(req, res); if (!def) return;
  const input = String((req.body && req.body.input) || '').trim();
  const expect_value = String((req.body && req.body.expect_value) || '').trim();
  if (!input || !expect_value) return res.status(400).json({ error: 'input and expect_value are required' });
  const evalRow = await AgentEval.create(req.user.tenant_id, def.id, {
    name: (req.body && req.body.name) || 'Test case',
    input, expect_type: (req.body && req.body.expect_type) || 'contains', expect_value, userId: req.user.id,
  });
  res.status(201).json({ eval: evalRow });
};

// DELETE /api/agent/evals/:evalId
exports.remove = async (req, res) => {
  if (req.user.tenant_id == null) return res.status(400).json({ error: 'No workspace provisioned' });
  const ok = await AgentEval.remove(req.user.tenant_id, Number(req.params.evalId));
  if (!ok) return res.status(404).json({ error: 'Eval not found' });
  res.json({ ok: true });
};

// GET /api/agent/definitions/:id/readiness
exports.readiness = async (req, res) => {
  const def = await ownedAgent(req, res); if (!def) return;
  res.json(await AgentEval.readiness(req.user.tenant_id, def.id));
};

// POST /api/agent/definitions/:id/evals/run — run all cases, store + return results.
exports.run = async (req, res) => {
  const def = await ownedAgent(req, res); if (!def) return;
  const evals = await AgentEval.listForAgent(req.user.tenant_id, def.id);
  if (!evals.length) return res.json({ results: [], readiness: { total: 0, passed: 0, ran: 0, readiness: 0 } });

  const spec = agentSpec.rowToSpec(def);
  // Credit-gate metered runs up front (BYOK runs aren't billed).
  const pinned = (spec.model_policy && spec.model_policy.pin) || null;
  const run = await resolveModelRun(req.user.tenant_id, pinned);
  if (run.meter) {
    const balance = await credits.getOrCreateBalance(req.user.tenant_id);
    if (balance <= 0) return res.status(402).json({ error: 'Insufficient credits', balance });
  }

  const results = [];
  for (const e of evals) {
    let reply = '';
    try { const out = await runAgent({ spec, tenantId: req.user.tenant_id, userId: req.user.id, message: e.input }); reply = out.reply; }
    catch (err) {
      if (err && err.code === 'insufficient_credits') { await AgentEval.setResult(e.id, 'fail', 'Out of credits'); results.push({ id: e.id, status: 'fail', output: 'Out of credits' }); continue; }
      reply = `⚠ ${err.message}`;
    }
    const status = AgentEval.evaluate(reply, e.expect_type, e.expect_value) ? 'pass' : 'fail';
    await AgentEval.setResult(e.id, status, reply);
    results.push({ id: e.id, status, output: reply });
  }
  res.json({ results, readiness: await AgentEval.readiness(req.user.tenant_id, def.id) });
};
