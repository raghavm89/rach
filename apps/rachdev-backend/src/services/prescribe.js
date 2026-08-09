'use strict';

/**
 * Naina — e-prescription drafting.
 *
 * Turns a visit transcript / plan into a structured medication list (drug,
 * strength, dose, frequency, route, duration, quantity, instructions) for the
 * clinician to review, edit and sign. Uses ONLY what the transcript supports —
 * it does not invent therapy. Interaction screening is a separate deterministic
 * step (services/interactions.js). Mirrors the Scribe service pattern.
 */

const { gateway } = require('@rach/llm');
const { AgentDefinition } = require('@rach/core');
const { getTenantModel } = require('./tenantLlm');

const DEFAULT_PERSONA = `You are a clinical prescribing assistant. From a doctor–patient visit transcript (and any plan), extract the medications the clinician intends to prescribe as a structured list.

Rules:
- Use ONLY medications supported by the transcript/plan. Never invent a drug, dose, or duration. If a field isn't stated, leave it blank.
- Do not add prophylaxis or "typical" therapy that wasn't mentioned.
- You draft; a licensed clinician reviews, adjusts and signs. This is not medical advice.`;

const OUTPUT_CONTRACT = `Return ONLY a JSON object (no markdown, no commentary) with exactly this shape:
{
  "medications": [
    { "drug": string, "strength": string, "dose": string, "frequency": string, "route": string, "duration": string, "quantity": string, "instructions": string }
  ]
}`;

const DEFAULT_SYSTEM_PROMPT = `${DEFAULT_PERSONA}\n\n${OUTPUT_CONTRACT}`;

function buildSystemPrompt(customPrompt) {
  const persona = (customPrompt && String(customPrompt).trim()) || DEFAULT_PERSONA;
  return persona.includes('"medications"') ? persona : `${persona}\n\n${OUTPUT_CONTRACT}`;
}

function buildMockRx(transcript) {
  const t = String(transcript || '').toLowerCase();
  const meds = [];
  if (/parac|dolo|fever|pain/.test(t)) meds.push({ drug: 'Paracetamol', strength: '500 mg', dose: '1 tab', frequency: 'TDS', route: 'PO', duration: '3 days', quantity: '9', instructions: 'After food' });
  return JSON.stringify({ medications: meds });
}

const FIELDS = ['drug', 'strength', 'dose', 'frequency', 'route', 'duration', 'quantity', 'instructions'];

/** Normalize model JSON into a safe medication list. @throws if unparseable. */
function parseRx(text) {
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
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const meds = Array.isArray(obj.medications) ? obj.medications : [];
  return meds
    .filter((m) => m && (m.drug || m.instructions))
    .map((m) => { const o = {}; for (const f of FIELDS) o[f] = str(m[f]); return o; })
    .filter((m) => m.drug);
}

async function generateRx({ tenantId, userId, transcript, plan }) {
  const src = [transcript, plan].filter(Boolean).join('\n\nPlan:\n');
  if (!src.trim()) throw new Error('A transcript or plan is required to draft a prescription');

  let def = null;
  try { def = await AgentDefinition.findByKey(tenantId, 'scribe'); } catch { /* optional */ }
  const system = buildSystemPrompt(def?.prompt && def.prompt.includes('"medications"') ? def.prompt : undefined);
  const model = (await getTenantModel(tenantId)) || def?.model || undefined;

  const result = await gateway.chat({
    tenantId, userId, model, system,
    messages: [{ role: 'user', content: `Transcript / plan:\n${src}` }],
    description: 'Scribe: draft e-prescription',
    mock: buildMockRx(transcript),
  });

  return { medications: parseRx(result.text), model: result.model, totalTokens: result.totalTokens, creditsUsed: result.creditsUsed };
}

module.exports = { buildSystemPrompt, parseRx, generateRx, DEFAULT_SYSTEM_PROMPT, FIELDS };
