'use strict';

/**
 * @rach/llm — the LLM gateway shared by RachDev (agent builder) and RachBase
 * (deploy agent). All model calls funnel through here: provider abstraction,
 * model catalog with credit multipliers, and metering via @rach/billing.
 *
 *   const { gateway } = require('@rach/llm');
 *   const r = await gateway.chat({ tenantId, userId, system, messages, onText });
 *
 * Depends on @rach/billing (credits) and @anthropic-ai/sdk.
 */

const gateway = require('./src/gateway');
const models  = require('./src/models');

module.exports = {
  gateway,                 // { chat, PROVIDERS }
  chat: gateway.chat,      // convenience
  models,                  // { MODELS, DEFAULT_MODEL, resolveModel }
};
