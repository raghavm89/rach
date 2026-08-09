'use strict';

const { pool } = require('@rach/core');
const echs = require('../services/echs');
const abdm = require('../services/abdm');
const audit = require('../services/audit');

// POST /api/echs/eligibility — verify a patient's ECHS eligibility
exports.verifyEligibility = async (req, res) => {
  const patientId = Number(req.body?.patient_id);
  if (!patientId) return res.status(400).json({ error: 'patient_id is required' });
  const { rows: p } = await pool.query('SELECT * FROM patients WHERE id=$1 AND tenant_id=$2', [patientId, req.user.tenant_id]);
  if (!p.length) return res.status(404).json({ error: 'Patient not found' });
  const patient = p[0];

  const r = await echs.verifyEligibility(patient);
  const { rows } = await pool.query(
    `INSERT INTO eligibility_checks
       (tenant_id, patient_id, payer, kind, eligible, valid_from, valid_to, category, cashless, status, remarks, source, raw, created_by)
     VALUES ($1,$2,'ECHS','eligibility',$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12) RETURNING *`,
    [req.user.tenant_id, patientId, r.eligible, r.valid_from, r.valid_to, r.category, r.cashless, r.status, r.remarks, r.source, JSON.stringify(r.raw), req.user.id]
  );
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Asha',
    action: `ECHS eligibility ${r.eligible ? 'verified' : 'not eligible'}${r.source === 'stub' ? ' (demo)' : ''}`,
    decision: r.eligible ? 'created' : 'flagged', entityType: 'eligibility', entityId: rows[0].id,
    patientRef: patient.uhid || patient.name, source: r.source,
    summary: r.remarks, metadata: { valid_to: r.valid_to, category: r.category, cashless: r.cashless },
  });
  res.status(201).json({ check: rows[0], live: echs.enabled() });
};

// GET /api/echs/eligibility/:patientId — latest check for a patient
exports.latestEligibility = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM eligibility_checks WHERE tenant_id=$1 AND patient_id=$2 AND kind='eligibility'
      ORDER BY created_at DESC LIMIT 1`,
    [req.user.tenant_id, req.params.patientId]
  );
  res.json({ check: rows[0] || null, live: echs.enabled() });
};

// POST /api/echs/preauth — raise a cashless pre-auth for a claim
exports.preAuth = async (req, res) => {
  const claimId = Number(req.body?.claim_id);
  if (!claimId) return res.status(400).json({ error: 'claim_id is required' });
  const { rows: c } = await pool.query('SELECT * FROM claims WHERE id=$1 AND tenant_id=$2', [claimId, req.user.tenant_id]);
  if (!c.length) return res.status(404).json({ error: 'Claim not found' });
  const claim = c[0];

  const r = await echs.preAuth({ amount: Number(claim.total_amount), denial_risk: claim.denial_risk });
  const { rows } = await pool.query(
    `INSERT INTO eligibility_checks
       (tenant_id, patient_id, claim_id, payer, kind, reference_id, amount, status, remarks, source, raw, created_by)
     VALUES ($1,$2,$3,$4,'preauth',$5,$6,$7,$8,$9,$10::jsonb,$11) RETURNING *`,
    [req.user.tenant_id, null, claimId, claim.payer, r.reference_id, r.amount, r.status, r.remarks, r.source,
     JSON.stringify(r.raw), req.user.id]
  );
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Rhea',
    action: `ECHS pre-auth ${r.status}${r.source === 'stub' ? ' (demo)' : ''} · ₹${r.amount}`,
    decision: r.status === 'approved' ? 'created' : 'flagged', entityType: 'preauth', entityId: rows[0].id,
    patientRef: claim.patient_ref, source: r.source,
    summary: `${r.reference_id} — ${r.remarks}`, metadata: { claim_id: claimId, amount: r.amount, status: r.status },
  });
  res.status(201).json({ check: rows[0], live: echs.enabled() });
};

// POST /api/abdm/patients/:id/abha — link/verify a patient's ABHA
exports.linkAbha = async (req, res) => {
  const { rows: p } = await pool.query('SELECT * FROM patients WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
  if (!p.length) return res.status(404).json({ error: 'Patient not found' });
  const patient = p[0];

  const r = await abdm.linkAbha(patient, { abha_address: req.body?.abha_address, abha_number: req.body?.abha_number });
  const { rows } = await pool.query(
    `UPDATE patients SET abha_number=$1, abha_address=$2, updated_at=NOW() WHERE id=$3 AND tenant_id=$4
     RETURNING id, name, uhid, abha_number, abha_address`,
    [r.abha_number, r.abha_address, req.params.id, req.user.tenant_id]
  );
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Asha',
    action: `ABHA linked${r.source === 'stub' ? ' (demo)' : ''}`, decision: 'created',
    entityType: 'patient', entityId: Number(req.params.id), patientRef: patient.uhid || patient.name, source: r.source,
    summary: `${r.abha_address} · ${r.abha_number}`, metadata: { abha_address: r.abha_address },
  });
  res.json({ patient: rows[0], live: abdm.enabled() });
};
