'use strict';

/**
 * Agent Teams controller — the multi-agent canvas unit (migration 082).
 * Tenant-scoped CRUD over a team's graph (nodes + edges). Orchestration/test
 * and deploy come in later canvas milestones.
 */

const { AgentTeam } = require('@rach/core');
const { credits } = require('@rach/billing');
const { gateway } = require('@rach/llm');
const { runTeam } = require('../services/teamRuntime');
const { getTenantLlm, llmOpts } = require('../services/tenantLlm');

const NODE_TYPES = ['channel', 'conductor', 'specialist', 'integration', 'handoff'];

// Pull a JSON object out of a model response (handles ```json fences + prose).
function extractJson(t) {
  const s = String(t || '').replace(/```json/gi, '').replace(/```/g, '');
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a === -1 || b <= a) throw new Error('no json');
  return JSON.parse(s.slice(a, b + 1));
}
function validGraph(g) {
  return g && Array.isArray(g.nodes) && Array.isArray(g.edges)
    && g.nodes.every((n) => n && n.id && NODE_TYPES.includes(n.type) && n.position && n.data);
}

const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

function ownedOr404(team, req, res) {
  if (!team || team.tenant_id !== req.user.tenant_id) { res.status(404).json({ error: 'Team not found' }); return false; }
  return true;
}
const noWorkspace = (req, res) => {
  if (req.user.tenant_id == null) { res.status(400).json({ error: 'No workspace provisioned for this account yet', code: 'no_tenant' }); return true; }
  return false;
};

exports.list = async (req, res) => {
  if (req.user.tenant_id == null) return res.json({ teams: [] });
  // Seed the editable default team for this workspace's industry if it has none,
  // so every org's AI flow is a real Agent Team from day one.
  await AgentTeam.ensureDefaultForTenant(req.user.tenant_id, { userId: req.user.id }).catch(() => {});
  const teams = await AgentTeam.listForTenant(req.user.tenant_id);
  res.json({ teams });
};

exports.get = async (req, res) => {
  const team = await AgentTeam.findById(req.params.id);
  if (!ownedOr404(team, req, res)) return;
  res.json({ team });
};

exports.create = async (req, res) => {
  if (noWorkspace(req, res)) return;
  const { name, description, industry, graph } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'name is required' });
  const key = `${slug(name) || 'team'}-${Date.now().toString(36)}`;
  const team = await AgentTeam.create({
    tenant_id: req.user.tenant_id, key, name: name.trim(),
    description: description ?? null, industry: industry ?? null,
    graph: graph || undefined, created_by: req.user.id,
  });
  res.status(201).json({ team });
};

exports.update = async (req, res) => {
  const team = await AgentTeam.findById(req.params.id);
  if (!ownedOr404(team, req, res)) return;
  const { name, description, industry, graph } = req.body || {};
  const updated = await AgentTeam.update(team.id, { name, description, industry, graph });
  res.json({ team: updated });
};

exports.publish = async (req, res) => {
  const team = await AgentTeam.findById(req.params.id);
  if (!ownedOr404(team, req, res)) return;
  const published = await AgentTeam.publish(team.id, req.user.id);
  res.json({ team: published });
};

exports.remove = async (req, res) => {
  const team = await AgentTeam.findById(req.params.id);
  if (!ownedOr404(team, req, res)) return;
  await AgentTeam.remove(team.id);
  res.json({ ok: true });
};

// Build the public embed surface for a deployed team (website-widget channel).
function embedFor(req, token) {
  const apiBase = process.env.PUBLIC_API_BASE || `${req.protocol}://${req.get('host')}`;
  const widgetUrl = `${apiBase}/api/public/widget/${token}/widget.js`;
  const whatsappWebhookUrl = `${apiBase}/api/public/whatsapp/${token}/webhook`;
  return { publicToken: token, widgetUrl, embed: `<script src="${widgetUrl}" async></script>`, whatsappWebhookUrl };
}

// POST /api/agent/teams/:id/deploy — make a published team live + mint the
// public widget token so it can be embedded on a website.
exports.deploy = async (req, res) => {
  const team = await AgentTeam.findById(req.params.id);
  if (!ownedOr404(team, req, res)) return;
  if (!team.version || team.version < 1) {
    return res.status(409).json({ error: 'Publish the team before deploying' });
  }
  const updated = await AgentTeam.update(team.id, { status: 'deployed' });
  const token = await AgentTeam.ensurePublicToken(team.id);
  res.json({ team: updated, endpoint: `https://run.rachbase.com/t/${team.key}`, ...embedFor(req, token) });
};

