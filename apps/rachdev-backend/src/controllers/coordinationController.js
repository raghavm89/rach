'use strict';

const { pool } = require('@rach/core');
const discharge = require('../services/discharge');
const audit = require('../services/audit');

// ── Beds / OT ─────────────────────────────────────────────────────────────────
const BED_KINDS = new Set(['general', 'ICU', 'OT']);
const BED_STATUS = new Set(['available', 'occupied', 'reserved', 'maintenance']);

exports.listBeds = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.*, p.name AS patient_name, p.uhid
       FROM beds b LEFT JOIN patients p ON p.id = b.patient_id
      WHERE b.tenant_id = $1 ORDER BY b.ward, b.bed_number`,
    [req.user.tenant_id]
  );
  res.json({ beds: rows });
};

exports.upsertBed = async (req, res) => {
  const ward = (req.body?.ward || '').trim();
  const bed_number = (req.body?.bed_number || '').trim();
  const kind = BED_KINDS.has(req.body?.kind) ? req.body.kind : 'general';
  if (!ward || !bed_number) return res.status(400).json({ error: 'ward and bed_number are required' });
  const { rows } = await pool.query(
    `INSERT INTO beds (tenant_id, ward, bed_number, kind) VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id, ward, bed_number) DO UPDATE SET kind = EXCLUDED.kind, updated_at = NOW()
     RETURNING *`,
    [req.user.tenant_id, ward, bed_number, kind]
  );
  res.status(201).json({ bed: rows[0] });
};

// PATCH /api/coordination/beds/:id — assign to a patient, or set status/release
exports.updateBed = async (req, res) => {
  const status = BED_STATUS.has(req.body?.status) ? req.body.status : null;
  const patientId = req.body?.patient_id === null ? null : (req.body?.patient_id ? Number(req.body.patient_id) : undefined);
  const visitId = req.body?.visit_id === null ? null : (req.body?.visit_id ? Number(req.body.visit_id) : undefined);

  const sets = ['updated_at = NOW()']; const args = [];
  if (status) { args.push(status); sets.push(`status = $${args.length}`); }
  if (patientId !== undefined) { args.push(patientId); sets.push(`patient_id = $${args.length}`); }
  if (visitId !== undefined) { args.push(visitId); sets.push(`visit_id = $${args.length}`); }
  if (req.body?.note !== undefined) { args.push(req.body.note || null); sets.push(`note = $${args.length}`); }
  if (args.length === 0) return res.status(400).json({ error: 'nothing to update' });

  args.push(req.params.id, req.user.tenant_id);
  const { rows } = await pool.query(
    `UPDATE beds SET ${sets.join(', ')} WHERE id = $${args.length - 1} AND tenant_id = $${args.length} RETURNING *`,
    args
  );
  if (!rows.length) return res.status(404).json({ error: 'Bed not found' });
  const b = rows[0];
  const assigned = patientId !== undefined && patientId !== null;
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Kabir',
    action: assigned ? `Bed assigned · ${b.ward}/${b.bed_number}` : `Bed ${b.status} · ${b.ward}/${b.bed_number}`,
    decision: assigned ? 'assigned' : 'confirmed', entityType: 'bed', entityId: b.id,
    summary: `${b.kind} · ${b.status}`, metadata: { ward: b.ward, bed: b.bed_number, status: b.status },
  });
  res.json({ bed: b });
};

// ── Referrals ─────────────────────────────────────────────────────────────────
exports.listReferrals = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.*, p.name AS patient_name, p.uhid FROM referrals r LEFT JOIN patients p ON p.id = r.patient_id
      WHERE r.tenant_id = $1 ORDER BY (r.status <> 'open'), (r.priority = 'routine'), r.created_at DESC LIMIT 100`,
    [req.user.tenant_id]
  );
  res.json({ referrals: rows });
};

