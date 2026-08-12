'use strict';

/**
 * LLM Gateway — the single choke point for model calls across RachDev & RachBase.
 *
 * Responsibilities: resolve the model (catalog), dispatch to the right provider
 * adapter, stream text back, then meter usage through @rach/billing credits with
 * the model's credit multiplier applied.
 *
 * Extracted from agentController.chat. For the default model (Haiku, multiplier
 * 1.0) the metered credits are identical to the original inline behavior.
 */

const { resolveModel, modelForPolicy } = require('./models');
const anthropic = require('./providers/anthropic');
const openai = require('./providers/openai');
const vllm = require('./providers/vllm');
const { credits } = require('@rach/billing');

const PROVIDERS = {
  anthropic,
  openai, // BYOK: tenant brings an OpenAI key (metering skipped for BYOK runs)
  vllm,   // on-prem sovereign path (Sarvam); stubbed until the endpoint is wired
};

// Demo/offline mode: set LLM_MOCK=1 to return deterministic canned responses
// without calling any provider and without charging credits. Lets every agent
// be demoed with no API spend (e.g. when the Anthropic account has no credits).
const mockEnabled = () => process.env.LLM_MOCK === '1' || process.env.LLM_MOCK === 'true';

const DEFAULT_MOCK_TEXT =
  'Mock mode (LLM_MOCK) is on — this is a canned response and no external model was called. ' +
  'Turn LLM_MOCK off and configure a funded ANTHROPIC_API_KEY for real output.';

function mockChat({ text, system, messages, onText, modelId }) {
  const full = (text && String(text)) || DEFAULT_MOCK_TEXT;
  if (typeof onText === 'function') {
    for (let i = 0; i < full.length; i += 24) onText(full.slice(i, i + 24)); // mimic a stream
  }
  const inputTokens = Math.max(1, Math.ceil(((system || '').length + JSON.stringify(messages || []).length) / 4));
  const outputTokens = Math.max(1, Math.ceil(full.length / 4));
  return {
    text: full,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    billedTokens: 0,
    creditsUsed: 0,
    model: modelId,
  };
}

/**
 * @param {object}   opts
 * @param {number}   opts.tenantId
 * @param {number}   opts.userId
 * @param {string}   [opts.model]      defaults to catalog DEFAULT_MODEL
 * @param {string}   opts.system
 * @param {Array}    opts.messages
 * @param {number}   [opts.maxTokens]  defaults to the model's max_tokens_default
 * @param {string}   [opts.apiKey]     tenant BYOK; else platform key
 * @param {string}   [opts.description] ledger description
 * @param {function} [opts.onText]     streaming callback per text delta
 * @param {boolean}  [opts.meter=true] set false to skip credit deduction (e.g. BYOK)
 * @returns {Promise<{text,inputTokens,outputTokens,totalTokens,billedTokens,creditsUsed,model}>}
 */
async function chat({
  tenantId,
  userId,
  model,
  modelPolicy,
  system,
  messages,
  maxTokens,
  apiKey,
  description = 'LLM call',
  onText,
  meter = true,
  mock, // optional caller-supplied canned response used only when LLM_MOCK is on
}) {
  // Demo/offline: short-circuit before touching a provider or credits.
  if (mockEnabled()) {
    let modelId;
    try { modelId = resolveModel(model || (modelPolicy ? modelForPolicy(modelPolicy) : undefined)).id; }
    catch { modelId = 'mock-model'; }
    return mockChat({ text: mock, system, messages, onText, modelId });
  }

  // An explicit `model` wins; otherwise resolve from an AgentSpec model_policy;
  // otherwise the environment default. Keeps existing callers unchanged.
  const spec = resolveModel(model || (modelPolicy ? modelForPolicy(modelPolicy) : undefined));
  const provider = PROVIDERS[spec.provider];
  if (!provider) throw new Error(`No adapter for provider: ${spec.provider}`);

  const { TOKENS_PER_CREDIT } = credits;
  let effectiveMax = maxTokens || spec.max_tokens_default;
  let reservation = null;

  // Reserve-then-settle: gate + cap + reserve BEFORE generating, so the tenant is
  // never delivered more than they can pay for and concurrent calls can't both
  // read the same balance and each proceed (fixes the deduct-after-stream hole,
  // the missing cap, and the TOCTOU race).
  if (meter) {
    const balance = await credits.getOrCreateBalance(tenantId);
    // Tokens this balance can afford at the model's multiplier.
    const affordableTokens = Math.floor((balance * TOKENS_PER_CREDIT) / spec.credit_multiplier);
    if (affordableTokens < 1) {
      throw new credits.InsufficientCreditsError(balance, 1);
    }
    // Never generate beyond the affordable budget.
    effectiveMax = Math.min(effectiveMax, affordableTokens);
    // Hold the worst-case cost for the capped generation up front (atomic).
    const reserveCredits = Math.max(1, Math.ceil((effectiveMax * spec.credit_multiplier) / TOKENS_PER_CREDIT));
    reservation = await credits.reserveCredits(tenantId, userId, reserveCredits, description);
  }

  let inputTokens, outputTokens, text;
  try {
    ({ text, inputTokens, outputTokens } = await provider.streamChat({
      model: spec.id,
      system,
      messages,
      maxTokens: effectiveMax,
      apiKey,
      onText,
    }));
  } catch (err) {
    // The call produced no billable output — refund the entire hold.
    if (reservation) {
      await credits.releaseReservation(tenantId, reservation.id).catch(() => {});
    }
    throw err;
  }

  const totalTokens = inputTokens + outputTokens;
  // Apply per-model credit multiplier (Haiku = 1.0 → unchanged from original).
  const billedTokens = Math.round(totalTokens * spec.credit_multiplier);

  let creditsUsed = 0;
  if (meter) {
    // Reconcile the reservation down (or up) to actual usage in one ledger row.
    const settled = await credits.settleReservation(tenantId, userId, {
      reservationId:   reservation.id,
      reservedCredits: reservation.credits,
      billedTokens,
      description,
    });
    creditsUsed = settled.creditsUsed;
  }

  return {
    text,
    inputTokens,
    outputTokens,
    totalTokens,
    billedTokens,
    creditsUsed,
    model: spec.id,
  };
}

