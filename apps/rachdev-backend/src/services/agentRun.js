'use strict';

/**
 * Shared agent runtime — executes ONE deployed agent spec on a message.
 * The single-agent analogue of teamRuntime: load the spec's prompt + model,
 * run a turn through the gateway (metered as credits, or on the tenant's BYOK
 * key with no charge), return the reply. No per-agent VM/container — the agent
 * is just its spec, executed on demand by the gateway.
 */

const { gateway } = require('@rach/llm');
const { AgentRun } = require('@rach/core');
const { resolveModelRun } = require('./tenantLlm');

// Extract a plain-string "last user message" from either a single message or a
// full OpenAI-style messages array — used for the mock text and run logging.
function lastUserText(message, messages) {
  if (Array.isArray(messages) && messages.length) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i] && messages[i].role === 'user') return String(messages[i].content || '');
    }
    return String(messages[messages.length - 1].content || '');
  }
  return String(message || '');
}

async function runAgent({ spec, tenantId, userId = null, message, messages = null, extraSystem = null, onText = null, log = null }) {
  let system = (spec && spec.prompt) || 'You are a helpful assistant.';
  if (extraSystem) system = `${system}\n\n${extraSystem}`;
  const modelId = (spec && spec.model_policy && spec.model_policy.pin) || null;
  const run = await resolveModelRun(tenantId, modelId);
  const convo = Array.isArray(messages) && messages.length
    ? messages
    : [{ role: 'user', content: String(message || '') }];
  const userText = lastUserText(message, messages);
  const mock = `**[Mock mode]** ${(spec && spec.name) || 'The agent'} would answer: "${userText}". Turn LLM_MOCK off for real replies.`;
  try {
    const res = await gateway.chat({
      tenantId, userId, system,
      ...(run.model ? { model: run.model } : {}),
      messages: convo,
      ...(typeof onText === 'function' ? { onText } : {}),
      description: `Agent run: ${(spec && (spec.name || spec.key)) || 'agent'}`,
      apiKey: run.apiKey, meter: run.meter, mock,
    });
    if (log) await AgentRun.log({ tenantId, subjectType: 'agent', subjectId: log.subjectId, subjectName: log.subjectName, channel: log.channel || 'api', conversationId: log.conversationId || null, userMessage: userText, reply: res.text, model: res.model, creditsUsed: res.creditsUsed, status: 'ok' });
    return { reply: res.text, creditsUsed: res.creditsUsed || 0, model: res.model, meter: run.meter, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
  } catch (err) {
    if (log) await AgentRun.log({ tenantId, subjectType: 'agent', subjectId: log.subjectId, subjectName: log.subjectName, channel: log.channel || 'api', conversationId: log.conversationId || null, userMessage: userText, reply: `error: ${err.message}`, model: run.model, creditsUsed: 0, status: 'error' });
    throw err;
  }
}

module.exports = { runAgent };