exports.createReferral = async (req, res) => {
  const b = req.body ?? {};
  const patientId = b.patient_id ? Number(b.patient_id) : null;
  let patientRef = (b.patient_ref || '').trim() || null;
  if (patientId && !patientRef) {
    const { rows: p } = await pool.query('SELECT uhid, name FROM patients WHERE id=$1 AND tenant_id=$2', [patientId, req.user.tenant_id]);
    patientRef = p[0]?.uhid || p[0]?.name || null;
  }
  const priority = b.priority === 'urgent' ? 'urgent' : 'routine';
  const { rows } = await pool.query(
    `INSERT INTO referrals (tenant_id, patient_id, visit_id, patient_ref, from_dept, to_dept, to_hospital, reason, priority, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.user.tenant_id, patientId, b.visit_id || null, patientRef, (b.from_dept || '').trim() || null,
     (b.to_dept || '').trim() || null, (b.to_hospital || '').trim() || null, (b.reason || '').trim() || null, priority, req.user.id]
  );
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Kabir',
    action: `Referral → ${rows[0].to_dept || rows[0].to_hospital || 'specialist'}${priority === 'urgent' ? ' (urgent)' : ''}`,
    decision: priority === 'urgent' ? 'flagged' : 'created', entityType: 'referral', entityId: rows[0].id,
    patientRef, summary: rows[0].reason, metadata: { to_dept: rows[0].to_dept, to_hospital: rows[0].to_hospital, priority },
  });
  res.status(201).json({ referral: rows[0] });
};

const REFERRAL_STATUS = new Set(['open', 'accepted', 'completed', 'cancelled']);
exports.updateReferral = async (req, res) => {
  const status = REFERRAL_STATUS.has(req.body?.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'valid status required' });
  const { rows } = await pool.query(
    `UPDATE referrals SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *`,
    [status, req.params.id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Referral not found' });
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Kabir',
    action: `Referral ${status}`, decision: status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'confirmed',
    entityType: 'referral', entityId: rows[0].id, patientRef: rows[0].patient_ref,
  });
  res.json({ referral: rows[0] });
};

// ── Discharge summaries ───────────────────────────────────────────────────────
async function notesForVisit(client, tenantId, visitId) {
  const { rows } = await client.query(
    `SELECT soap, status FROM clinical_notes WHERE tenant_id=$1 AND visit_id=$2 ORDER BY updated_at DESC`, [tenantId, visitId]
  );
  return rows;
}

// POST /api/coordination/discharge — draft a discharge summary from a visit
exports.generateDischarge = async (req, res) => {
  const visitId = Number(req.body?.visit_id);
  if (!visitId) return res.status(400).json({ error: 'visit_id is required' });
  const { rows: v } = await pool.query(
    `SELECT v.id, p.name, p.age, p.sex, p.uhid FROM visits v JOIN patients p ON p.id=v.patient_id
      WHERE v.id=$1 AND v.tenant_id=$2`, [visitId, req.user.tenant_id]
  );
  if (!v.length) return res.status(404).json({ error: 'Visit not found' });
  const patient = v[0];
  const notes = await notesForVisit(pool, req.user.tenant_id, visitId);
  if (!notes.length) return res.status(422).json({ error: 'This visit has no notes to summarise — record notes first.' });

  let out;
  try {
    out = await discharge.generateSummary({ tenantId: req.user.tenant_id, userId: req.user.id, notes, patient });
  } catch (err) {
    if (err && (err.code === 'MODEL_OUTPUT' || err.status === 502)) return res.status(502).json({ error: err.message });
    if (/JSON|model response/i.test(err.message)) return res.status(502).json({ error: 'The model did not return a usable summary. Please try again.' });
    throw err;
  }

  const { rows } = await pool.query(
    `INSERT INTO discharge_summaries (tenant_id, visit_id, patient_ref, summary, status, model, created_by)
     VALUES ($1,$2,$3,$4::jsonb,'draft',$5,$6) RETURNING *`,
    [req.user.tenant_id, visitId, patient.uhid || patient.name, JSON.stringify(out.summary), out.model, req.user.id]
  );
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Kabir',
    action: 'Discharge summary drafted', decision: 'created', entityType: 'discharge', entityId: rows[0].id,
    patientRef: patient.uhid || patient.name, model: out.model, summary: out.summary.diagnosis || null,
  });
  res.status(201).json({ discharge: rows[0] });
};

exports.getDischarge = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM discharge_summaries WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
  if (!rows.length) return res.status(404).json({ error: 'Discharge summary not found' });
  res.json({ discharge: rows[0] });
};

exports.updateDischarge = async (req, res) => {
  const { rows: ex } = await pool.query('SELECT status, summary FROM discharge_summaries WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
  if (!ex.length) return res.status(404).json({ error: 'Not found' });
  if (ex[0].status === 'signed') return res.status(409).json({ error: 'A signed summary cannot be edited' });
  const summary = req.body?.summary;
  if (!summary) return res.status(400).json({ error: 'summary required' });
  const changed = JSON.stringify(summary) !== JSON.stringify(ex[0].summary);
  const { rows } = await pool.query(
    `UPDATE discharge_summaries SET summary=$1::jsonb, edited = (edited OR $2), updated_at=NOW()
      WHERE id=$3 AND tenant_id=$4 RETURNING *`,
    [JSON.stringify(summary), changed, req.params.id, req.user.tenant_id]
  );
  res.json({ discharge: rows[0] });
};

exports.signDischarge = async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE discharge_summaries SET status='signed', signed_by=$1, signed_at=NOW(), updated_at=NOW()
      WHERE id=$2 AND tenant_id=$3 AND status='draft' RETURNING *`,
    [req.user.id, req.params.id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Open summary not found' });
  const d = rows[0];
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Kabir',
    action: d.edited ? 'Discharge summary edited & signed' : 'Discharge summary signed',
    decision: d.edited ? 'modified' : 'signed', entityType: 'discharge', entityId: d.id,
    patientRef: d.patient_ref, summary: (d.summary && d.summary.diagnosis) || null,
  });
  res.json({ discharge: d });
};

