'use strict';

/**
 * OpenAI provider adapter (BYOK).
 *
 * Speaks the SAME Anthropic-shaped interface the gateway expects, so it drops
 * into gateway.chat / chatWithTools unchanged:
 *   - incoming `messages` are in Anthropic block form (assistant tool_use blocks,
 *     user tool_result blocks); we translate to OpenAI chat-completions format.
 *   - the response is translated BACK to Anthropic shape ({content:[{type:'text'|
 *     'tool_use'}], stop_reason}) so the tool loop in the gateway works as-is.
 *
 * Key resolution: explicit apiKey (tenant BYOK) or platform OPENAI_API_KEY.
 * Uses fetch (no SDK dependency).
 */

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const safeJson = (s) => { try { return JSON.parse(s); } catch { return {}; } };

// Anthropic-shaped convo → OpenAI messages.
function toOpenAIMessages(system, messages) {
  const out = [];
  if (system) out.push({ role: 'system', content: system });
  for (const m of (messages || [])) {
    const content = m.content;
    if (typeof content === 'string') { out.push({ role: m.role, content }); continue; }
    if (!Array.isArray(content)) { out.push({ role: m.role, content: String(content ?? '') }); continue; }

    if (m.role === 'assistant') {
      const text = content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      const toolCalls = content.filter((b) => b.type === 'tool_use').map((b) => ({
        id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
      }));
      out.push({ role: 'assistant', content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });
    } else {
      // user turn: tool_result blocks become individual `tool` messages.
      const results = content.filter((b) => b.type === 'tool_result');
      if (results.length) {
        for (const r of results) out.push({ role: 'tool', tool_call_id: r.tool_use_id, content: typeof r.content === 'string' ? r.content : JSON.stringify(r.content) });
      } else {
        const text = content.filter((b) => b.type === 'text').map((b) => b.text).join('');
        out.push({ role: 'user', content: text });
      }
    }
  }
  return out;
}

async function call({ model, system, messages, tools, maxTokens, apiKey }) {
  const body = {
    model,
    messages: toOpenAIMessages(system, messages),
    max_tokens: maxTokens || 1024,
    ...(tools && tools.length ? {
      tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })),
      tool_choice: 'auto',
    } : {}),
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey || process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function streamChat({ model, system, messages, maxTokens, apiKey, onText }) {
  const data = await call({ model, system, messages, maxTokens, apiKey });
  const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  if (onText && text) onText(text);
  return {
    text,
    inputTokens: (data.usage && data.usage.prompt_tokens) || 0,
    outputTokens: (data.usage && data.usage.completion_tokens) || 0,
  };
}

// One tool-use turn → Anthropic-shaped response.
async function toolChat({ model, system, messages, tools, maxTokens, apiKey }) {
  const data = await call({ model, system, messages, tools, maxTokens, apiKey });
  const choice = (data.choices && data.choices[0]) || {};
  const m = choice.message || {};
  const content = [];
  if (m.content) content.push({ type: 'text', text: m.content });
  for (const tc of (m.tool_calls || [])) {
    content.push({ type: 'tool_use', id: tc.id, name: tc.function && tc.function.name, input: safeJson(tc.function && tc.function.arguments) });
  }
  return {
    content,
    stop_reason: choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
    inputTokens: (data.usage && data.usage.prompt_tokens) || 0,
    outputTokens: (data.usage && data.usage.completion_tokens) || 0,
  };
}

module.exports = { streamChat, toolChat, toOpenAIMessages };
