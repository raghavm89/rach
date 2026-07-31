'use strict';

/**
 * vLLM provider adapter (on-prem gateway) — the sovereign / air-gapped path.
 *
 * In production this talks to a vLLM OpenAI-compatible endpoint serving Indian
 * open models (Sarvam) inside the hospital, so no data leaves the base. It is
 * intentionally NOT wired in the POC build (which runs on Claude); calling it
 * throws a clear error until the on-prem endpoint is implemented.
 *
 * Signature matches providers/anthropic.js so the gateway can dispatch to it
 * with no gateway-side special-casing.
 *
 * @returns {Promise<{ text: string, inputTokens: number, outputTokens: number }>}
 */
async function streamChat(/* { model, system, messages, maxTokens, apiKey, onText } */) {
  throw new Error(
    'vLLM provider is not wired in the POC build. ' +
    'Production serves Sarvam via a vLLM OpenAI-compatible endpoint on-prem ' +
    '(set VLLM_BASE_URL and implement this adapter). See docs/healthcare/phase1-ai-architecture.md §4/§6a.'
  );
}

module.exports = { streamChat };
