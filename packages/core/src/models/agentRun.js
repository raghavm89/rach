'use strict';

const pool = require('../config/db');

/**
 * AgentRun — the structured run/conversation log (migration 094). One row per
 * handled message. Powers the Conversations inbox and the Agent Monitor's real
 * per-agent telemetry. Logging is best-effort: never let it break a live run.
 */
const AgentRun = {
  async log({ tenantId, subjectType, subjectId, subjectName = null, channel = 'api', conversationId = null, userMessage = null, reply = null, model = null, creditsUsed = 0, status = 'ok' }) {
    if (tenantId == null || subjectId == null) return null;
    try {
      const { rows } = await pool.query(
        `INSERT INTO agent_runs
           (tenant_id, subject_type, subject_id, subject_name, channel, conversation_id, user_message, reply, model, credits_used, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [tenantId, subjectType, subjectId, subjectName, channel,
         conversationId, (userMessage || '').slice(0, 8000), (reply || '').slice(0, 8000), model, Math.max(0, Math.round(creditsUsed || 0)), status]
      );
      return rows[0].id;
    } catch { return null; } // telemetry must never break a run
  },

  /** Recent runs for the inbox (newest first), with optional channel/subject filters. */
  async recent(tenantId, { limit = 100, channel = null, subjectType = null, subjectId = null } = {}) {
    const where = ['tenant_id = $1'];
    const vals = [tenantId];
    if (channel) { where.push(`channel = $${vals.length + 1}`); vals.push(channel); }
    if (subjectType) { where.push(`subject_type = $${vals.length + 1}`); vals.push(subjectType); }
    if (subjectId) { where.push(`subject_id = $${vals.length + 1}`); vals.push(subjectId); }
    vals.push(Math.min(Number(limit) || 100, 500));
    const { rows } = await pool.query(
      `SELECT id, subject_type, subject_id, subject_name, channel, conversation_id,
              user_message, reply, model, credits_used, status, created_at
         FROM agent_runs WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC LIMIT $${vals.length}`,
      vals
    );
    return rows;
  },

  /** Per-subject aggregates keyed by `${subject_type}:${subject_id}` for the Monitor. */
  async statsBySubject(tenantId) {
    const { rows } = await pool.query(
      `SELECT subject_type, subject_id,
              COUNT(*)::int AS runs_total,
              COUNT(*) FILTER (WHERE created_at::date = NOW()::date)::int AS runs_today,
              COALESCE(SUM(credits_used),0)::int AS credits_spent,
              MAX(created_at) AS last_run
         FROM agent_runs WHERE tenant_id = $1
        GROUP BY subject_type, subject_id`,
      [tenantId]
    );
    const map = {};
    for (const r of rows) map[`${r.subject_type}:${r.subject_id}`] = r;
    return map;
  },
};

module.exports = AgentRun;
