'use strict';

/**
 * Ira — the Knowledge agent.
 *
 * Answers questions for patients, doctors and staff STRICTLY from the hospital's
 * approved reference library (knowledge_docs), always citing the sources it used,
 * and never diagnosing or recommending treatment. If the approved content does
 * not cover the question, it says so rather than guessing.
 *
 * Retrieval here is deliberately simple (keyword overlap) — enough for the POC and
 * swappable for embeddings later without changing the agent contract.
 */

const { gateway } = require('@rach/llm');
const { AgentDefinition } = require('@rach/core');
const { getTenantModel } = require('./tenantLlm');

const DEFAULT_PERSONA = `You are a hospital knowledge assistant. Answer the user's question using ONLY the approved reference sources provided to you.

Rules:
- Use ONLY the provided sources. If they do not contain the answer, set can_answer to false and explain that the approved library does not cover it — never answer from outside knowledge.
- NEVER diagnose, interpret a specific patient's results, or recommend treatment for an individual. You provide general, source-backed information only. If asked for a diagnosis or personal medical advice, decline and suggest consulting a clinician.
- Cite the sources you used by their exact title.
- Be concise and factual.`;

const OUTPUT_CONTRACT = `Return ONLY a JSON object (no markdown, no commentary) with exactly this shape:
{
  "answer": string,
  "citations": [ { "title": string, "ref": string } ],
  "can_answer": true
}`;

const DEFAULT_SYSTEM_PROMPT = `${DEFAULT_PERSONA}\n\n${OUTPUT_CONTRACT}`;

function buildSystemPrompt(customPrompt) {
  const persona = (customPrompt && String(customPrompt).trim()) || DEFAULT_PERSONA;
  return persona.includes('"can_answer"') ? persona : `${persona}\n\n${OUTPUT_CONTRACT}`;
}

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'what', 'how', 'why', 'when', 'do', 'does', 'can', 'i', 'my', 'with', 'at', 'be', 'it']);

/** Rank the approved docs by keyword overlap with the question. Returns top N. */
function retrieve(question, docs, n = 4) {
  const terms = String(question || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  const keys = terms.filter((t) => t.length > 2 && !STOP.has(t));
  const scored = docs.map((d) => {
    const hay = `${d.title} ${d.body}`.toLowerCase();
    const score = keys.reduce((s, k) => s + (hay.includes(k) ? 1 : 0), 0);
    return { d, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return (scored.length ? scored : docs.map((d) => ({ d, score: 0 }))).slice(0, n).map((x) => x.d);
}

function buildMockAnswer(sources) {
  if (!sources.length) {
    return JSON.stringify({ answer: 'The approved reference library does not contain information on this topic. Please consult a clinician or add a source.', citations: [], can_answer: false });
  }
  const s = sources[0];
  return JSON.stringify({
    answer: `Based on the approved sources, here is a general, source-backed summary (demonstration / mock mode). See the cited source for details. This is general information only — not a diagnosis.`,
    citations: sources.slice(0, 2).map((d) => ({ title: d.title, ref: d.citation || '' })),
    can_answer: true,
  });
}

/** Normalize the model's JSON into a safe answer shape. @throws if unparseable. */
function parseAnswer(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Empty model response');
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  if (raw[0] !== '{') {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found in model response');
    raw = raw.slice(start, end + 1);
  }
  let obj;
  try { obj = JSON.parse(raw); } catch { throw new Error('Model response was not valid JSON'); }
  const str = (v) => (typeof v === 'string' ? v : '');
  const citations = Array.isArray(obj.citations)
    ? obj.citations.filter((c) => c && c.title).map((c) => ({ title: str(c.title), ref: str(c.ref) }))
    : [];
  return { answer: str(obj.answer), citations, can_answer: obj.can_answer !== false };
}

/**
 * Answer a question grounded in the tenant's approved docs.
 * @returns {Promise<{answer, citations, can_answer, used, model}>}
 */
async function generateAnswer({ tenantId, userId, question, docs }) {
  if (!question || !String(question).trim()) throw new Error('Question is required');
  const used = retrieve(question, docs || []);

  // No approved content at all → deterministic, honest refusal (no model call).
  if (!used.length) {
    return { answer: 'The approved reference library is empty or does not cover this question. Please add a source or consult a clinician.', citations: [], can_answer: false, used: [], model: null };
  }

  let def = null;
  try { def = await AgentDefinition.findByKey(tenantId, 'knowledge'); } catch { /* optional */ }
  const system = buildSystemPrompt(def?.prompt);
  const model = (await getTenantModel(tenantId)) || def?.model || undefined;

  const sourceBlock = used.map((d, i) => `[Source ${i + 1}] ${d.title}${d.citation ? ` (${d.citation})` : ''}\n${d.body}`).join('\n\n');
  const result = await gateway.chat({
    tenantId, userId, model, system,
    messages: [{ role: 'user', content: `Approved sources:\n${sourceBlock}\n\nQuestion: ${question}` }],
    description: 'Knowledge: grounded answer',
    mock: buildMockAnswer(used),
  });

  const parsed = parseAnswer(result.text);
  return { ...parsed, used: used.map((d) => ({ id: d.id, title: d.title, citation: d.citation })), model: result.model };
}

module.exports = { buildSystemPrompt, parseAnswer, retrieve, generateAnswer, DEFAULT_SYSTEM_PROMPT };
