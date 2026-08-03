'use strict';

const { pool } = require('@rach/core');
const scribe = require('../services/scribe');

const VALID_SOURCES = new Set(['text', 'dictation', 'asr']);

// POST /api/scribe/notes — generate a SOAP draft from a transcript and persist it
exports.create = async (req, res) => {
  const { transcript, patient_ref, source } = req.body ?? {};
  if (!transcript || !String(transcript).trim()) {
    return res.status(400).json({ error: 'transcript is required' });
  }
  const src = VALID_SOURCES.has(source) ? source : 'text';

  const note = await scribe.generateNote({
    tenantId: req.user.tenant_id,
    userId:   req.user.id,
    transcript,
  });

  const { rows } = await pool.query(
    `INSERT INTO clinical_notes
       (tenant_id, author_id, patient_ref, transcript, source, soap, codes, follow_ups, status, model)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, 'draft', $9)
     RETURNING *`,
    [
      req.user.tenant_id, req.user.id, (patient_ref || '').trim() || null,
      transcript, src,
      JSON.stringify(note.soap), JSON.stringify(note.codes), JSON.stringify(note.follow_ups),
      note.model,
    ]
  );
  res.status(201).json({ note: rows[0] });
};

// GET /api/scribe/notes — recent notes for the tenant
exports.list = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, patient_ref, source, status, model, signed_at, created_at, updated_at
     FROM clinical_notes WHERE tenant_id = $1
     ORDER BY updated_at DESC LIMIT 50`,
    [req.user.tenant_id]
  );
  res.json({ notes: rows });
};

// GET /api/scribe/notes/:id
exports.get = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM clinical_notes WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Note not found' });
  res.json({ note: rows[0] });
};

// PATCH /api/scribe/notes/:id — clinician edits the draft before signing
exports.update = async (req, res) => {
  const { rows: existing } = await pool.query(
    'SELECT status FROM clinical_notes WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user.tenant_id]
  );
  if (!existing.length) return res.status(404).json({ error: 'Note not found' });
  if (existing[0].status === 'signed') {
    return res.status(409).json({ error: 'A signed note cannot be edited' });
  }

  const { soap, codes, follow_ups, patient_ref } = req.body ?? {};
  const { rows } = await pool.query(
    `UPDATE clinical_notes SET
       soap        = COALESCE($1::jsonb, soap),
       codes       = COALESCE($2::jsonb, codes),
       follow_ups  = COALESCE($3::jsonb, follow_ups),
       patient_ref = COALESCE($4, patient_ref),
       updated_at  = NOW()
     WHERE id = $5 AND tenant_id = $6
     RETURNING *`,
    [
      soap ? JSON.stringify(soap) : null,
      codes ? JSON.stringify(codes) : null,
      follow_ups ? JSON.stringify(follow_ups) : null,
      patient_ref !== undefined ? (String(patient_ref).trim() || null) : null,
      req.params.id, req.user.tenant_id,
    ]
  );
  res.json({ note: rows[0] });
};

// POST /api/scribe/notes/:id/sign — clinician sign-off (human-in-the-loop gate)
exports.sign = async (req, res) => {
  const { rows: existing } = await pool.query(
    'SELECT status FROM clinical_notes WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user.tenant_id]
  );
  if (!existing.length) return res.status(404).json({ error: 'Note not found' });
  if (existing[0].status === 'signed') {
    return res.status(409).json({ error: 'Note is already signed' });
  }

  const { rows } = await pool.query(
    `UPDATE clinical_notes
       SET status = 'signed', signed_by = $1, signed_at = NOW(), updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3
     RETURNING *`,
    [req.user.id, req.params.id, req.user.tenant_id]
  );
  res.json({ note: rows[0] });
};
