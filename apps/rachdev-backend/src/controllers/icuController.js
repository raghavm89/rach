'use strict';

const { pool } = require('@rach/core');
const icu = require('../services/icu');
const audit = require('../services/audit');

const OBS_FIELDS = ['hr', 'rr', 'sbp', 'dbp', 'spo2', 'temp', 'gcs', 'creatinine', 'lactate', 'troponin', 'wbc', 'urine_output'];

// POST /api/icu/observations — record vitals/labs; the sentinel evaluates & alerts
exports.recordObservation = async (req, res) => {
  const b = req.body ?? {};
  const patientId = Number(b.patient_id);
  if (!patientId) return res.status(400).json({ error: 'patient_id is required' });

  const { rows: p } = await pool.query('SELECT id, name, uhid FROM patients WHERE id=$1 AND tenant_id=$2', [patientId, req.user.tenant_id]);
  if (!p.length) return res.status(404).json({ error: 'Patient not found' });

  const obs = {};
  for (const f of OBS_FIELDS) obs[f] = icu.num(b[f]);
  obs.ecg_note = b.ecg_note ? String(b.ecg_note).trim() : null;
  // Provenance: a bedside device gateway posts source=device; hand-charting = manual.
  const source = b.source === 'device' ? 'device' : 'manual';
  const deviceId = b.device_id ? String(b.device_id).trim() : null;

  const { news2, conditions } = icu.assess(obs);

  const { rows: orow } = await pool.query(
    `INSERT INTO icu_observations
       (tenant_id, patient_id, visit_id, recorded_by, hr, rr, sbp, dbp, spo2, temp, gcs,
        creatinine, lactate, troponin, wbc, urine_output, ecg_note, news2, source, device_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
    [req.user.tenant_id, patientId, b.visit_id || null, req.user.id,
     obs.hr, obs.rr, obs.sbp, obs.dbp, obs.spo2, obs.temp, obs.gcs,
     obs.creatinine, obs.lactate, obs.troponin, obs.wbc, obs.urine_output, obs.ecg_note, news2, source, deviceId]
  );
  const observation = orow[0];

  // Fire an alert per detected condition — but don't re-fire one already OPEN.
  const fired = [];
  for (const c of conditions) {
    const { rows: dup } = await pool.query(
      `SELECT 1 FROM icu_alerts WHERE tenant_id=$1 AND patient_id=$2 AND condition=$3 AND status='open' LIMIT 1`,
      [req.user.tenant_id, patientId, c.condition]
    );
    if (dup.length) continue;

    const narrated = await icu.narrate({
      tenantId: req.user.tenant_id, userId: req.user.id, patientName: p[0].name,
      condition: c.condition, severity: c.severity, evidence: c.evidence, score: news2,
    });
    const { rows: arow } = await pool.query(
      `INSERT INTO icu_alerts (tenant_id, patient_id, observation_id, condition, severity, score, evidence, message, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) RETURNING *`,
      [req.user.tenant_id, patientId, observation.id, c.condition, c.severity, news2, JSON.stringify(c.evidence), narrated.message, narrated.model]
    );
    fired.push(arow[0]);
    await audit.record({
      tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Umeed',
      action: `ICU alert: ${c.condition} (${c.severity})`, decision: 'flagged',
      entityType: 'icu_alert', entityId: arow[0].id, patientRef: p[0].uhid || p[0].name,
      model: narrated.model, summary: narrated.message, metadata: { condition: c.condition, severity: c.severity, news2, evidence: c.evidence },
    });
  }

  res.status(201).json({ observation, news2, alerts: fired });
};

// GET /api/icu — monitoring board: latest observation + open-alert count per patient
exports.board = async (req, res) => {
  const { rows } = await pool.query(
    `WITH latest AS (
        SELECT DISTINCT ON (patient_id) *
          FROM icu_observations
         WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '48 hours'
         ORDER BY patient_id, created_at DESC
     )
     SELECT l.patient_id, l.hr, l.rr, l.sbp, l.dbp, l.spo2, l.temp, l.gcs,
            l.creatinine, l.lactate, l.troponin, l.urine_output, l.ecg_note,
            l.news2, l.created_at, p.name AS patient_name, p.uhid,
            (SELECT COUNT(*) FROM icu_alerts a WHERE a.tenant_id=$1 AND a.patient_id=l.patient_id AND a.status='open')::int AS open_alerts,
            (SELECT max(a.severity) FROM icu_alerts a WHERE a.tenant_id=$1 AND a.patient_id=l.patient_id AND a.status='open') AS worst
       FROM latest l JOIN patients p ON p.id = l.patient_id
      ORDER BY l.news2 DESC NULLS LAST, l.created_at DESC`,
    [req.user.tenant_id]
  );
  res.json({ patients: rows });
};

// GET /api/icu/alerts?status=open|all
exports.listAlerts = async (req, res) => {
  const status = req.query.status === 'all' ? null : 'open';
  const params = [req.user.tenant_id];
  let where = 'a.tenant_id = $1';
  if (status) { params.push(status); where += ` AND a.status = $${params.length}`; }
  const { rows } = await pool.query(
    `SELECT a.*, p.name AS patient_name, p.uhid
       FROM icu_alerts a JOIN patients p ON p.id = a.patient_id
      WHERE ${where}
      ORDER BY (a.status <> 'open'),
               CASE a.severity WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END,
               a.created_at DESC
      LIMIT 100`,
    params
  );
  res.json({ alerts: rows });
};

// POST /api/icu/alerts/:id/ack  ·  POST /api/icu/alerts/:id/resolve
async function transition(req, res, next, decision, action) {
  const { rows } = await pool.query(
    `UPDATE icu_alerts SET status=$1, acknowledged_by=$2, acknowledged_at=NOW(), updated_at=NOW()
      WHERE id=$3 AND tenant_id=$4 AND status <> $1 RETURNING *`,
    [next, req.user.id, req.params.id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Alert not found or already in that state' });
  const a = rows[0];
  const { rows: p } = await pool.query('SELECT uhid, name FROM patients WHERE id=$1', [a.patient_id]);
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Umeed',
    action, decision, entityType: 'icu_alert', entityId: a.id,
    patientRef: p[0]?.uhid || p[0]?.name || null, summary: a.message,
    metadata: { condition: a.condition, severity: a.severity },
  });
  res.json({ alert: a });
}
exports.acknowledge = (req, res) => transition(req, res, 'acknowledged', 'confirmed', 'ICU alert acknowledged');
exports.resolve = (req, res) => transition(req, res, 'resolved', 'completed', 'ICU alert resolved');