/**
 * Tool-use chat: runs the model ↔ tool loop.
 *   call model (with tool defs) → if it requests tools, execute handlers →
 *   feed results back → repeat until a final text answer (or maxSteps).
 * Each model turn is metered like chat(). Mock mode simulates one tool call so
 * the flow demos without a provider.
 *
 * @param {Array}    opts.tools         [{ name, description, input_schema }]
 * @param {object}   opts.toolHandlers  { [name]: async (input) => any }
 * @param {number}   [opts.maxSteps=5]
 * @returns {Promise<{ text, toolCalls:[{name,input,result}], creditsUsed, model }>}
 */
async function chatWithTools({
  tenantId, userId, model, modelPolicy, system, messages,
  tools = [], toolHandlers = {}, maxTokens, apiKey,
  description = 'LLM tool call', meter = true, maxSteps = 5, mock,
}) {
  if (mockEnabled()) {
    const toolCalls = [];
    if (tools.length && toolHandlers[tools[0].name]) {
      try { const result = await toolHandlers[tools[0].name]({}); toolCalls.push({ name: tools[0].name, input: {}, result }); }
      catch (e) { toolCalls.push({ name: tools[0].name, input: {}, result: { error: String(e.message) } }); }
    }
    const text = mock || `Mock mode — ${toolCalls.length ? `called ${toolCalls.map((t) => t.name).join(', ')}` : 'no tools called'}. Turn LLM_MOCK off for real tool use.`;
    return { text, toolCalls, creditsUsed: 0, model: 'mock-model' };
  }

  const spec = resolveModel(model || (modelPolicy ? modelForPolicy(modelPolicy) : undefined));
  const provider = PROVIDERS[spec.provider];
  if (!provider || typeof provider.toolChat !== 'function') {
    throw new Error(`Tool use is not supported on provider: ${spec.provider}`);
  }
  const { TOKENS_PER_CREDIT } = credits;

  const convo = Array.isArray(messages) ? [...messages] : [];
  const toolCalls = [];
  let creditsUsed = 0;
  let finalText = '';

  for (let step = 0; step < maxSteps; step++) {
    if (meter) {
      const balance = await credits.getOrCreateBalance(tenantId);
      if (balance <= 0) throw new credits.InsufficientCreditsError(balance, 1);
    }
    const resp = await provider.toolChat({ model: spec.id, system, messages: convo, tools, maxTokens: maxTokens || spec.max_tokens_default, apiKey });
    if (meter) {
      const billed = Math.round(((resp.inputTokens || 0) + (resp.outputTokens || 0)) * spec.credit_multiplier);
      if (billed > 0) creditsUsed += await credits.deductCredits(tenantId, userId, billed, description, { allowOverdraft: true });
    }
    const blocks = Array.isArray(resp.content) ? resp.content : [];
    finalText = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const toolUses = blocks.filter((b) => b.type === 'tool_use');
    if (resp.stop_reason !== 'tool_use' || toolUses.length === 0) break;

    convo.push({ role: 'assistant', content: blocks });
    const results = [];
    for (const tu of toolUses) {
      let out;
      try { out = toolHandlers[tu.name] ? await toolHandlers[tu.name](tu.input || {}) : { error: `No handler for ${tu.name}` }; }
      catch (e) { out = { error: String(e.message) }; }
      toolCalls.push({ name: tu.name, input: tu.input || {}, result: out });
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: typeof out === 'string' ? out : JSON.stringify(out) });
    }
    convo.push({ role: 'user', content: results });
  }

  return { text: finalText, toolCalls, creditsUsed, model: spec.id };
}

module.exports = { chat, chatWithTools, PROVIDERS };
