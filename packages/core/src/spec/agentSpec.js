'use strict';

/**
 * AgentSpec v1 — the contract that crosses the RachDev build/operate seam.
 *
 * This module is the runtime source of truth: the builder validates what it
 * writes and the runtime validates what it reads against the SAME schema
 * (agentSpec.schema.json). Contract prose: docs/RACHDEV_AGENTSPEC_CONTRACT.md.
 *
 *   const { validateAgentSpecInput, rowToSpec, columnsFromInput } = require('@rach/core').agentSpec;
 *
 * Decisions (locked 2026-08-05): draft + immutable published versions;
 * model_policy.class (not raw provider/model); strict validation (unknown fields
 * rejected); four tool types.
 */

const Ajv = require('ajv/dist/2020'); // schema uses draft 2020-12
const addFormats = require('ajv-formats');
const schema = require('./agentSpec.schema.json');

const AGENT_SPEC_VERSION = '1.0';

// Fields a builder/user may set. Everything else (id, tenant_id, status, version,
// timestamps, created_by, spec_version) is server-managed and rejected on input.
const EDITABLE_FIELDS = [
  'key', 'name', 'role', 'description', 'industry', 'template_ref',
  'prompt', 'model_policy', 'tools', 'guardrails', 'knowledge',
  'channels', 'runtime_target',
];

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validateFull = ajv.compile(schema);

function buildInputSchema(required) {
  const properties = {};
  for (const key of EDITABLE_FIELDS) properties[key] = schema.properties[key];
  return {
    type: 'object',
    additionalProperties: false, // reject unknown fields — strict contract
    required,
    $defs: schema.$defs,
    properties,
  };
}

const validateInputCreate = ajv.compile(buildInputSchema(['key', 'name']));
const validateInputUpdate = ajv.compile(buildInputSchema([]));

/** Format Ajv errors into short, human-readable strings. */
function formatErrors(errors) {
  if (!errors) return [];
  return errors.map((e) => {
    const where = e.instancePath || '(root)';
    if (e.keyword === 'additionalProperties') {
      return `${where}: unknown field "${e.params.additionalProperty}"`;
    }
    return `${where} ${e.message}`.trim();
  });
}

/** Validate a full, canonical AgentSpec (the read shape). */
function validateAgentSpec(spec) {
  const valid = validateFull(spec);
  return { valid, errors: valid ? [] : formatErrors(validateFull.errors) };
}

/**
 * Validate builder input (the write shape) — the editable subset only.
 * @param {object} body
 * @param {{partial?: boolean}} [opts]  partial = update (key/name not required)
 */
function validateAgentSpecInput(body, opts = {}) {
  const validate = opts.partial ? validateInputUpdate : validateInputCreate;
  const valid = validate(body);
  return { valid, errors: valid ? [] : formatErrors(validate.errors) };
}

/** ISO-string a pg timestamp (Date | string | null) or return undefined. */
function iso(v) {
  if (v == null) return undefined;
  return v instanceof Date ? v.toISOString() : String(v);
}

/**
 * Map a persisted agent_definitions row → canonical AgentSpec object.
 * JSONB columns arrive pre-parsed from node-postgres.
 */
function rowToSpec(row) {
  const spec = {
    spec_version: row.spec_version || AGENT_SPEC_VERSION,
    id: row.id,
    tenant_id: row.tenant_id ?? null,
    key: row.key,
    template_ref: row.template_slug
      ? { slug: row.template_slug, version: row.template_version }
      : null,
    industry: row.industry ?? null,
    name: row.name,
    role: row.role || '',
    description: row.description || '',
    prompt: row.prompt || '',
    model_policy: {
      class: row.model_class || 'balanced',
      ...(row.model ? { pin: row.model } : {}),
    },
    tools: row.tools ?? [],
    guardrails: row.guardrails ?? {},
    knowledge: row.knowledge ?? null,
    channels: row.channels ?? [],
    runtime_target: row.runtime_target ?? { type: 'rachbase' },
    status: row.status || 'draft',
    version: row.version || 1,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    published_at: row.published_at ? iso(row.published_at) : null,
    created_by: row.created_by ?? null,
  };
  // Drop undefined timestamps so the object stays clean.
  if (spec.created_at === undefined) delete spec.created_at;
  if (spec.updated_at === undefined) delete spec.updated_at;
  return spec;
}

/**
 * Translate validated spec input → agent_definitions column values.
 * model_policy → (model_class, model[=pin]); template_ref → (template_slug, template_version).
 * Only keys present in `body` are returned, so it works for partial updates.
 */
function columnsFromInput(body) {
  const cols = {};
  const passthrough = ['key', 'name', 'role', 'description', 'industry', 'prompt',
    'tools', 'guardrails', 'knowledge', 'channels', 'runtime_target'];
  for (const k of passthrough) if (body[k] !== undefined) cols[k] = body[k];

  if (body.model_policy !== undefined) {
    cols.model_class = body.model_policy.class;
    cols.model = body.model_policy.pin ?? null; // pin stored in legacy `model` column
  }
  if (body.template_ref !== undefined) {
    cols.template_slug = body.template_ref ? body.template_ref.slug : null;
    cols.template_version = body.template_ref ? body.template_ref.version : null;
  }
  return cols;
}

module.exports = {
  AGENT_SPEC_VERSION,
  EDITABLE_FIELDS,
  schema,
  validateAgentSpec,
  validateAgentSpecInput,
  rowToSpec,
  columnsFromInput,
};