// ── Follow-up scheduling (reuses visits) ──────────────────────────────────────
exports.scheduleFollowUp = async (req, res) => {
  const patientId = Number(req.body?.patient_id);
  const when = req.body?.appointment_at;
  if (!patientId || !when) return res.status(400).json({ error: 'patient_id and appointment_at are required' });
  const { rows: p } = await pool.query('SELECT uhid, name FROM patients WHERE id=$1 AND tenant_id=$2', [patientId, req.user.tenant_id]);
  if (!p.length) return res.status(404).json({ error: 'Patient not found' });

  const { rows: tk } = await pool.query(
    `SELECT COALESCE(MAX(token_no),0)+1 AS next FROM visits WHERE tenant_id=$1 AND created_at::date = CURRENT_DATE`, [req.user.tenant_id]
  );
  const { rows } = await pool.query(
    `INSERT INTO visits (tenant_id, patient_id, department, token_no, appointment_at, status, reason, patient_type, visit_type, created_by)
     VALUES ($1,$2,$3,$4,$5,'scheduled',$6,'schedule','OPD',$7) RETURNING *`,
    [req.user.tenant_id, patientId, (req.body?.department || '').trim() || null, tk[0].next, when, (req.body?.reason || 'Follow-up').trim(), req.user.id]
  );
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Kabir',
    action: `Follow-up scheduled · ${new Date(when).toLocaleDateString()}`, decision: 'created',
    entityType: 'visit', entityId: rows[0].id, patientRef: p[0].uhid || p[0].name,
    summary: rows[0].reason, metadata: { appointment_at: when },
  });
  res.status(201).json({ visit: rows[0] });
};
