'use strict';

/**
 * Audit trail — the append-only record behind the Control Tower and Audit Log.
 *
 * `record()` is best-effort: a failed audit write must never break the clinical
 * action it describes, so it swallows errors (and logs them). Call it AFTER the
 * underlying change has committed, so the trail can't claim something that was
 * rolled back.
 */

const { pool } = require('@rach/core');

const DECISIONS = new Set([
  'created', 'confirmed', 'signed', 'assigned', 'completed', 'cancelled', 'flagged', 'overridden', 'modified', 'consent',
]);

/**
 * Append one audit entry. Non-throwing.
 * @param {object} e
 * @param {number} e.tenantId
 * @param {number|null} [e.actorId]   the human who acted
 * @param {string|null} [e.agent]     display name (Naina | Asha | Kabir | Kiran)
 * @param {string} e.action           short label, e.g. 'SOAP note signed'
 * @param {string|null} [e.decision]  one of DECISIONS
 * @param {string|null} [e.entityType]
 * @param {number|null} [e.entityId]
 * @param {string|null} [e.patientRef]
 * @param {string|null} [e.source]    text | dictation | ai | manual
 * @param {string|null} [e.model]
 * @param {string|null} [e.summary]
 * @param {object} [e.metadata]
 */
async function record(e) {
  try {
    if (!e || !e.tenantId || !e.action) return;
    const decision = e.decision && DECISIONS.has(e.decision) ? e.decision : (e.decision || null);
    await pool.query(
      `INSERT INTO audit_log
         (tenant_id, actor_id, agent, action, decision, entity_type, entity_id,
          patient_ref, source, model, summary, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [
        e.tenantId, e.actorId ?? null, e.agent ?? null, e.action, decision,
        e.entityType ?? null, e.entityId ?? null, e.patientRef ?? null,
        e.source ?? null, e.model ?? null, e.summary ?? null,
        JSON.stringify(e.metadata ?? {}),
      ]
    );
  } catch (err) {
    // Best-effort: never propagate an audit failure into the clinical flow.
    // eslint-disable-next-line no-console
    console.error('[audit] record failed:', err.message);
  }
}

/** Paginated, filterable audit list for the Audit Log page. */
async function list(tenantId, { agent, decision, q, limit = 50, offset = 0 } = {}) {
  const params = [tenantId];
  let where = 'a.tenant_id = $1';
  if (agent)    { params.push(agent);    where += ` AND a.agent = $${params.length}`; }
  if (decision) { params.push(decision); where += ` AND a.decision = $${params.length}`; }
  if (q)        { params.push(`%${q.toLowerCase()}%`); where += ` AND (lower(a.patient_ref) LIKE $${params.length} OR lower(a.summary) LIKE $${params.length} OR lower(a.action) LIKE $${params.length})`; }

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM audit_log a WHERE ${where}`, params);
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);
  params.push(lim, off);
  const rows = await pool.query(
    `SELECT a.id, a.agent, a.action, a.decision, a.entity_type, a.entity_id, a.patient_ref,
            a.source, a.model, a.summary, a.created_at, u.name AS actor_name
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
      WHERE ${where}
      ORDER BY a.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { entries: rows.rows, total: totalRes.rows[0].total, limit: lim, offset: off };
}

/** Roll-ups for the Control Tower tiles: totals, today, and counts by decision/agent. */
async function summary(tenantId) {
  const [totals, byDecision, byAgent] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today,
              MAX(created_at) AS last_at
         FROM audit_log WHERE tenant_id = $1`, [tenantId]),
    pool.query(
      `SELECT decision, COUNT(*)::int AS n FROM audit_log
        WHERE tenant_id = $1 AND decision IS NOT NULL GROUP BY decision`, [tenantId]),
    pool.query(
      `SELECT agent, COUNT(*)::int AS n FROM audit_log
        WHERE tenant_id = $1 AND agent IS NOT NULL GROUP BY agent`, [tenantId]),
  ]);
  const decisions = Object.fromEntries(byDecision.rows.map((r) => [r.decision, r.n]));
  const agents = Object.fromEntries(byAgent.rows.map((r) => [r.agent, r.n]));
  return { total: totals.rows[0].total, today: totals.rows[0].today, last_at: totals.rows[0].last_at, decisions, agents };
}

module.exports = { record, list, summary, DECISIONS };
