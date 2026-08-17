'use strict';

/**
 * Naina — the Scribe agent.
 *
 * Turns a visit transcript into a structured SOAP note + suggested codes via the
 * shared @rach/llm gateway (Claude in the POC; on-prem Sarvam in production — the
 * gateway resolves the model, no code change here). The output is always a DRAFT:
 * a clinician reviews and signs off before it counts (human-in-the-loop).
 */

const { gateway } = require('@rach/llm');
const { AgentDefinition } = require('@rach/core');
const { getTenantModel } = require('./tenantLlm');
const { cleanupClinicalTranscript } = require('./transcriptCleanup');

const DEFAULT_PERSONA = `You are a clinical documentation assistant for a hospital. You convert a raw doctor–patient visit transcript into a concise, structured SOAP note.

Rules:
- Use ONLY information present in the transcript. Never invent findings, vitals, medications, or history. If something isn't stated, leave it out.
- Be concise and clinical. No preamble, no advice to the patient.
- Suggest plausible CPT and ICD-10-CM codes ONLY when clearly supported by the transcript; otherwise return an empty list.
- You draft; a licensed clinician reviews and signs. Do not state anything as final or prescribe.`;

// The machine-readable output contract. It is ALWAYS enforced — even when a
// custom/edited agent prompt supplies the persona — so an admin can tune the
// tone or rules of the Scribe template without breaking JSON parsing (which is
// what happened when the 'scribe' platform template's persona-only prompt
// replaced the built-in one).
const OUTPUT_CONTRACT = `Return ONLY a JSON object (no markdown, no commentary) with exactly this shape:
{
  "soap": { "subjective": string, "objective": string, "assessment": string, "plan": string },
  "codes": [ { "system": "CPT" | "ICD-10-CM", "code": string, "description": string } ],
  "follow_ups": [ string ]
}`;

// Kept for back-compat / export.
const DEFAULT_SYSTEM_PROMPT = `${DEFAULT_PERSONA}\n\n${OUTPUT_CONTRACT}`;

function buildSystemPrompt(customPrompt) {
  const persona = (customPrompt && String(customPrompt).trim()) || DEFAULT_PERSONA;
  // Append the contract unless the custom prompt already specifies the JSON shape.
  return persona.includes('"soap"') ? persona : `${persona}\n\n${OUTPUT_CONTRACT}`;
}

/**
 * A valid SOAP-shaped draft for LLM_MOCK (demo/offline) mode. Echoes the
 * transcript into Subjective so the draft feels real, and makes clear a clinician
 * must review + sign. Only used when LLM_MOCK is on; otherwise ignored.
 */
function buildMockNote(transcript) {
  const t = String(transcript || '').trim().slice(0, 300);
  return JSON.stringify({
    soap: {
      subjective: t ? `Patient-reported (from transcript): ${t}` : 'No transcript provided.',
      objective: 'No structured vitals or examination findings were dictated in this transcript.',
      assessment: 'Assessment pending clinician review. (Demonstration draft generated in mock mode — no model was called.)',
      plan: 'Clinician to review and correct this draft, order relevant investigations as indicated, and sign off.',
    },
    codes: [],
    follow_ups: ['Clinician review and sign-off required before this note is final.'],
  });
}

/**
 * Extract and normalize the model's JSON into a safe note shape. Tolerates code
 * fences / surrounding prose by grabbing the outermost { … } block.
 * @throws if no JSON object can be parsed.
 */
function parseNote(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty model response');
  }
  let raw = text.trim();

  // Strip ```json … ``` fences if present.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();

  // Fall back to the outermost object.
  if (raw[0] !== '{') {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('No JSON object found in model response');
    }
    raw = raw.slice(start, end + 1);
  }

  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error('Model response was not valid JSON');
  }

  const soapIn = obj.soap && typeof obj.soap === 'object' ? obj.soap : {};
  const str = (v) => (typeof v === 'string' ? v : '');
  const soap = {
    subjective: str(soapIn.subjective),
    objective:  str(soapIn.objective),
    assessment: str(soapIn.assessment),
    plan:       str(soapIn.plan),
  };

  const codes = Array.isArray(obj.codes)
    ? obj.codes
        .filter((c) => c && (c.code || c.description))
        .map((c) => ({
          system: str(c.system) || 'ICD-10-CM',
          code: str(c.code),
          description: str(c.description),
        }))
    : [];

  const follow_ups = Array.isArray(obj.follow_ups)
    ? obj.follow_ups.filter((f) => typeof f === 'string' && f.trim()).map((f) => f.trim())
    : [];

  return { soap, codes, follow_ups };
}

/**
 * Generate a SOAP note from a transcript. Uses the tenant's configured 'scribe'
 * AgentDefinition (prompt/model) when present, else built-in defaults.
 * @returns {Promise<{soap,codes,follow_ups,model,totalTokens,creditsUsed}>}
 */
async function generateNote({ tenantId, userId, transcript }) {
  if (!transcript || !String(transcript).trim()) {
    throw new Error('Transcript is required');
  }

  // Correct ASR mishears (drug names, homophones) before writing the note. Best-effort.
  const clean = await cleanupClinicalTranscript({ tenantId, userId, text: transcript, kind: 'consultation' });

  let def = null;
  try {
    def = await AgentDefinition.findByKey(tenantId, 'scribe');
  } catch { /* definitions table optional at this stage */ }

  const system = buildSystemPrompt(def?.prompt);
  // Prefer the org's admin-configured model, then the agent's, then the default.
  const model = (await getTenantModel(tenantId)) || def?.model || undefined;

  const baseMessages = [{ role: 'user', content: `Transcript:\n${clean}` }];

  // Some models (esp. terse transcripts or on-prem models) occasionally answer in
  // prose instead of JSON. Try once, and if the output can't be parsed, retry once
  // with a hard reminder to emit JSON only before giving up with a clean error.
  const attempts = [
    baseMessages,
    [
      ...baseMessages,
      { role: 'user', content: `Your response must be ONLY the JSON object described in the system prompt — no explanation, no prose, starting with "{" and ending with "}".` },
    ],
  ];

  let lastErr = null;
  let lastResult = null;
  for (const messages of attempts) {
    const result = await gateway.chat({
      tenantId,
      userId,
      model,
      system,
      messages,
      description: 'Scribe: generate SOAP note',
      // Used only when LLM_MOCK is on: a valid SOAP-shaped draft so parseNote works
      // and the demo shows the human-in-the-loop flow without an API call.
      mock: buildMockNote(transcript),
    });
    lastResult = result;
    try {
      const parsed = parseNote(result.text);
      return {
        ...parsed,
        model: result.model,
        totalTokens: result.totalTokens,
        creditsUsed: result.creditsUsed,
      };
    } catch (err) {
      lastErr = err;
    }
  }

  // Both attempts failed to yield JSON — surface a clear, user-facing reason.
  const e = new Error('The model did not return a usable note. Please try again, or add a little more detail to the transcript.');
  e.code = 'MODEL_OUTPUT';
  e.status = 502;
  e.cause = lastErr;
  e.raw = lastResult && typeof lastResult.text === 'string' ? lastResult.text.slice(0, 300) : null;
  throw e;
}

module.exports = { buildSystemPrompt, parseNote, generateNote, DEFAULT_SYSTEM_PROMPT };
