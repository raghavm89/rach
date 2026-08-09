'use strict';

/**
 * Knowledge web-reference bypass (Ira) — the controlled escape hatch.
 *
 * Ira answers only from the approved library by default. This seam lets a doctor
 * pull EXTERNAL references when the library doesn't cover a topic. It is:
 *   • OFF by default (KNOWLEDGE_WEB_ENABLED) — air-gapped sites leave it off;
 *   • PHI-free — only the clinical question/topic is sent, never patient data;
 *   • clearly labelled as unverified/external and logged to the audit trail.
 *
 * When a real search provider is configured (KNOWLEDGE_WEB_URL/TOKEN), implement
 * `fetchProvider`. Without one, `search` returns clearly-labelled demonstration
 * references so the bypass is visible in the pitch without opening a live egress.
 */

const ENABLED = /^(1|true|yes)$/i.test(process.env.KNOWLEDGE_WEB_ENABLED || '');
const PROVIDER_URL = (process.env.KNOWLEDGE_WEB_URL || '').replace(/\/$/, '');
const PROVIDER_TOKEN = process.env.KNOWLEDGE_WEB_TOKEN || '';

function enabled() { return ENABLED; }
function liveProvider() { return Boolean(PROVIDER_URL && PROVIDER_TOKEN); }

async function fetchProvider(/* question */) {
  // TODO: call the approved external reference provider and normalize to
  // [{ title, url, snippet }]. Left unimplemented until a provider is chosen.
  throw new Error('Knowledge web provider is configured but not implemented in this adapter.');
}

function demoReferences(question) {
  const q = String(question || '').trim();
  return [
    { title: `Clinical reference overview — ${q.slice(0, 60)}`, url: 'https://example-medref.org/overview', snippet: 'Demonstration external reference. In production this is a real, approved medical reference source.' },
    { title: 'Guideline summary (external, unverified)', url: 'https://example-guidelines.org/summary', snippet: 'General guidance for clinician reference only — not specific to any patient and not from the approved library.' },
  ];
}

/**
 * @returns {Promise<{enabled:boolean, source:'web'|'web-demo'|'off', references:Array, note?:string}>}
 */
async function search(question) {
  if (!enabled()) {
    return { enabled: false, source: 'off', references: [], note: 'Web references are disabled for this hospital (air-gapped). An administrator can enable the controlled bypass.' };
  }
  if (liveProvider()) {
    const references = await fetchProvider(question);
    return { enabled: true, source: 'web', references };
  }
  return { enabled: true, source: 'web-demo', references: demoReferences(question), note: 'Demonstration references — external and unverified. No patient data was sent.' };
}

module.exports = { enabled, liveProvider, search };
