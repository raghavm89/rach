'use strict';

/**
 * Kabir — discharge-summary drafting (the documentation half of Coordination).
 *
 * Turns a visit's signed notes into a structured discharge summary for clinician
 * sign-off. Mirrors the Scribe/Reception services: persona + strict JSON contract,
 * tenant model/persona resolution, and a mock for LLM_MOCK / offline demos.
 * The agent drafts; a clinician signs before it is final.
 */

const { gateway } = require('@rach/llm');
const { AgentDefinition } = require('@rach/core');
const { getTenantModel } = require('./tenantLlm');

const DEFAULT_PERSONA = `You are a clinical coordination assistant preparing a hospital discharge summary from a visit's documented notes.

Rules:
- Use ONLY the information provided. Never invent diagnoses, medications, or findings. If something isn't documented, leave it brief or empty.
- Write concise, clinical prose suitable for the patient's record and onward care.
- You draft; a licensed clinician reviews and signs before the summary is final.`;

const OUTPUT_CONTRACT = `Return ONLY a JSON object (no markdown, no commentary) with exactly this shape:
{
  "diagnosis": string,
  "hospital_course": string,
  "medications": [ string ],
  "follow_up": string,
  "advice": string
}`;

const DEFAULT_SYSTEM_PROMPT = `${DEFAULT_PERSONA}\n\n${OUTPUT_CONTRACT}`;

function buildSystemPrompt(customPrompt) {
  const persona = (customPrompt && String(customPrompt).trim()) || DEFAULT_PERSONA;
  return persona.includes('"hospital_course"') ? persona : `${persona}\n\n${OUTPUT_CONTRACT}`;
}

function buildMockSummary(context) {
  const t = String(context || '').trim().slice(0, 200);
  return JSON.stringify({
    diagnosis: 'See documented assessment (demonstration draft — mock mode).',
    hospital_course: t ? `Summary drafted from the visit notes: ${t}` : 'Course drafted from the visit notes.',
    medications: [],
    follow_up: 'Review in OPD as advised; return earlier if symptoms worsen.',
    advice: 'Clinician to review and sign before this summary is issued.',
  });
}

/** Normalize model JSON into a safe discharge shape. @throws if unparseable. */
function parseSummary(text) {
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
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : []);
  return {
    diagnosis: str(obj.diagnosis),
    hospital_course: str(obj.hospital_course),
    medications: arr(obj.medications),
    follow_up: str(obj.follow_up),
    advice: str(obj.advice),
  };
}

function notesToContext(notes) {
  return (notes || []).map((n) => {
    const s = n.soap || {};
    return [s.assessment ? `Assessment: ${s.assessment}` : '', s.plan ? `Plan: ${s.plan}` : ''].filter(Boolean).join('\n');
  }).filter(Boolean).join('\n---\n');
}

async function generateSummary({ tenantId, userId, notes, patient }) {
  const context = notesToContext(notes);
  if (!context.trim()) throw new Error('This visit has no signed notes to summarise');

  let def = null;
  try { def = await AgentDefinition.findByKey(tenantId, 'coordination'); } catch { /* optional */ }
  const system = buildSystemPrompt(def?.prompt);
  const model = (await getTenantModel(tenantId)) || def?.model || undefined;

  const who = patient ? `Patient: ${patient.name || ''}${patient.age ? `, ${patient.age}` : ''}${patient.sex ? `, ${patient.sex}` : ''}\n\n` : '';
  const result = await gateway.chat({
    tenantId, userId, model, system,
    messages: [{ role: 'user', content: `${who}Visit notes:\n${context}` }],
    description: 'Coordination: draft discharge summary',
    mock: buildMockSummary(context),
  });

  return { summary: parseSummary(result.text), model: result.model, totalTokens: result.totalTokens, creditsUsed: result.creditsUsed };
}

module.exports = { buildSystemPrompt, parseSummary, notesToContext, generateSummary, DEFAULT_SYSTEM_PROMPT };
