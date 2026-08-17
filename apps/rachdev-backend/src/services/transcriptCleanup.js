'use strict';

/**
 * Clinical transcript cleanup — a pre-pass over speech-to-text output.
 *
 * Browser/most STT engines have no medical vocabulary, so they mishear drug
 * names, dosages, and near-homophones ("describe" ↔ "prescribe", "hypertension"
 * ↔ "hypotension"). This runs a tight LLM pass that ONLY corrects likely
 * transcription errors — it must not add, remove, summarize, or translate — then
 * the normal structuring step runs on the cleaned text.
 *
 * Best-effort: on any error, or in LLM_MOCK mode, the original text is returned
 * unchanged so the flow never breaks. Toggle off with TRANSCRIPT_CLEANUP=0.
 */

const { gateway } = require('@rach/llm');

const enabled = () => process.env.TRANSCRIPT_CLEANUP !== '0' && process.env.TRANSCRIPT_CLEANUP !== 'false';
const mockOn = () => process.env.LLM_MOCK === '1' || process.env.LLM_MOCK === 'true';

const SYSTEM = (kind) =>
  `You clean up speech-to-text (ASR) output from an Indian hospital ${kind}. Fix ONLY likely transcription errors: misheard medical terms, drug names, dosages and units, and near-homophones (e.g. "describe"→"prescribe", "hypertension"↔"hypotension", "ilium"↔"ilium", numbers like "fifty"↔"fifteen" when context makes it clear).\n\nStrict rules:\n- Do NOT add, remove, summarize, re-order, or invent any information.\n- Do NOT translate — keep the original language (English, Hindi, Punjabi, or mixed) and script.\n- Keep names, IDs and numbers you are not confident about exactly as-is.\n- Preserve meaning and speaker intent.\nReturn ONLY the corrected transcript text — no preamble, no notes, no quotes.`;

/**
 * @param {object} o
 * @param {number} o.tenantId
 * @param {number} [o.userId]
 * @param {string} o.text        raw ASR transcript
 * @param {string} [o.kind]      'reception intake' | 'consultation' | …
 * @returns {Promise<string>}    corrected transcript (or the original)
 */
async function cleanupClinicalTranscript({ tenantId, userId = null, text, kind = 'intake' }) {
  const raw = String(text || '').trim();
  if (!raw || !enabled() || mockOn()) return raw;
  try {
    const res = await gateway.chat({
      tenantId, userId,
      system: SYSTEM(kind),
      messages: [{ role: 'user', content: raw }],
      description: `Transcript cleanup (${kind})`,
      maxTokens: 1200,
    });
    const out = String(res.text || '').trim();
    // Guard against a model that "helpfully" collapses everything — if it returns
    // almost nothing for a substantial transcript, keep the original.
    if (out && out.length >= Math.min(12, Math.floor(raw.length * 0.4))) return out;
    return raw;
  } catch {
    return raw;
  }
}

module.exports = { cleanupClinicalTranscript };
