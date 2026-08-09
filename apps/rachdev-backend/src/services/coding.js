'use strict';

/**
 * Rhea — the Coding & Revenue agent.
 *
 * From a signed clinical note it produces a submittable claim: confirmed ICD-10 /
 * CPT codes, charge line items, a total, and a denial-risk screen with reasons —
 * tuned for AFMS payers (ECHS) and field/altitude diagnoses. The agent drafts and
 * screens; a coder reviews and submits. Amounts are indicative until verified
 * against the hospital's fee schedule.
 */

const { gateway } = require('@rach/llm');
const { AgentDefinition } = require('@rach/core');
const { getTenantModel } = require('./tenantLlm');

const RISK = ['low', 'medium', 'high'];

const DEFAULT_PERSONA = `You are a medical coding and revenue-integrity assistant for an Armed Forces (AFMS) hospital. From a signed clinical note, produce a submittable claim.

Rules:
- Assign ICD-10-CM diagnosis codes and CPT/procedure codes supported by the documentation. Prefer specific codes; flag anything unspecified. For altitude/field conditions use the correct codes (e.g. HAPO/altitude illness J70.-, frostbite T33–T34).
- Produce charge line items with INDICATIVE amounts in INR — the coder verifies against the fee schedule.
- Screen for denial risk for the given payer (ECHS/CGHS/TPA): unspecified codes, code–documentation mismatch, missing pre-authorisation, or eligibility gaps. Return risk low/medium/high with concrete reasons.
- Use ONLY the documentation provided. Do not invent findings. You draft and screen; a human confirms before submission.`;

const OUTPUT_CONTRACT = `Return ONLY a JSON object (no markdown, no commentary) with exactly this shape:
{
  "codes": [ { "system": "ICD-10-CM" | "CPT", "code": string, "description": string } ],
  "charges": [ { "code": string, "description": string, "amount": number } ],
  "denial_risk": "low" | "medium" | "high",
  "denial_reasons": [ string ],
  "notes": string
}`;

const DEFAULT_SYSTEM_PROMPT = `${DEFAULT_PERSONA}\n\n${OUTPUT_CONTRACT}`;

function buildSystemPrompt(customPrompt) {
  const persona = (customPrompt && String(customPrompt).trim()) || DEFAULT_PERSONA;
  return persona.includes('"denial_risk"') ? persona : `${persona}\n\n${OUTPUT_CONTRACT}`;
}

function buildMockClaim() {
  return JSON.stringify({
    codes: [
      { system: 'ICD-10-CM', code: 'J70.2', description: 'Acute drug-induced interstitial lung disorders / altitude (demo)' },
      { system: 'CPT', code: '99223', description: 'Initial hospital care, high complexity' },
    ],
    charges: [
      { code: '99223', description: 'Initial hospital care', amount: 2500 },
      { code: 'O2', description: 'Supplemental oxygen therapy', amount: 800 },
    ],
    denial_risk: 'low',
    denial_reasons: [],
    notes: 'Demonstration claim generated in mock mode — verify codes and amounts before submission.',
  });
}

/** Normalize model JSON into a safe claim shape + computed total. @throws if unparseable. */
function parseClaim(text) {
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
  const codes = Array.isArray(obj.codes)
    ? obj.codes.filter((c) => c && (c.code || c.description)).map((c) => ({
        system: str(c.system) || 'ICD-10-CM', code: str(c.code), description: str(c.description),
      }))
    : [];
  const charges = Array.isArray(obj.charges)
    ? obj.charges.filter((c) => c && (c.code || c.description)).map((c) => {
        const amount = Number(c.amount);
        return { code: str(c.code), description: str(c.description), amount: Number.isFinite(amount) && amount >= 0 ? amount : 0 };
      })
    : [];
  const total = charges.reduce((s, c) => s + (c.amount || 0), 0);
  const denial_risk = RISK.includes(obj.denial_risk) ? obj.denial_risk : 'low';
  const denial_reasons = Array.isArray(obj.denial_reasons)
    ? obj.denial_reasons.filter((r) => typeof r === 'string' && r.trim()).map((r) => r.trim()) : [];

  return { codes, charges, total, denial_risk, denial_reasons, notes: str(obj.notes) };
}

function noteToText(note) {
  if (!note) return '';
  const s = note.soap || {};
  const codes = Array.isArray(note.codes) && note.codes.length
    ? `\nExisting suggested codes: ${note.codes.map((c) => `${c.code} (${c.system})`).join(', ')}` : '';
  return [
    s.subjective ? `Subjective: ${s.subjective}` : '',
    s.objective ? `Objective: ${s.objective}` : '',
    s.assessment ? `Assessment: ${s.assessment}` : '',
    s.plan ? `Plan: ${s.plan}` : '',
  ].filter(Boolean).join('\n') + codes;
}

async function generateClaim({ tenantId, userId, note, payer }) {
  const noteText = noteToText(note);
  if (!noteText.trim()) throw new Error('A documented note is required to code a claim');

  let def = null;
  try { def = await AgentDefinition.findByKey(tenantId, 'coding'); } catch { /* optional */ }
  const system = buildSystemPrompt(def?.prompt);
  const model = (await getTenantModel(tenantId)) || def?.model || undefined;

  const result = await gateway.chat({
    tenantId, userId, model, system,
    messages: [{ role: 'user', content: `Payer: ${payer || 'ECHS'}\n\nSigned clinical note:\n${noteText}` }],
    description: 'Coding: generate claim',
    mock: buildMockClaim(),
  });

  return { claim: parseClaim(result.text), model: result.model, totalTokens: result.totalTokens, creditsUsed: result.creditsUsed };
}

module.exports = { buildSystemPrompt, parseClaim, noteToText, generateClaim, DEFAULT_SYSTEM_PROMPT, RISK };
