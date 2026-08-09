'use strict';

/**
 * Vihaan — the Triage & Safety agent.
 *
 * Turns a patient presentation (complaint + vitals) into an acuity assessment:
 * an acuity level, red-flag detection, a recommended route (ER / ICU / OPD /
 * specialist) and whether the on-call team should be paged. It ALWAYS recommends
 * only — a clinician acknowledges and decides. Mirrors the Scribe/Reception
 * services so model/persona/mock resolve identically.
 */

const { gateway } = require('@rach/llm');
const { AgentDefinition } = require('@rach/core');
const { getTenantModel } = require('./tenantLlm');

const ACUITY = ['critical', 'urgent', 'semi-urgent', 'routine'];
const ROUTES = ['ER', 'ICU', 'OPD', 'specialist'];

const DEFAULT_PERSONA = `You are a clinical triage assistant for a hospital. From a patient's presenting complaint and any vitals, assess acuity, detect red-flag / danger signs, recommend where the patient should be seen, and flag whether the on-call team should be paged.

Rules:
- Use ONLY the information provided. Never invent vitals, history, or findings. If key data is missing, say so in the rationale and lean toward caution.
- You are NOT making a diagnosis and NOT deciding treatment. You recommend acuity and routing; a clinician acknowledges and decides.
- Be decisive but safe: when in doubt, escalate acuity rather than under-triage.
- acuity_score is 1 (most acute / resuscitation) to 5 (least acute / routine).`;

const OUTPUT_CONTRACT = `Return ONLY a JSON object (no markdown, no commentary) with exactly this shape:
{
  "acuity": "critical" | "urgent" | "semi-urgent" | "routine",
  "acuity_score": 1,
  "red_flags": [ string ],
  "recommended_route": "ER" | "ICU" | "OPD" | "specialist",
  "page_on_call": true,
  "rationale": string,
  "disposition": string
}`;

const DEFAULT_SYSTEM_PROMPT = `${DEFAULT_PERSONA}\n\n${OUTPUT_CONTRACT}`;

function buildSystemPrompt(customPrompt) {
  const persona = (customPrompt && String(customPrompt).trim()) || DEFAULT_PERSONA;
  return persona.includes('"acuity"') ? persona : `${persona}\n\n${OUTPUT_CONTRACT}`;
}

function buildMockTriage(presentation) {
  const t = String(presentation || '').trim().slice(0, 160);
  return JSON.stringify({
    acuity: 'semi-urgent',
    acuity_score: 3,
    red_flags: [],
    recommended_route: 'OPD',
    page_on_call: false,
    rationale: `Demonstration triage generated in mock mode from: "${t}". A clinician must review and decide.`,
    disposition: 'Route to OPD for clinician review; re-triage if new red-flag symptoms appear.',
  });
}

/** Normalize model JSON into a safe triage shape. @throws if unparseable. */
function parseTriage(text) {
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
  const acuity = ACUITY.includes(obj.acuity) ? obj.acuity : 'routine';
  let score = Number(obj.acuity_score);
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    score = { critical: 1, urgent: 2, 'semi-urgent': 3, routine: 4 }[acuity] ?? 4;
  }
  const route = ROUTES.includes(obj.recommended_route) ? obj.recommended_route : 'OPD';

  return {
    acuity,
    acuity_score: Math.round(score),
    red_flags: arr(obj.red_flags),
    recommended_route: route,
    page_on_call: Boolean(obj.page_on_call),
    rationale: str(obj.rationale),
    disposition: str(obj.disposition),
  };
}

async function generateTriage({ tenantId, userId, presentation, vitals }) {
  if (!presentation || !String(presentation).trim()) throw new Error('Presentation is required');

  let def = null;
  try { def = await AgentDefinition.findByKey(tenantId, 'triage'); } catch { /* optional */ }

  const system = buildSystemPrompt(def?.prompt);
  const model = (await getTenantModel(tenantId)) || def?.model || undefined;
  const userMsg = `Presenting complaint:\n${presentation}` + (vitals && String(vitals).trim() ? `\n\nVitals:\n${vitals}` : '');

  const result = await gateway.chat({
    tenantId, userId, model, system,
    messages: [{ role: 'user', content: userMsg }],
    description: 'Triage: assess acuity & routing',
    mock: buildMockTriage(presentation),
  });

  return {
    triage: parseTriage(result.text),
    model: result.model,
    totalTokens: result.totalTokens,
    creditsUsed: result.creditsUsed,
  };
}

module.exports = { buildSystemPrompt, parseTriage, generateTriage, DEFAULT_SYSTEM_PROMPT, ACUITY, ROUTES };
