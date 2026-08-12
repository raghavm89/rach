'use strict';

/**
 * Team orchestration runtime (canvas M3).
 *
 * Given a team graph + a user message: the conductor routes to the best
 * specialist (one metered LLM call), then that specialist responds (a second
 * metered call). Handoff nodes short-circuit to a human. Every model call goes
 * through the shared gateway, so credits are metered exactly like single agents.
 * Returns the reply plus a decision trace of which nodes fired.
 */

const { gateway } = require('@rach/llm');
const { AgentDefinition } = require('@rach/core');
const { buildTools, toolNameFor } = require('./agentTools');
const { getTenantLlm, llmOpts, resolveModelRun } = require('./tenantLlm');

const label = (n) => (n && n.data && typeof n.data.label === 'string' && n.data.label) || (n && n.id) || 'Agent';
const text = (v) => (typeof v === 'string' ? v : '');

/**
 * Deterministic routing rules (L2 Logic). A conductor may carry
 * data.rules = [{ when: "refund, return", to: <specialistNodeId | 'handoff'> }].
 * The first rule whose comma-separated keywords appear in the message wins — so
 * routing is explicit and free (no LLM routing call). Returns { specialist } |
 * { handoff: true } | null (no rule matched → fall back to LLM routing).
 */
function matchRule(rules, message, specialists) {
  const msg = String(message || '').toLowerCase();
  for (const r of (Array.isArray(rules) ? rules : [])) {
    if (!r || !r.to) continue;
    const keys = String(r.when || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
    if (!keys.length) continue;
    if (keys.some((k) => msg.includes(k))) {
      if (r.to === 'handoff') return { handoff: true };
      const sp = specialists.find((s) => s.id === r.to);
      if (sp) return { specialist: sp };
    }
  }
  return null;
}

/**
 * Resolve a node's system prompt + model. If the node references an agent built
 * in the Agent Builder (data.agentDefId), use that agent's *live* prompt/model
 * (edits there propagate). Otherwise fall back to the node's inline prompt.
 */
async function resolveAgent(node, tenantId) {
  const data = (node && node.data) || {};
  if (data.agentDefId) {
    const row = await AgentDefinition.findById(data.agentDefId);
    if (row && row.tenant_id === tenantId && text(row.prompt)) {
      // The built agent's pinned model (legacy `model` column) drives the run.
      return { system: text(row.prompt), modelId: text(row.model) || null };
    }
  }
  const system = text(data.prompt) || `You are ${label(node)}. ${text(data.role)}`.trim();
  return { system, modelId: text(data.model) || null };
}

async function runTeam({ team, message, tenantId, userId }) {
  const nodes = (team.graph && Array.isArray(team.graph.nodes)) ? team.graph.nodes : [];
  const conductor = nodes.find((n) => n.type === 'conductor');
  const specialists = nodes.filter((n) => n.type === 'specialist');
  const handoff = nodes.find((n) => n.type === 'handoff');
  const edges = (team.graph && Array.isArray(team.graph.edges)) ? team.graph.edges : [];
  const trace = [];
  let creditsUsed = 0;

  // BYOK: if the tenant connected their own LLM key, runs use it and are not
  // billed in credits (meter:false). Resolved once for the whole team run.
  const llm = await getTenantLlm(tenantId);

  // 1. Routing (only when there's a conductor + specialists to choose from).
  let chosen = null;
  let toHandoff = false;
  if (conductor && specialists.length) {
    // 1a. Explicit rules first (deterministic, no LLM/credit cost).
    const ruled = matchRule(conductor.data && conductor.data.rules, message, specialists);
    if (ruled && ruled.handoff && handoff) {
      toHandoff = true;
      trace.push({ node: conductor.id, label: label(conductor), detail: 'rule → escalated to a human' });
    } else if (ruled && ruled.specialist) {
      chosen = ruled.specialist;
      trace.push({ node: conductor.id, label: label(conductor), detail: `rule → routed to ${label(chosen)}` });
    }
  }
  // 1b. No rule matched → LLM routing (existing behavior).
  if (conductor && specialists.length && !chosen && !toHandoff) {
    const list = specialists.map((s) => `- ${label(s)}: ${text(s.data && s.data.role)}`).join('\n');
    const routeSystem =
      `You are ${label(conductor)}, the router for a team of specialists. Read the user's message and choose the ONE specialist best suited to handle it. ` +
      `If it needs a human, answer "handoff". If no specialist fits, answer "none". ` +
      `Reply with ONLY the specialist name, or "handoff", or "none".\n\nSpecialists:\n${list}`;
    const routeMock = label(specialists[0]); // deterministic pick in mock mode
    const r = await gateway.chat({
      tenantId, userId, system: routeSystem,
      messages: [{ role: 'user', content: message }],
      description: `Team route: ${team.name}`, mock: routeMock, ...llmOpts(llm),
    });
    creditsUsed += r.creditsUsed || 0;
    const pick = text(r.text).toLowerCase();
    if (pick.includes('handoff') && handoff) {
      toHandoff = true;
      trace.push({ node: conductor.id, label: label(conductor), detail: 'escalated to a human' });
    } else {
      chosen = specialists.find((s) => pick.includes(label(s).toLowerCase())) || specialists[0];
      trace.push({ node: conductor.id, label: label(conductor), detail: `routed to ${label(chosen)}` });
    }
  }
  // Conductor with no specialists answers directly.
  if (conductor && !specialists.length) {
    trace.push({ node: conductor.id, label: label(conductor), detail: 'answered directly' });
  }

  // 2. Human handoff short-circuits.
  if (toHandoff) {
    trace.push({ node: handoff.id, label: label(handoff), detail: 'ticket created for a person' });
    return { reply: "I've passed this to a human on the team — they'll follow up with you shortly.", trace, creditsUsed };
  }

  // 3. Run the chosen specialist (or the conductor directly if no specialists).
  const agent = chosen || conductor || { data: {} };
  const { system, modelId } = await resolveAgent(agent, tenantId);
  // Per-specialist model → its provider/key/meter (falls back to workspace default).
  const run = await resolveModelRun(tenantId, modelId);
  const model = run.model || undefined;
  const mock = `**[Team test — mock mode]** ${label(agent)} would handle: "${message}". Set a funded ANTHROPIC_API_KEY and turn off LLM_MOCK for real replies.`;

  // Tools: integration nodes wired to this specialist become callable tools.
  const integrationNodes = agent && agent.id ? nodes.filter((n) =>
    n.type === 'integration' && edges.some((e) =>
      (e.source === agent.id && e.target === n.id) || (e.target === agent.id && e.source === n.id))) : [];
  const { tools, handlers } = buildTools(integrationNodes, { tenantId });

  let res;
  if (tools.length) {
    res = await gateway.chatWithTools({
      tenantId, userId, system, model,
      messages: [{ role: 'user', content: message }],
      tools, toolHandlers: handlers,
      description: `Team run: ${team.name} · ${label(agent)}`, mock, apiKey: run.apiKey, meter: run.meter,
    });
  } else {
    res = await gateway.chat({
      tenantId, userId, system, model,
      messages: [{ role: 'user', content: message }],
      description: `Team run: ${team.name} · ${label(agent)}`, mock, apiKey: run.apiKey, meter: run.meter,
    });
  }
  creditsUsed += res.creditsUsed || 0;
  if (chosen) trace.push({ node: chosen.id, label: label(chosen), detail: 'handled the request' });
  // Record any tool calls the specialist made.
  for (const call of (res.toolCalls || [])) {
    const inode = integrationNodes.find((n) => toolNameFor(n) === call.name);
    const iLabel = inode ? (text(inode.data && inode.data.integration) || label(inode)) : call.name;
    trace.push({ node: inode ? inode.id : call.name, label: iLabel, detail: 'tool called' });
  }

  return { reply: res.text, trace, creditsUsed, model: res.model };
}

module.exports = { runTeam };
