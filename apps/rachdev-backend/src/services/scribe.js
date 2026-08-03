'use strict';

/**
 * Nora — the Scribe agent.
 *
 * Turns a visit transcript into a structured SOAP note + suggested codes via the
 * shared @rach/llm gateway (Claude in the POC; on-prem Sarvam in production — the
 * gateway resolves the model, no code change here). The output is always a DRAFT:
 * a clinician reviews and signs off before it counts (human-in-the-loop).
 */

const { gateway } = require('@rach/llm');
const { AgentDefinition } = require('@rach/core');

const DEFAULT_SYSTEM_PROMPT = `You are a clinical documentation assistant for a hospital. You convert a raw doctor–patient visit transcript into a concise, structured SOAP note.

Rules:
- Use ONLY information present in the transcript. Never invent findings, vitals, medications, or history. If something isn't stated, leave it out.
- Be concise and clinical. No preamble, no advice to the patient.
- Suggest plausible CPT and ICD-10-CM codes ONLY when clearly supported by the transcript; otherwise return an empty list.
- You draft; a licensed clinician reviews and signs. Do not state anything as final or prescribe.

Return ONLY a JSON object (no markdown, no commentary) with exactly this shape:
{
  "soap": { "subjective": string, "objective": string, "assessment": string, "plan": string },
  "codes": [ { "system": "CPT" | "ICD-10-CM", "code": string, "description": string } ],
  "follow_ups": [ string ]
}`;

function buildSystemPrompt(customPrompt) {
  const base = (customPrompt && String(customPrompt).trim()) || DEFAULT_SYSTEM_PROMPT;
  return base;
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

  let def = null;
  try {
    def = await AgentDefinition.findByKey(tenantId, 'scribe');
  } catch { /* definitions table optional at this stage */ }

  const system = buildSystemPrompt(def?.prompt);
  const model = def?.model || undefined; // undefined → gateway default (Claude in POC)

  const result = await gateway.chat({
    tenantId,
    userId,
    model,
    system,
    messages: [{ role: 'user', content: `Transcript:\n${transcript}` }],
    description: 'Scribe: generate SOAP note',
  });

  const parsed = parseNote(result.text);
  return {
    ...parsed,
    model: result.model,
    totalTokens: result.totalTokens,
    creditsUsed: result.creditsUsed,
  };
}

module.exports = { buildSystemPrompt, parseNote, generateNote, DEFAULT_SYSTEM_PROMPT };
