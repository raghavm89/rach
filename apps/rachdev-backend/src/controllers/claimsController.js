'use strict';

const { pool } = require('@rach/core');
const coding = require('../services/coding');
const audit = require('../services/audit');

const PAYERS = new Set(['ECHS', 'CGHS', 'ex-serviceman', 'self', 'TPA']);

// POST /api/claims — generate a claim draft from a signed note
exports.generate = async (req, res) => {
  const noteId = req.body?.note_id ? Number(req.body.note_id) : null;
  const payer = PAYERS.has(req.body?.payer) ? req.body.payer : 'ECHS';
  if (!noteId) return res.status(400).json({ error: 'note_id is required' });

  const { rows: n } = await pool.query('SELECT * FROM clinical_notes WHERE id=$1 AND tenant_id=$2', [noteId, req.user.tenant_id]);
  if (!n.length) return res.status(404).json({ error: 'Note not found' });
  const note = n[0];
  if (note.status !== 'signed') return res.status(422).json({ error: 'Only a signed note can be coded into a claim' });

  let out;
  try {
    out = await coding.generateClaim({ tenantId: req.user.tenant_id, userId: req.user.id, note, payer });
  } catch (err) {
    if (err && (err.code === 'MODEL_OUTPUT' || err.status === 502)) return res.status(502).json({ error: err.message });
    if (/JSON|model response/i.test(err.message)) return res.status(502).json({ error: 'The model did not return a usable claim. Please try again.' });
    throw err;
  }
  const c = out.claim;

  const { rows } = await pool.query(
    `INSERT INTO claims
       (tenant_id, note_id, visit_id, created_by, patient_ref, payer, codes, charges, total_amount,
        denial_risk, denial_reasons, notes, status, model)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11::jsonb,$12,'draft',$13)
     RETURNING *`,
    [
      req.user.tenant_id, noteId, note.visit_id || null, req.user.id, note.patient_ref, payer,
      JSON.stringify(c.codes), JSON.stringify(c.charges), c.total,
      c.denial_risk, JSON.stringify(c.denial_reasons), c.notes, out.model,
    ]
  );
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Rhea',
    action: `Claim drafted · ${payer} · ₹${c.total}`,
    decision: c.denial_risk === 'high' ? 'flagged' : 'created',
    entityType: 'claim', entityId: rows[0].id, patientRef: note.patient_ref, model: out.model,
    summary: `${c.codes.length} codes · denial risk ${c.denial_risk}`, metadata: { payer, total: c.total, denial_risk: c.denial_risk, reasons: c.denial_reasons },
  });
  res.status(201).json({ claim: rows[0] });
};

// GET /api/claims?status=
exports.list = async (req, res) => {
  const status = req.query.status && ['draft', 'submitted', 'paid', 'denied'].includes(req.query.status) ? req.query.status : null;
  const params = [req.user.tenant_id];
  let where = 'tenant_id = $1';
  if (status) { params.push(status); where += ` AND status = $${params.length}`; }
  const { rows } = await pool.query(
    `SELECT id, patient_ref, payer, total_amount, currency, denial_risk, status, created_at, submitted_at
       FROM claims WHERE ${where} ORDER BY (status <> 'draft'), created_at DESC LIMIT 100`,
    params
  );
  res.json({ claims: rows });
};

// GET /api/claims/:id
exports.get = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM claims WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
  if (!rows.length) return res.status(404).json({ error: 'Claim not found' });
  res.json({ claim: rows[0] });
};

// PATCH /api/claims/:id — coder edits codes/charges/payer before submitting
exports.update = async (req, res) => {
  const { rows: ex } = await pool.query('SELECT status FROM claims WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
  if (!ex.length) return res.status(404).json({ error: 'Claim not found' });
  if (ex[0].status !== 'draft') return res.status(409).json({ error: 'A submitted claim cannot be edited' });

  const { codes, charges, payer, denial_risk, notes } = req.body ?? {};
  const total = Array.isArray(charges) ? charges.reduce((s, c) => s + (Number(c.amount) || 0), 0) : null;
  const { rows } = await pool.query(
    `UPDATE claims SET
       codes          = COALESCE($1::jsonb, codes),
       charges        = COALESCE($2::jsonb, charges),
       total_amount   = COALESCE($3, total_amount),
       payer          = COALESCE($4, payer),
       denial_risk    = COALESCE($5, denial_risk),
       notes          = COALESCE($6, notes),
       edited         = TRUE,
       updated_at     = NOW()
     WHERE id = $7 AND tenant_id = $8 RETURNING *`,
    [
      codes ? JSON.stringify(codes) : null,
      charges ? JSON.stringify(charges) : null,
      total,
      payer && PAYERS.has(payer) ? payer : null,
      denial_risk && coding.RISK.includes(denial_risk) ? denial_risk : null,
      notes ?? null,
      req.params.id, req.user.tenant_id,
    ]
  );
  res.json({ claim: rows[0] });
};

// POST /api/claims/:id/submit — coder submits the claim (requires codes)
exports.submit = async (req, res) => {
  const { rows: ex } = await pool.query('SELECT * FROM claims WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
  if (!ex.length) return res.status(404).json({ error: 'Claim not found' });
  const claim = ex[0];
  if (claim.status !== 'draft') return res.status(409).json({ error: 'Claim is already submitted' });
  if (!Array.isArray(claim.codes) || claim.codes.length === 0) return res.status(422).json({ error: 'Add at least one code before submitting' });

  const { rows } = await pool.query(
    `UPDATE claims SET status='submitted', submitted_by=$1, submitted_at=NOW(), updated_at=NOW()
      WHERE id=$2 AND tenant_id=$3 RETURNING *`,
    [req.user.id, req.params.id, req.user.tenant_id]
  );
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Rhea',
    action: `Claim submitted · ${claim.payer} · ₹${claim.total_amount}`,
    decision: claim.edited ? 'modified' : 'confirmed', entityType: 'claim', entityId: claim.id,
    patientRef: claim.patient_ref, summary: `${(claim.codes || []).length} codes · denial risk ${claim.denial_risk}`,
    metadata: { payer: claim.payer, total: Number(claim.total_amount), denial_risk: claim.denial_risk },
  });
  res.json({ claim: rows[0] });
};
