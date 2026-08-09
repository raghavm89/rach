'use strict';

const { pool } = require('@rach/core');
const triage = require('../services/triage');
const audit = require('../services/audit');

// POST /api/triage — assess a presentation and persist a draft
exports.create = async (req, res) => {
  const { presentation, vitals, patient_ref, visit_id } = req.body ?? {};
  if (!presentation || !String(presentation).trim()) {
    return res.status(400).json({ error: 'presentation is required' });
  }
  const ref = (patient_ref || '').trim() || null;

  let out;
  try {
    out = await triage.generateTriage({ tenantId: req.user.tenant_id, userId: req.user.id, presentation, vitals });
  } catch (err) {
    if (err && (err.code === 'MODEL_OUTPUT' || err.status === 502)) return res.status(502).json({ error: err.message });
    if (/JSON|model response/i.test(err.message)) return res.status(502).json({ error: 'The model did not return a usable triage. Please try again.' });
    throw err;
  }
  const t = out.triage;

  const { rows } = await pool.query(
    `INSERT INTO triage_assessments
       (tenant_id, created_by, patient_ref, visit_id, presentation, vitals,
        acuity, acuity_score, red_flags, recommended_route, page_on_call, rationale, disposition, status, model)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,'draft',$14)
     RETURNING *`,
    [
      req.user.tenant_id, req.user.id, ref, visit_id || null, presentation, vitals || null,
      t.acuity, t.acuity_score, JSON.stringify(t.red_flags), t.recommended_route, t.page_on_call,
      t.rationale, t.disposition, out.model,
    ]
  );
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Vihaan',
    action: `Triage: ${t.acuity} → ${t.recommended_route}${t.page_on_call ? ' · page on-call' : ''}`,
    decision: t.acuity === 'critical' || t.red_flags.length ? 'flagged' : 'created',
    entityType: 'triage', entityId: rows[0].id, patientRef: ref, model: out.model,
    summary: t.rationale, metadata: { acuity: t.acuity, route: t.recommended_route, red_flags: t.red_flags, page_on_call: t.page_on_call },
  });
  res.status(201).json({ assessment: rows[0] });
};

// GET /api/triage — recent assessments
exports.list = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, patient_ref, acuity, acuity_score, red_flags, recommended_route, page_on_call,
            status, model, created_at, acknowledged_at
       FROM triage_assessments WHERE tenant_id = $1
      ORDER BY (status = 'acknowledged'), acuity_score NULLS LAST, created_at DESC LIMIT 50`,
    [req.user.tenant_id]
  );
  res.json({ assessments: rows });
};

// GET /api/triage/:id
exports.get = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM triage_assessments WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
  if (!rows.length) return res.status(404).json({ error: 'Assessment not found' });
  res.json({ assessment: rows[0] });
};

// POST /api/triage/:id/acknowledge — clinician acknowledges/routes (optionally overriding route)
exports.acknowledge = async (req, res) => {
  const route = triage.ROUTES.includes(req.body?.recommended_route) ? req.body.recommended_route : null;
  const { rows } = await pool.query(
    `UPDATE triage_assessments
        SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = NOW(),
            recommended_route = COALESCE($2, recommended_route), updated_at = NOW()
      WHERE id = $3 AND tenant_id = $4 AND status = 'draft'
      RETURNING *`,
    [req.user.id, route, req.params.id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Open assessment not found' });
  const a = rows[0];
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Vihaan',
    action: `Triage acknowledged → ${a.recommended_route}`,
    decision: route ? 'modified' : 'confirmed', entityType: 'triage', entityId: a.id,
    patientRef: a.patient_ref, summary: a.rationale, metadata: { acuity: a.acuity, route: a.recommended_route },
  });
  res.json({ assessment: a });
};
