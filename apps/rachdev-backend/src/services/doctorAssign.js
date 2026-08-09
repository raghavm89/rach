'use strict';

/**
 * AI doctor assignment for the OPD queue.
 *
 * Given a visit's department and the current roster of doctors (with their
 * department and today's active load), pick the best available doctor. The LLM
 * makes the final call with a short rationale; a deterministic least-loaded
 * fallback is used in mock mode or if the model returns anything unusable, so
 * assignment always succeeds.
 */

const { gateway } = require('@rach/llm');
const { AgentDefinition } = require('@rach/core');
const { getTenantModel } = require('./tenantLlm');

const DEFAULT_PERSONA = `You are a hospital OPD coordinator assigning the most suitable doctor to a patient visit.
Choose from the provided candidates only. Prefer a doctor whose department matches the visit's
department, then the one with the lightest current patient load so waits stay balanced. Never invent
a doctor or an id that is not in the list.`;

const OUTPUT_CONTRACT = `Return ONLY a JSON object (no markdown, no commentary) with exactly this shape:
{ "doctor_id": number, "rationale": string }`;

function buildSystemPrompt(customPrompt) {
  const persona = (customPrompt && String(customPrompt).trim()) || DEFAULT_PERSONA;
  return persona.includes('"doctor_id"') ? persona : `${persona}\n\n${OUTPUT_CONTRACT}`;
}

/** Department match (case-insensitive, trimmed). A profile-less doctor matches anything. */
function inDepartment(candidate, department) {
  if (!department) return true;
  if (!candidate.department) return true;
  return String(candidate.department).trim().toLowerCase() === String(department).trim().toLowerCase();
}

/** Deterministic pick: department match first, then lightest load, then lowest id. */
function leastLoaded(candidates, department) {
  const pool = candidates.filter((c) => inDepartment(c, department));
  const list = pool.length ? pool : candidates;
  return [...list].sort((a, b) =>
    (a.active_load - b.active_load) || (a.id - b.id)
  )[0] || null;
}

/** Parse the model's choice; validate the id is a real candidate, else fall back. */
function parsePick(text, candidates, department) {
  const fallback = leastLoaded(candidates, department);
  if (typeof text !== 'string' || !text.trim()) return fallback ? { doctor_id: fallback.id, rationale: 'Least-loaded available doctor.' } : null;
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) raw = raw.slice(start, end + 1);
  let obj = null;
  try { obj = JSON.parse(raw); } catch { obj = null; }
  const id = obj && Number(obj.doctor_id);
  const chosen = candidates.find((c) => c.id === id);
  if (!chosen) return fallback ? { doctor_id: fallback.id, rationale: 'Least-loaded available doctor.' } : null;
  const rationale = obj && typeof obj.rationale === 'string' && obj.rationale.trim()
    ? obj.rationale.trim()
    : 'Best match for the department with the lightest load.';
  return { doctor_id: chosen.id, rationale };
}

/**
 * Pick the best doctor for a visit.
 * @param {object} p
 * @param {number} p.tenantId
 * @param {number} p.userId
 * @param {string|null} p.department
 * @param {Array<{id:number,name:string,department:string|null,active_load:number}>} p.candidates
 * @returns {Promise<{doctor_id:number, doctor_name:string, rationale:string, model?:string}|null>}
 */
async function pickDoctor({ tenantId, userId, department, candidates }) {
  if (!Array.isArray(candidates) || !candidates.length) return null;

  let def = null;
  try { def = await AgentDefinition.findByKey(tenantId, 'reception'); } catch { /* optional */ }
  const system = buildSystemPrompt(def?.prompt && def.prompt.includes('"doctor_id"') ? def.prompt : undefined);
  const model = (await getTenantModel(tenantId)) || def?.model || undefined;

  const roster = candidates
    .map((c) => `- id ${c.id}: ${c.name}${c.department ? ` · ${c.department}` : ' · (no dept)'} · active load ${c.active_load}`)
    .join('\n');
  const mockChoice = leastLoaded(candidates, department);
  const mock = JSON.stringify({ doctor_id: mockChoice ? mockChoice.id : candidates[0].id, rationale: 'Auto-assigned to the least-loaded available doctor (mock).' });

  const result = await gateway.chat({
    tenantId,
    userId,
    model,
    system,
    messages: [{ role: 'user', content: `Visit department: ${department || '(unspecified)'}\n\nAvailable doctors:\n${roster}\n\nPick the best doctor id.` }],
    description: 'Reception: assign best available doctor',
    mock,
  });

  const pick = parsePick(result.text, candidates, department);
  if (!pick) return null;
  const doc = candidates.find((c) => c.id === pick.doctor_id);
  return { doctor_id: pick.doctor_id, doctor_name: doc ? doc.name : null, rationale: pick.rationale, model: result.model };
}

module.exports = { buildSystemPrompt, inDepartment, leastLoaded, parsePick, pickDoctor };
