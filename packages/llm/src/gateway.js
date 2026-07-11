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

const { resolveModel } = require('./models');
const anthropic = require('./providers/anthropic');
const { credits } = require('@rach/billing');

const PROVIDERS = {
  anthropic,
};

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
  system,
  messages,
  maxTokens,
  apiKey,
  description = 'LLM call',
  onText,
  meter = true,
}) {
  const spec = resolveModel(model);
  const provider = PROVIDERS[spec.provider];
  if (!provider) throw new Error(`No adapter for provider: ${spec.provider}`);

  const { text, inputTokens, outputTokens } = await provider.streamChat({
    model: spec.id,
    system,
    messages,
    maxTokens: maxTokens || spec.max_tokens_default,
    apiKey,
    onText,
  });

  const totalTokens = inputTokens + outputTokens;
  // Apply per-model credit multiplier (Haiku = 1.0 → unchanged from original).
  const billedTokens = Math.round(totalTokens * spec.credit_multiplier);

  let creditsUsed = 0;
  if (meter) {
    creditsUsed = await credits.deductCredits(tenantId, userId, billedTokens, description);
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