// POST /api/agent/teams/:id/rotate-token — invalidate old embeds, mint a new token.
exports.rotateToken = async (req, res) => {
  const team = await AgentTeam.findById(req.params.id);
  if (!ownedOr404(team, req, res)) return;
  const token = await AgentTeam.rotatePublicToken(team.id);
  res.json(embedFor(req, token));
};

// POST /api/agent/teams/:id/edit — natural-language graph edit (metered).
// The model rewrites the graph from an instruction; we validate + save it.
exports.edit = async (req, res) => {
  const team = await AgentTeam.findById(req.params.id);
  if (!ownedOr404(team, req, res)) return;
  const instruction = String((req.body && req.body.instruction) || '').trim();
  if (!instruction) return res.status(400).json({ error: 'instruction is required' });

  const balance = await credits.getOrCreateBalance(req.user.tenant_id);
  if (balance <= 0) return res.status(402).json({ error: 'Insufficient credits', balance });

  const graph = team.graph && typeof team.graph === 'object' ? team.graph : { nodes: [], edges: [] };
  const system =
    'You edit an agent-team graph. You receive the current graph JSON and an instruction. ' +
    'Return ONLY the updated graph as JSON: { "nodes": [...], "edges": [...] }. ' +
    `Each node: { "id", "type", "position": {"x","y"}, "data": {...} }, where type is one of ${NODE_TYPES.join(', ')}. ` +
    'Keep existing node ids and positions unless the instruction changes them; place new nodes so they do not overlap. No commentary.';

  // Deterministic mock: append a specialist derived from the instruction so the
  // flow demos with LLM_MOCK on.
  const conductor = (graph.nodes || []).find((n) => n.type === 'conductor');
  const newId = `specialist-${Date.now().toString(36)}`;
  const mockGraph = {
    nodes: [...(graph.nodes || []), {
      id: newId, type: 'specialist',
      position: { x: 560, y: 120 + (graph.nodes || []).length * 30 },
      data: { label: instruction.split(/\s+/).slice(0, 3).join(' ') || 'New specialist', role: instruction, prompt: `You handle: ${instruction}.`, model_class: 'balanced' },
    }],
    edges: [...(graph.edges || []), ...(conductor ? [{ id: `e-${newId}`, source: conductor.id, target: newId }] : [])],
  };

  const llm = await getTenantLlm(req.user.tenant_id);
  const result = await gateway.chat({
    tenantId: req.user.tenant_id, userId: req.user.id, system,
    messages: [{ role: 'user', content: `Current graph:\n${JSON.stringify(graph)}\n\nInstruction: ${instruction}` }],
    description: `Team edit: ${team.name}`, mock: JSON.stringify(mockGraph), ...llmOpts(llm),
  });

  let next;
  try { next = extractJson(result.text); } catch { return res.status(422).json({ error: "Couldn't apply that change — try rephrasing it." }); }
  if (!validGraph(next)) return res.status(422).json({ error: "The change produced an invalid graph — try rephrasing it." });

  const updated = await AgentTeam.update(team.id, { graph: next });
  res.json({ team: updated, creditsUsed: result.creditsUsed });
};

// POST /api/agent/teams/:id/run — run the team on a message (metered). Returns
// the reply + a decision trace of which agents handled it.
exports.run = async (req, res) => {
  const team = await AgentTeam.findById(req.params.id);
  if (!ownedOr404(team, req, res)) return;
  const message = String((req.body && req.body.message) || '').trim();
  if (!message) return res.status(400).json({ error: 'Message required' });

  const balance = await credits.getOrCreateBalance(req.user.tenant_id);
  if (balance <= 0) return res.status(402).json({ error: 'Insufficient credits', balance });

  try {
    const out = await runTeam({ team, message, tenantId: req.user.tenant_id, userId: req.user.id, log: { channel: 'test' } });
    const after = await credits.getOrCreateBalance(req.user.tenant_id);
    res.json({ ...out, balance: after });
  } catch (err) {
    if (err && err.code === 'insufficient_credits') {
      const bal = await credits.getOrCreateBalance(req.user.tenant_id);
      return res.status(402).json({ error: 'Insufficient credits', balance: bal });
    }
    throw err;
  }
};
