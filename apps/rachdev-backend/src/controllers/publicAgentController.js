'use strict';

/**
 * Public runtime for a single deployed agent (shared agent runtime).
 * Unauthenticated, keyed by the agent's public token (minted on deploy). A
 * visitor sends a message; we load the agent's published spec and run one turn
 * through the gateway, metered against the owning tenant (or its BYOK key). The
 * single-agent analogue of the team website widget — no VM/container per agent.
 */

const { AgentDefinition, agentSpec } = require('@rach/core');
const { credits } = require('@rach/billing');
const { runAgent } = require('../services/agentRun');
const { resolveModelRun } = require('../services/tenantLlm');
const widget = require('./publicWidgetController');

const UNAVAILABLE = "Sorry, the assistant is unavailable right now. Please try again later.";

async function liveAgent(token) {
  const def = await AgentDefinition.findByPublicToken(token);
  if (!def || def.status !== 'deployed') return null;
  return def;
}

// Resolve the immutable published spec if available, else the current row.
async function specFor(def) {
  try {
    const v = await AgentDefinition.getVersion(def.tenant_id, def.key, def.version);
    if (v) return v;
  } catch { /* fall through */ }
  return agentSpec.rowToSpec(def);
}

// GET /api/public/agent/:token/config
exports.config = async (req, res) => {
  const def = await liveAgent(req.params.token);
  if (!def) return res.status(404).json({ error: 'Agent not found' });
  res.json({ title: def.name || 'Assistant', greeting: 'Hi! How can I help you today?', accent: '#4f46e5' });
};

// POST /api/public/agent/:token/message
exports.message = async (req, res) => {
  const def = await liveAgent(req.params.token);
  if (!def) return res.status(404).json({ error: 'Agent not found' });
  const message = String((req.body && req.body.message) || '').trim().slice(0, 4000);
  if (!message) return res.status(400).json({ error: 'Message required' });

  const spec = await specFor(def);
  // Credit-gate quietly, but only for metered (non-BYOK) runs.
  const modelId = (spec.model_policy && spec.model_policy.pin) || null;
  const run = await resolveModelRun(def.tenant_id, modelId);
  if (run.meter) {
    const balance = await credits.getOrCreateBalance(def.tenant_id);
    if (balance <= 0) return res.json({ reply: UNAVAILABLE });
  }
  const channel = req.apiKey ? 'api' : 'widget';
  const conversationId = String((req.body && req.body.conversation_id) || '').slice(0, 128) || null;
  try {
    const out = await runAgent({
      spec, tenantId: def.tenant_id, message,
      log: { channel, conversationId, subjectId: def.id, subjectName: def.name },
    });
    res.json({ reply: out.reply });
  } catch (err) {
    if (err && err.code === 'insufficient_credits') return res.json({ reply: UNAVAILABLE });
    throw err;
  }
};

// GET /api/public/agent/:token/widget.js — reuse the shared embed script.
exports.script = async (req, res) => {
  res.type('application/javascript').set('Cache-Control', 'public, max-age=300');
  res.send(widget.buildScript(req.params.token));
};
