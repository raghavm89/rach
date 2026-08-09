'use strict';

/**
 * Patient journey — the step-in → step-out timeline for one patient, assembled
 * from the append-only audit trail (which already records every agent action and
 * clinician decision against a patient_ref), plus the "what next" the patient
 * leaves with: the nearest follow-up, the latest discharge advice, and the active
 * prescription.
 */

const { pool } = require('@rach/core');

// GET /api/journey/:patientId
exports.get = async (req, res) => {
  const tid = req.user.tenant_id;
  const { rows: p } = await pool.query(
    'SELECT id, name, uhid, age, sex, phone, military FROM patients WHERE id=$1 AND tenant_id=$2',
    [req.params.patientId, tid]
  );
  if (!p.length) return res.status(404).json({ error: 'Patient not found' });
  const patient = p[0];
  const ref = patient.uhid || '';
  const name = patient.name || '';

  const [timeline, followUp, discharge, meds] = await Promise.all([
    // Timeline from the audit trail (chronological — step-in first).
    pool.query(
      `SELECT a.agent, a.action, a.decision, a.source, a.summary, a.created_at, u.name AS actor_name
         FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
        WHERE a.tenant_id = $1 AND (a.patient_ref = $2 OR lower(a.patient_ref) = lower($3))
        ORDER BY a.created_at ASC LIMIT 200`,
      [tid, ref || ' ', name || ' ']
    ),
    // Nearest upcoming scheduled follow-up.
    pool.query(
      `SELECT id, appointment_at, department, reason FROM visits
        WHERE tenant_id=$1 AND patient_id=$2 AND status='scheduled' AND appointment_at IS NOT NULL AND appointment_at > NOW()
        ORDER BY appointment_at ASC LIMIT 1`,
      [tid, patient.id]
    ),
    // Latest discharge summary for the patient.
    pool.query(
      `SELECT summary, status, created_at FROM discharge_summaries
        WHERE tenant_id=$1 AND (patient_ref = $2 OR lower(patient_ref) = lower($3))
        ORDER BY created_at DESC LIMIT 1`,
      [tid, ref || ' ', name || ' ']
    ),
    // Active prescription (latest note that carries medications).
    pool.query(
      `SELECT medications, status, updated_at FROM clinical_notes
        WHERE tenant_id=$1 AND (patient_ref = $2 OR lower(patient_ref) = lower($3))
          AND jsonb_array_length(medications) > 0
        ORDER BY updated_at DESC LIMIT 1`,
      [tid, ref || ' ', name || ' ']
    ),
  ]);

  res.json({
    patient,
    timeline: timeline.rows,
    next: {
      follow_up: followUp.rows[0] || null,
      discharge: discharge.rows[0] || null,
      medications: meds.rows[0]?.medications || [],
    },
  });
};
