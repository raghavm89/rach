'use strict';

const pool = require('../config/db');

/**
 * AgentDefinition — the persisted `AgentSpec`.
 *
 * Built in the RachDev portal (agent-builder) and operated in a tenant
 * workspace. The @rach/llm gateway reads `model` (→ provider via the catalog)
 * to route to Claude (POC) or an on-prem gateway (production) with no code
 * change. A row with tenant_id = NULL is a platform template.
 */
const AgentDefinition = {
  async create({
    tenant_id = null,
    key,
    name,
    role = '',
    tools = [],
    guardrails = {},
    provider = 'anthropic',
    model = null,
    prompt = '',
    enabled = true,
  }) {
    const { rows } = await pool.query(
      `INSERT INTO agent_definitions
         (tenant_id, key, name, role, tools, guardrails, provider, model, prompt, enabled)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10)
       RETURNING *`,
      [
        tenant_id, key, name, role,
        JSON.stringify(tools), JSON.stringify(guardrails),
        provider, model, prompt, enabled,
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
    const { rows } = await pool.query(
      'SELECT * FROM agent_definitions WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  async update(id, patch = {}) {
    const allowed = ['name', 'role', 'tools', 'guardrails', 'provider', 'model', 'prompt', 'enabled'];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const col of allowed) {
      if (patch[col] === undefined) continue;
      const isJson = col === 'tools' || col === 'guardrails';
      sets.push(`${col} = $${i}${isJson ? '::jsonb' : ''}`);
      vals.push(isJson ? JSON.stringify(patch[col]) : patch[col]);
      i += 1;
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

  async remove(id) {
    await pool.query('DELETE FROM agent_definitions WHERE id = $1', [id]);
  },
};

module.exports = AgentDefinition;
