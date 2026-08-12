'use strict';

const { Settings, Integration } = require('@rach/core');
const { models } = require('@rach/llm');

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini'];

// The Claude models offered as explicit picks (subset of the llm catalog).
const CLAUDE_PICKS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
];

async function tenantKeys(tenantId) {
  if (tenantId == null) return { anthropic: null, openai: null };
  const [an, oa] = await Promise.all([
    Integration.getCredentials(tenantId, 'anthropic').catch(() => null),
    Integration.getCredentials(tenantId, 'openai').catch(() => null),
  ]);
  return {
    anthropic: an && an.credentials && an.credentials.api_key ? an.credentials.api_key : null,
    openai: oa && oa.credentials ? oa.credentials : null,
  };
}

/**
 * Models a tenant can pick for an agent/specialist. Claude is always available
 * (on the platform key + credits, or on the tenant's Anthropic key with no
 * credit charge); OpenAI models appear only when the tenant connected an OpenAI
 * key. `billed` tells the UI whether picking it consumes credits.
 */
async function availableModels(tenantId) {
  const keys = await tenantKeys(tenantId);
  const byokAnthropic = !!keys.anthropic;
  const byokOpenai = !!(keys.openai && keys.openai.api_key);
  const autoLabel = byokOpenai ? 'Auto — your OpenAI key' : byokAnthropic ? 'Auto — your Anthropic key' : 'Auto — platform (credits)';
  const list = [{ id: 'auto', label: autoLabel, provider: 'auto', billed: !(byokOpenai || byokAnthropic) }];
  for (const c of CLAUDE_PICKS) list.push({ id: c.id, label: byokAnthropic ? `${c.label} (your key)` : c.label, provider: 'anthropic', billed: !byokAnthropic });
  if (byokOpenai) {
    list.push({ id: 'gpt-4o-mini', label: 'GPT-4o mini (your key)', provider: 'openai', billed: false });
    list.push({ id: 'gpt-4o', label: 'GPT-4o (your key)', provider: 'openai', billed: false });
  }
  return list;
}

/**
 * Resolve a specific model choice → { model, apiKey, meter, provider } for a run.
 * `null`/'auto' → the workspace default (getTenantLlm precedence). A pinned model
 * routes to its provider: Anthropic on the tenant key (unbilled) or platform
 * (billed); OpenAI on the tenant key (unbilled), falling back to the workspace
 * default if no OpenAI key is connected.
 */
async function resolveModelRun(tenantId, modelId) {
  if (!modelId || modelId === 'auto') return getTenantLlm(tenantId);
  let provider;
  try { provider = models.resolveModel(modelId).provider; }
  catch { return getTenantLlm(tenantId); } // unknown id → safe default
  const keys = await tenantKeys(tenantId);
  if (provider === 'openai') {
    if (!keys.openai || !keys.openai.api_key) return getTenantLlm(tenantId);
    return { apiKey: keys.openai.api_key, model: modelId, meter: false, provider: 'openai' };
  }
  // anthropic (or anything else served by the platform)
  return { apiKey: keys.anthropic || undefined, model: modelId, meter: !keys.anthropic, provider };
}

/**
 * Bring-your-own-key resolution for a tenant's agent/team runs.
 * If the tenant connected an LLM key under Connections, their runs use that key
 * and are NOT billed in credits (meter:false) — they pay the provider directly.
 * OpenAI wins over Anthropic if both are connected. Otherwise the platform key +
 * credits are used (meter:true).
 * @returns {Promise<{ apiKey?: string, model: string|null, meter: boolean, provider: string }>}
 */
async function getTenantLlm(tenantId) {
  const platform = { apiKey: undefined, model: null, meter: true, provider: 'platform' };
  if (tenantId == null) return platform;
  try {
    const oa = await Integration.getCredentials(tenantId, 'openai');
    if (oa && oa.credentials && oa.credentials.api_key) {
      const wanted = String(oa.credentials.model || '').trim();
      const model = OPENAI_MODELS.includes(wanted) ? wanted : 'gpt-4o-mini';
      return { apiKey: oa.credentials.api_key, model, meter: false, provider: 'openai' };
    }
    const an = await Integration.getCredentials(tenantId, 'anthropic');
    if (an && an.credentials && an.credentials.api_key) {
      return { apiKey: an.credentials.api_key, model: null, meter: false, provider: 'anthropic' };
    }
  } catch { /* fall through to platform */ }
  return platform;
}

/**
 * The model an org's agents should run on, set by a platform admin
 * (tenant_settings key 'llm' → { model }). A Claude catalog id or an on-prem
 * model (e.g. 'sarvam-105b'). null = use the platform/environment default.
 */
async function getTenantModel(tenantId) {
  if (tenantId == null) return null;
  try {
    const v = await Settings.get(tenantId, 'llm');
    return (v && v.model) || null;
  } catch {
    return null;
  }
}

// Spread into a gateway.chat/chatWithTools call to apply BYOK: overrides model
// only when the provider requires it (OpenAI), always sets apiKey + meter.
function llmOpts(llm) {
  return { apiKey: llm.apiKey, meter: llm.meter, ...(llm.model ? { model: llm.model } : {}) };
}

module.exports = { getTenantModel, getTenantLlm, llmOpts, availableModels, resolveModelRun };
