'use strict';

const Anthropic = require('@anthropic-ai/sdk');

/**
 * Anthropic provider adapter.
 *
 * Faithful to the streaming + token-accounting used in the original
 * agentController.chat: text arrives via content_block_delta; input tokens from
 * message_start; output tokens from message_delta.
 *
 * Key resolution: pass an explicit apiKey (tenant BYOK) or fall back to the
 * platform key in ANTHROPIC_API_KEY.
 */
function makeClient(apiKey) {
  return new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
}

/**
 * @param {object}   opts
 * @param {string}   opts.model
 * @param {string}   opts.system
 * @param {Array}    opts.messages   [{ role, content }]
 * @param {number}   opts.maxTokens
 * @param {string}   [opts.apiKey]   BYOK; else platform key
 * @param {function} [opts.onText]   called with each streamed text delta
 * @returns {Promise<{ text: string, inputTokens: number, outputTokens: number }>}
 */
async function streamChat({ model, system, messages, maxTokens, apiKey, onText }) {
  const client = makeClient(apiKey);

  let text = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system,
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      const delta = event.delta.text;
      text += delta;
      if (onText) onText(delta);
    }
    if (event.type === 'message_start') {
      inputTokens = event.message?.usage?.input_tokens ?? 0;
    }
    if (event.type === 'message_delta') {
      outputTokens = event.usage?.output_tokens ?? 0;
    }
  }

  return { text, inputTokens, outputTokens };
}

/**
 * One tool-use turn (non-streaming). Passes tool definitions and returns the
 * raw content blocks (text + tool_use) plus stop_reason so the gateway can run
 * the call → tool_use → tool_result → final loop.
 * @returns {Promise<{ content: any[], stop_reason: string, inputTokens: number, outputTokens: number }>}
 */
async function toolChat({ model, system, messages, tools, maxTokens, apiKey }) {
  const client = makeClient(apiKey);
  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens || 1024,
    system,
    messages,
    ...(tools && tools.length ? { tools } : {}),
  });
  return {
    content: msg.content || [],
    stop_reason: msg.stop_reason,
    inputTokens: msg.usage?.input_tokens ?? 0,
    outputTokens: msg.usage?.output_tokens ?? 0,
  };
}

module.exports = { streamChat, toolChat };
