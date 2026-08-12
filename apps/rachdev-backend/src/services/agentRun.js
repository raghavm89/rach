'use strict';

/**
 * Shared agent runtime — executes ONE deployed agent spec on a message.
 * The single-agent analogue of teamRuntime: load the spec's prompt + model,
 * run a turn through the gateway (metered as credits, or on the tenant's BYOK
 * key with no charge), return the reply. No per-agent VM/container — the agent
 * is just its spec, executed on demand by the gateway.
 */

const { gateway } = require('@rach/llm');
const { resolveModelRun } = require('./tenantLlm');

async function runAgent({ spec, tenantId, userId = null, message }) {
  const system = (spec && spec.prompt) || 'You are a helpful assistant.';
  const modelId = (spec && spec.model_policy && spec.model_policy.pin) || null;
  const run = await resolveModelRun(tenantId, modelId);
  const mock = `**[Mock mode]** ${(spec && spec.name) || 'The agent'} would answer: "${message}". Turn LLM_MOCK off for real replies.`;
  const res = await gateway.chat({
    tenantId, userId, system,
    ...(run.model ? { model: run.model } : {}),
    messages: [{ role: 'user', content: message }],
    description: `Agent run: ${(spec && (spec.name || spec.key)) || 'agent'}`,
    apiKey: run.apiKey, meter: run.meter, mock,
  });
  return { reply: res.text, creditsUsed: res.creditsUsed || 0, model: res.model, meter: run.meter };
}

module.exports = { runAgent };
