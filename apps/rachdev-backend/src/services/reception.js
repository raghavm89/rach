'use strict';

/**
 * Asha — the Reception Intake agent.
 *
 * Turns a reception conversation (typed or dictated) into a structured patient
 * intake + concise triage summary via the shared @rach/llm gateway. Always a
 * DRAFT: reception (or a clinician) confirms before it's used. Mirrors the Scribe
 * service so both agents resolve model/persona/mock the same way.
 */

const { gateway } = require('@rach/llm');
const { AgentDefinition } = require('@rach/core');
const { getTenantModel } = require('./tenantLlm');
const { cleanupClinicalTranscript } = require('./transcriptCleanup');

const DEFAULT_PERSONA = `You are a reception intake assistant for a clinic. From a reception conversation, collect the patient's details and presenting complaint and draft a concise triage summary.

Rules:
- Use ONLY information present in the conversation. Never invent details. If something isn't stated, leave it blank or as an empty list.
- Do NOT give medical advice, diagnoses, or triage acuity beyond summarizing what was said.
- You draft; reception or a clinician confirms before it is used.`;

const OUTPUT_CONTRACT = `Return ONLY a JSON object (no markdown, no commentary) with exactly this shape:
{
  "patient": { "name": string, "age": string, "sex": string },
  "reason": string,
  "history": string,
  "medications": [ string ],
  "allergies": [ string ],
  "vitals": string,
  "triage_summary": string
}`;

const DEFAULT_SYSTEM_PROMPT = `${DEFAULT_PERSONA}\n\n${OUTPUT_CONTRACT}`;

function buildSystemPrompt(customPrompt) {
  const persona = (customPrompt && String(customPrompt).trim()) || DEFAULT_PERSONA;
  return persona.includes('"triage_summary"') ? persona : `${persona}\n\n${OUTPUT_CONTRACT}`;
}

function buildMockIntake(transcript) {
  const t = String(transcript || '').trim().slice(0, 200);
  return JSON.stringify({
    patient: { name: '', age: '', sex: '' },
    reason: t ? `Reason (from conversation): ${t}` : '',
    history: '',
    medications: [],
    allergies: [],
    vitals: '',
    triage_summary: 'Demonstration intake generated in mock mode — reception to confirm before use.',
  });
}

/** Normalize the model's JSON into a safe intake shape. @throws if unparseable. */
function parseIntake(text) {
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
  const p = obj.patient && typeof obj.patient === 'object' ? obj.patient : {};

  return {
    patient: { name: str(p.name), age: str(p.age), sex: str(p.sex) },
    reason: str(obj.reason),
    history: str(obj.history),
    medications: arr(obj.medications),
    allergies: arr(obj.allergies),
    vitals: str(obj.vitals),
    triage_summary: str(obj.triage_summary),
  };
}

/**
 * Generate a structured intake from a reception transcript.
 * @returns {Promise<{intake, model, totalTokens, creditsUsed}>}
 */
async function generateIntake({ tenantId, userId, transcript, patient = null }) {
  if (!transcript || !String(transcript).trim()) throw new Error('Transcript is required');

  // Correct ASR mishears (drug names, homophones) before structuring. Best-effort.
  const clean = await cleanupClinicalTranscript({ tenantId, userId, text: transcript, kind: 'reception intake' });

  let def = null;
  try { def = await AgentDefinition.findByKey(tenantId, 'reception'); } catch { /* optional */ }

  const system = buildSystemPrompt(def?.prompt);
  const model = (await getTenantModel(tenantId)) || def?.model || undefined;

  // If a patient is already attached, tell the model — so it uses those
  // demographics and does NOT report name/age/sex as "not yet collected".
  const known = patient && (patient.name || patient.age || patient.sex)
    ? `Known patient (already on record — treat name/age/sex as provided, never list them as missing): ${[patient.name, patient.age && `age ${patient.age}`, patient.sex && `sex ${patient.sex}`].filter(Boolean).join(', ')}.\n\n`
    : '';
  const baseMessages = [{ role: 'user', content: `${known}Reception conversation:\n${clean}` }];
  // Models occasionally answer in prose instead of JSON. Try once; if the output
  // can't be parsed, retry once with a hard JSON-only reminder before failing.
  const attempts = [
    baseMessages,
    [...baseMessages, { role: 'user', content: 'Your response must be ONLY the JSON object described in the system prompt — no explanation, no prose, starting with "{" and ending with "}".' }],
  ];

  let lastErr = null;
  for (const messages of attempts) {
    const result = await gateway.chat({
      tenantId, userId, model, system, messages,
      description: 'Reception: structure patient intake',
      mock: buildMockIntake(clean),
    });
    try {
      return {
        intake: parseIntake(result.text),
        model: result.model,
        totalTokens: result.totalTokens,
        creditsUsed: result.creditsUsed,
      };
    } catch (err) { lastErr = err; }
  }
  throw lastErr || new Error('Failed to structure intake');
}

module.exports = { buildSystemPrompt, parseIntake, generateIntake, DEFAULT_SYSTEM_PROMPT };
