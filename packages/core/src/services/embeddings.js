'use strict';

/**
 * Text embeddings for semantic knowledge-base retrieval.
 *
 * Provider: OpenAI `text-embedding-3-small` (cheap, 1536-dim), keyed by
 * EMBEDDINGS_API_KEY (falls back to OPENAI_API_KEY). Embeddings are a platform
 * cost — not metered as agent credits. When no key is configured, `embed`
 * returns null and the knowledge base transparently falls back to keyword
 * (full-text) search. EMBEDDINGS_MOCK=1 yields deterministic local vectors so
 * the pipeline is exercisable without a provider.
 */

const crypto = require('crypto');

const MODEL = process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small';
const isMock = () => process.env.EMBEDDINGS_MOCK === '1' || process.env.EMBEDDINGS_MOCK === 'true';
const key = () => process.env.EMBEDDINGS_API_KEY || process.env.OPENAI_API_KEY || null;

/** Whether semantic embeddings are available in this environment. */
function enabled() {
  return isMock() || !!key();
}

// Deterministic, low-quality local vector (dev/CI only): hashed bag-of-tokens.
function mockVector(text) {
  const dim = 64;
  const v = new Array(dim).fill(0);
  for (const tok of String(text).toLowerCase().match(/[a-z0-9]+/g) || []) {
    const h = crypto.createHash('md5').update(tok).digest();
    v[h[0] % dim] += 1;
  }
  return v;
}

/**
 * Embed an array of strings → array of vectors (or null if embeddings are
 * disabled). Never throws for the disabled case; surfaces provider errors.
 */
async function embed(texts) {
  const input = (Array.isArray(texts) ? texts : [texts]).map((t) => String(t || ''));
  if (!enabled()) return null;
  if (isMock()) return input.map(mockVector);

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Embeddings error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j.data || []).sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Cosine similarity of two equal-length numeric vectors. */
function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

module.exports = { embed, cosine, enabled };
