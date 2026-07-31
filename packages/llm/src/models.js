'use strict';

/**
 * Model catalog. Single source of truth for which models are callable, which
 * provider serves them, and their credit multiplier.
 *
 * credit_multiplier closes the gap noted in the Agent Deployment Plan: today all
 * tokens cost the same regardless of model, which under-charges expensive models.
 * The gateway multiplies metered tokens by this factor before deducting credits.
 * The current default model keeps multiplier 1.0 so existing behavior is unchanged.
 */

const MODELS = {
  'claude-haiku-4-5-20251001': {
    provider: 'anthropic',
    label: 'Claude Haiku 4.5',
    credit_multiplier: 1.0,
    max_tokens_default: 1024,
  },
  // Examples of pricier models — enable per plan tier as needed.
  'claude-sonnet-5': {
    provider: 'anthropic',
    label: 'Claude Sonnet 5',
    credit_multiplier: 3.0,
    max_tokens_default: 2048,
  },
  'claude-opus-4-8': {
    provider: 'anthropic',
    label: 'Claude Opus 4.8',
    credit_multiplier: 8.0,
    max_tokens_default: 2048,
  },

  // ── On-prem sovereign models (served by vLLM inside the hospital) ──
  // Indian open models for the AFMS deployment; no data leaves the base.
  // credit_multiplier 0 = not metered (on-prem is licensed, not per-call billed).
  'sarvam-105b': {
    provider: 'vllm',
    label: 'Sarvam 105B (on-prem)',
    credit_multiplier: 0,
    max_tokens_default: 2048,
  },
  'sarvam-30b': {
    provider: 'vllm',
    label: 'Sarvam 30B (on-prem)',
    credit_multiplier: 0,
    max_tokens_default: 2048,
  },
};

// Deploy-profile switch: cloud POC defaults to Claude; an on-prem build sets
// LLM_DEFAULT_MODEL=sarvam-105b to route everything through the vLLM adapter.
const DEFAULT_MODEL = process.env.LLM_DEFAULT_MODEL || 'claude-haiku-4-5-20251001';

function resolveModel(model) {
  const id = model || DEFAULT_MODEL;
  const spec = MODELS[id];
  if (!spec) throw new Error(`Unknown or disallowed model: ${id}`);
  return { id, ...spec };
}

module.exports = { MODELS, DEFAULT_MODEL, resolveModel };
