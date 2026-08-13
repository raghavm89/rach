'use strict';

const pool = require('../config/db');

/**
 * AgentEval — per-agent test cases (migration 093). Each has an input and an
 * expectation over the reply. Readiness = passed / total from the last run.
 */

const TYPES = ['contains', 'not_contains', 'regex'];

/** Evaluate a reply against an expectation. */
function evaluate(reply, type, value) {
  const r = String(reply || '');
  const v = String(value || '');
  if (type === 'not_contains') return !r.toLowerCase().includes(v.toLowerCase());
  if (type === 'regex') { try { return new RegExp(v, 'i').test(r); } catch { return false; } }
  return r.toLowerCase().includes(v.toLowerCase()); // 'contains'
}

const AgentEval = {
  TYPES,
  evaluate,

  async create(tenantId, agentId, { name = 'Test case', input, expect_type = 'contains', expect_value, userId = null }) {
    const type = TYPES.includes(expect_type) ? expect_type : 'contains';
    const { rows } = await pool.query(
      `INSERT INTO agent_evals (tenant_id, agent_id, name, input, expect_type, expect_value, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, agentId, name, input, type, expect_value, userId]
    );
    return rows[0];
  },

  async listForAgent(tenantId, agentId) {
    const { rows } = await pool.query(
      'SELECT * FROM agent_evals WHERE tenant_id = $1 AND agent_id = $2 ORDER BY id',
      [tenantId, agentId]
    );
    return rows;
  },

  async remove(tenantId, id) {
    const { rowCount } = await pool.query('DELETE FROM agent_evals WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return rowCount > 0;
  },

  async setResult(id, status, output) {
    await pool.query(
      'UPDATE agent_evals SET last_status = $2, last_output = $3, last_run_at = NOW() WHERE id = $1',
      [id, status, String(output || '').slice(0, 4000)]
    );
  },

  /** { total, passed, ran, readiness } from cached last results. */
  async readiness(tenantId, agentId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE last_status = 'pass')::int AS passed,
              COUNT(last_status)::int AS ran
         FROM agent_evals WHERE tenant_id = $1 AND agent_id = $2`,
      [tenantId, agentId]
    );
    const { total, passed, ran } = rows[0];
    return { total, passed, ran, readiness: total ? Math.round((passed / total) * 100) : 0 };
  },
};

module.exports = AgentEval;
