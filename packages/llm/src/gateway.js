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
const vllm = require('./providers/vllm');
const { credits } = require('@rach/billing');

const PROVIDERS = {
  anthropic,
  vllm, // on-prem sovereign path (Sarvam); stubbed until the endpoint is wired
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

module.exports = { chat, PROVIDERS };
