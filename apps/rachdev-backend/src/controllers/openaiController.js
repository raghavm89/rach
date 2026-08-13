'use strict';

/**
 * OpenAI-compatible Developer API (`/v1`).
 *
 * A drop-in surface so existing OpenAI SDK/tooling can call a tenant's deployed
 * agents with only a base-url + api-key swap. Auth is a workspace API key
 * (Authorization: Bearer sk_live_…) → tenant. The OpenAI `model` field selects
 * WHICH deployed agent to run: pass the agent's public token (agt_…) or its key.
 *
 *   POST /v1/chat/completions   — stream (SSE) or non-stream, OpenAI shape
 *   GET  /v1/models             — the tenant's deployed agents as "models"
 *
 * The agent's own spec (prompt + pinned model) drives the run; request `system`
 * messages are appended. Metering/BYOK is resolved per the owning tenant exactly
 * like every other run, and each call is logged to agent_runs (channel: api).
 */

const { AgentDefinition, agentSpec } = require('@rach/core');
const { credits } = require('@rach/billing');
const { runAgent } = require('../services/agentRun');
const { resolveModelRun } = require('../services/tenantLlm');

// Resolve the immutable published spec if available, else the current row.
async function specFor(def) {
  try {
    const v = await AgentDefinition.getVersion(def.tenant_id, def.key, def.version);
    if (v) return v;
  } catch { /* fall through */ }
  return agentSpec.rowToSpec(def);
}

// Resolve the OpenAI `model` field → a deployed agent owned by this tenant.
// Accepts the agent public token (agt_…) or the agent key. "default"/"auto"/""
// falls back to the tenant's single deployed agent when unambiguous.
async function resolveAgent(tenantId, model) {
  const m = String(model || '').trim();
  if (m.startsWith('agt_')) {
    const byTok = await AgentDefinition.findByPublicToken(m);
    if (byTok && byTok.tenant_id === tenantId && byTok.status === 'deployed') return byTok;
    return null;
  }
  if (m && m !== 'default' && m !== 'auto') {
    const byKey = await AgentDefinition.findByKey(tenantId, m);
    if (byKey && byKey.status === 'deployed') return byKey;
    return null;
  }
  // No/auto model → the tenant's deployed agents; use the only one if unambiguous.
  const owned = await AgentDefinition.listOwned(tenantId).catch(() => []);
  const deployed = owned.filter((d) => d.status === 'deployed');
  return deployed.length === 1 ? deployed[0] : null;
}

// Split an OpenAI messages[] into (extra system text, conversation turns).
function splitMessages(messages) {
  const arr = Array.isArray(messages) ? messages : [];
  const sys = [];
  const convo = [];
  for (const m of arr) {
    if (!m || typeof m.role !== 'string') continue;
    const content = typeof m.content === 'string'
      ? m.content
      : Array.isArray(m.content) // OpenAI content-parts → concatenate text parts
        ? m.content.map((p) => (p && (p.text || p.content)) || '').join('')
        : String(m.content ?? '');
    if (m.role === 'system') sys.push(content);
    else if (m.role === 'user' || m.role === 'assistant') convo.push({ role: m.role, content });
  }
  return { extraSystem: sys.join('\n\n') || null, convo };
}

const nowUnix = () => Math.floor(Date.now() / 1000);
const cmplId = () => `chatcmpl-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
const OPENAI_ERR = (message, type = 'invalid_request_error', code = null) => ({ error: { message, type, code } });

// GET /v1/models — deployed agents advertised as OpenAI "models".
exports.listModels = async (req, res) => {
  const tid = req.apiKey.tenant_id;
  const owned = await AgentDefinition.listOwned(tid).catch(() => []);
  const data = owned
    .filter((d) => d.status === 'deployed')
    .map((d) => ({
      id: d.public_token || d.key,
      object: 'model',
      created: Math.floor(new Date(d.created_at || Date.now()).getTime() / 1000),
      owned_by: `tenant:${tid}`,
      name: d.name || d.key,
    }));
  res.json({ object: 'list', data });
};

// POST /v1/chat/completions — OpenAI-shaped, streaming or not.
exports.chatCompletions = async (req, res) => {
  const tid = req.apiKey.tenant_id;
  const body = req.body || {};
  const stream = body.stream === true || body.stream === 'true';

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json(OPENAI_ERR('`messages` is required and must be a non-empty array.'));
  }

  const def = await resolveAgent(tid, body.model);
  if (!def) {
    return res.status(404).json(OPENAI_ERR(
      `No deployed agent matches model "${body.model || ''}". Use the agent's public token (agt_…) or key — see GET /v1/models.`,
      'invalid_request_error', 'model_not_found'));
  }

  const spec = await specFor(def);
  const { extraSystem, convo } = splitMessages(body.messages);
  if (!convo.length) return res.status(400).json(OPENAI_ERR('`messages` must include at least one user/assistant turn.'));

  // Credit-gate metered (non-BYOK) runs up front so we can return a clean 402.
  const pinned = (spec.model_policy && spec.model_policy.pin) || null;
  const run = await resolveModelRun(tid, pinned);
  if (run.meter) {
    const balance = await credits.getOrCreateBalance(tid);
    if (balance <= 0) {
      return res.status(402).json(OPENAI_ERR('Insufficient credits for this workspace.', 'insufficient_quota', 'insufficient_quota'));
    }
  }

  const modelId = def.public_token || def.key;
  const id = cmplId();
  const created = nowUnix();
  const log = { channel: 'api', conversationId: (body.user ? String(body.user).slice(0, 128) : null), subjectId: def.id, subjectName: def.name };

  if (!stream) {
    try {
      const out = await runAgent({ spec, tenantId: tid, messages: convo, extraSystem, log });
      return res.json({
        id, object: 'chat.completion', created, model: modelId,
        choices: [{ index: 0, message: { role: 'assistant', content: out.reply }, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: out.inputTokens || 0,
          completion_tokens: out.outputTokens || 0,
          total_tokens: (out.inputTokens || 0) + (out.outputTokens || 0),
        },
        x_rachdev: { credits_used: out.creditsUsed || 0, metered: !!out.meter },
      });
    } catch (err) {
      if (err && err.code === 'insufficient_credits') {
        return res.status(402).json(OPENAI_ERR('Insufficient credits for this workspace.', 'insufficient_quota', 'insufficient_quota'));
      }
      return res.status(500).json(OPENAI_ERR(err.message || 'Upstream model error', 'api_error'));
    }
  }

  // ── Streaming (SSE, OpenAI chunk format) ────────────────────────────────────
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const sse = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const chunk = (delta, finish = null) => ({
    id, object: 'chat.completion.chunk', created, model: modelId,
    choices: [{ index: 0, delta, finish_reason: finish }],
  });

  // First chunk announces the role (OpenAI convention).
  sse(chunk({ role: 'assistant' }));

  try {
    await runAgent({
      spec, tenantId: tid, messages: convo, extraSystem, log,
      onText: (t) => { if (t) sse(chunk({ content: t })); },
    });
    sse(chunk({}, 'stop'));
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    // Mid-stream failure: emit an error event, still terminate cleanly.
    sse({ error: { message: err.message || 'stream_error', type: err.code === 'insufficient_credits' ? 'insufficient_quota' : 'api_error' } });
    res.write('data: [DONE]\n\n');
    res.end();
  }
};
