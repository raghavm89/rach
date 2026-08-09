'use strict';

const pool = require('../config/db');
const { rowToSpec } = require('../spec/agentSpec');

/**
 * AgentDefinition — the persisted `AgentSpec` (v1 contract).
 *
 * `agent_definitions` holds the WORKING DRAFT (one row per (tenant_id, key)).
 * Publishing snapshots the draft into the immutable `agent_spec_versions` table
 * and bumps `version`; deployments reference a specific published version, so a
 * live agent never mutates under itself. See docs/RACHDEV_AGENTSPEC_CONTRACT.md.
 *
 * Model selection is by `model_class` (fast|balanced|reasoning); `model` is the
 * optional pin. The @rach/llm gateway resolves the class per environment (Claude
 * in the cloud POC, on-prem vLLM/Sarvam in production). A row with
 * tenant_id = NULL is a platform template.
 */

// JSONB columns (stored stringified).
const JSON_COLS = new Set(['tools', 'guardrails', 'knowledge', 'channels', 'runtime_target']);

// Columns a create/update may set (server owns id, tenant_id, spec_version,
// version, published_at, timestamps).
const WRITABLE = [
  'key', 'name', 'role', 'description', 'industry',
  'template_slug', 'template_version', 'prompt',
  'model_class', 'model', 'tools', 'guardrails', 'knowledge',
  'channels', 'runtime_target', 'status', 'created_by',
];

const AgentDefinition = {
  async create(cols = {}) {
    const values = {
      tenant_id: cols.tenant_id ?? null,
      key: cols.key,
      name: cols.name,
      role: cols.role ?? '',
      description: cols.description ?? '',
      industry: cols.industry ?? null,
      template_slug: cols.template_slug ?? null,
      template_version: cols.template_version ?? null,
      prompt: cols.prompt ?? '',
      model_class: cols.model_class ?? 'balanced',
      model: cols.model ?? null,
      tools: cols.tools ?? [],
      guardrails: cols.guardrails ?? {},
      knowledge: cols.knowledge ?? null,
      channels: cols.channels ?? [],
      runtime_target: cols.runtime_target ?? { type: 'rachbase' },
      status: cols.status ?? 'draft',
      created_by: cols.created_by ?? null,
    };

    const { rows } = await pool.query(
      `INSERT INTO agent_definitions
         (tenant_id, key, name, role, description, industry,
          template_slug, template_version, prompt,
          model_class, model, tools, guardrails, knowledge,
          channels, runtime_target, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               $12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18)
       RETURNING *`,
      [
        values.tenant_id, values.key, values.name, values.role, values.description, values.industry,
        values.template_slug, values.template_version, values.prompt,
        values.model_class, values.model,
        JSON.stringify(values.tools), JSON.stringify(values.guardrails),
        values.knowledge == null ? null : JSON.stringify(values.knowledge),
        JSON.stringify(values.channels), JSON.stringify(values.runtime_target),
        values.status, values.created_by,
      ]
    );
    return rows[0];
  },

  /** Tenant's definitions + platform templates (tenant_id IS NULL). */
  async listForTenant(tenantId) {
    const { rows } = await pool.query(
      `SELECT * FROM agent_definitions
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY tenant_id NULLS FIRST, key`,
      [tenantId]
    );
    return rows;
  },

  async findByKey(tenantId, key) {
    const { rows } = await pool.query(
      `SELECT * FROM agent_definitions
       WHERE key = $2 AND (tenant_id = $1 OR tenant_id IS NULL)
       ORDER BY tenant_id NULLS LAST
       LIMIT 1`,
      [tenantId, key]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM agent_definitions WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async update(id, patch = {}) {
    const sets = [];
    const vals = [];
    let i = 1;
    for (const col of WRITABLE) {
      if (patch[col] === undefined) continue;
      if (JSON_COLS.has(col)) {
        sets.push(`${col} = $${i}::jsonb`);
        vals.push(patch[col] == null ? null : JSON.stringify(patch[col]));
      } else {
        sets.push(`${col} = $${i}`);
        vals.push(patch[col]);
      }
      i += 1;
    }
    // Editing a draft returns it to draft state (a published agent keeps its
    // deployed version until re-published).
    if (patch.status === undefined) {
      sets.push(`status = CASE WHEN status = 'disabled' THEN 'disabled' ELSE 'draft' END`);
    }
    if (!sets.length) return this.findById(id);
    sets.push('updated_at = NOW()');
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE agent_definitions SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return rows[0] || null;
  },

  /**
   * Publish the current draft as an immutable version.
   * Atomic: snapshot → agent_spec_versions, bump version + mark published.
   * @returns {{ version:number, spec:object } | null}
   */
  async publish(id, userId = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: drows } = await client.query(
        'SELECT * FROM agent_definitions WHERE id = $1 FOR UPDATE', [id]
      );
      const row = drows[0];
      if (!row) { await client.query('ROLLBACK'); return null; }

      const { rows: vrows } = await client.query(
        `SELECT COALESCE(MAX(version), 0) AS max FROM agent_spec_versions
         WHERE agent_key = $1 AND tenant_id IS NOT DISTINCT FROM $2`,
        [row.key, row.tenant_id]
      );
      const nextVersion = Number(vrows[0].max) + 1;

      const spec = rowToSpec(row);
      spec.status = 'published';
      spec.version = nextVersion;
      spec.published_at = new Date().toISOString();

      await client.query(
        `INSERT INTO agent_spec_versions (tenant_id, agent_key, version, spec, created_by)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [row.tenant_id, row.key, nextVersion, JSON.stringify(spec), userId]
      );
      await client.query(
        `UPDATE agent_definitions
           SET status = 'published', version = $2, published_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [id, nextVersion]
      );
      await client.query('COMMIT');
      return { version: nextVersion, spec };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Published version history for an agent (newest first). */
  async listVersions(tenantId, key) {
    const { rows } = await pool.query(
      `SELECT version, published_at, created_by FROM agent_spec_versions
       WHERE agent_key = $2 AND tenant_id IS NOT DISTINCT FROM $1
       ORDER BY version DESC`,
      [tenantId, key]
    );
    return rows;
  },

  /** A specific published snapshot (the immutable spec). */
  async getVersion(tenantId, key, version) {
    const { rows } = await pool.query(
      `SELECT spec FROM agent_spec_versions
       WHERE agent_key = $2 AND tenant_id IS NOT DISTINCT FROM $1 AND version = $3`,
      [tenantId, key, version]
    );
    return rows[0] ? rows[0].spec : null;
  },

  async remove(id) {
    await pool.query('DELETE FROM agent_definitions WHERE id = $1', [id]);
  },
};

module.exports = AgentDefinition;
