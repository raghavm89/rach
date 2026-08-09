'use strict';

const { pool } = require('@rach/core');
const scribe = require('../services/scribe');
const prescribe = require('../services/prescribe');
const interactions = require('../services/interactions');
const audit = require('../services/audit');

const VALID_SOURCES = new Set(['text', 'dictation', 'asr']);

// POST /api/scribe/notes — generate a SOAP draft from a transcript and persist it
exports.create = async (req, res) => {
  const { transcript, patient_ref, source, note_id } = req.body ?? {};
  if (!transcript || !String(transcript).trim()) {
    return res.status(400).json({ error: 'transcript is required' });
  }
  const src = VALID_SOURCES.has(source) ? source : 'text';
  const ref = (patient_ref || '').trim() || null;
  // Optional link to the OPD visit this note documents (from the My Patients hand-off).
  const visitId = req.body && req.body.visit_id ? Number(req.body.visit_id) : null;

  let note;
  try {
    note = await scribe.generateNote({
      tenantId: req.user.tenant_id,
      userId:   req.user.id,
      transcript,
    });
  } catch (err) {
    // A model that returns unparseable output is a bad-gateway condition, not a
    // server bug — surface the reason to the clinician instead of a blank 500.
    if (err && (err.code === 'MODEL_OUTPUT' || err.status === 502)) {
      return res.status(502).json({ error: err.message });
    }
    throw err;
  }

  // Continue an OPEN draft in place (avoids duplicate drafts from re-generating).
  if (note_id) {
    const { rows } = await pool.query(
      `UPDATE clinical_notes
         SET patient_ref = $3, transcript = $4, source = $5,
             soap = $6::jsonb, codes = $7::jsonb, follow_ups = $8::jsonb,
             model = $9, visit_id = COALESCE($10, visit_id), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
       RETURNING *`,
      [
        note_id, req.user.tenant_id, ref, transcript, src,
        JSON.stringify(note.soap), JSON.stringify(note.codes), JSON.stringify(note.follow_ups),
        note.model, visitId,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Draft not found or already signed' });
    return res.json({ note: rows[0] });
  }

  const { rows } = await pool.query(
    `INSERT INTO clinical_notes
       (tenant_id, author_id, patient_ref, transcript, source, soap, codes, follow_ups, status, model, visit_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, 'draft', $9, $10)
     RETURNING *`,
    [
      req.user.tenant_id, req.user.id, ref,
      transcript, src,
      JSON.stringify(note.soap), JSON.stringify(note.codes), JSON.stringify(note.follow_ups),
      note.model, visitId,
    ]
  );
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Naina',
    action: 'SOAP note drafted', decision: 'created', entityType: 'note', entityId: rows[0].id,
    patientRef: ref, source: src, model: note.model,
    summary: rows[0].soap?.assessment || rows[0].soap?.subjective || null,
  });
  res.status(201).json({ note: rows[0] });
};

// GET /api/scribe/notes — recent notes for the tenant
exports.list = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, patient_ref, source, status, model, signed_at, created_at, updated_at,
            LEFT(COALESCE(NULLIF(soap->>'assessment', ''), NULLIF(soap->>'subjective', ''), ''), 140) AS preview
     FROM clinical_notes WHERE tenant_id = $1
     ORDER BY updated_at DESC LIMIT 50`,
    [req.user.tenant_id]
  );
  res.json({ notes: rows });
};

// DELETE /api/scribe/notes/:id — remove a DRAFT (signed notes are immutable records)
exports.remove = async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM clinical_notes WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
     RETURNING id, patient_ref, source, model`,
    [req.params.id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Draft not found (signed notes cannot be deleted)' });
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Naina',
    action: 'AI draft discarded', decision: 'overridden', entityType: 'note', entityId: rows[0].id,
    patientRef: rows[0].patient_ref, source: rows[0].source, model: rows[0].model,
  });
  res.json({ ok: true });
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
    'SELECT status, soap, codes, follow_ups, edited FROM clinical_notes WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user.tenant_id]
  );
  if (!existing.length) return res.status(404).json({ error: 'Note not found' });
  if (existing[0].status === 'signed') {
    return res.status(409).json({ error: 'A signed note cannot be edited' });
  }

  const { soap, codes, follow_ups, patient_ref, medications } = req.body ?? {};
  // Mark the note as edited (sticky) when the clinician actually changes the AI
  // draft's content — this is what turns a later sign-off into a 'modified' entry.
  const changed =
    (soap && JSON.stringify(soap) !== JSON.stringify(existing[0].soap)) ||
    (codes && JSON.stringify(codes) !== JSON.stringify(existing[0].codes)) ||
    (follow_ups && JSON.stringify(follow_ups) !== JSON.stringify(existing[0].follow_ups)) ||
    (medications && JSON.stringify(medications) !== JSON.stringify(existing[0].medications));
  const edited = existing[0].edited || !!changed;

  const { rows } = await pool.query(
    `UPDATE clinical_notes SET
       soap        = COALESCE($1::jsonb, soap),
       codes       = COALESCE($2::jsonb, codes),
       follow_ups  = COALESCE($3::jsonb, follow_ups),
       patient_ref = COALESCE($4, patient_ref),
       medications = COALESCE($8::jsonb, medications),
       edited      = $7,
       updated_at  = NOW()
     WHERE id = $5 AND tenant_id = $6
     RETURNING *`,
    [
      soap ? JSON.stringify(soap) : null,
      codes ? JSON.stringify(codes) : null,
      follow_ups ? JSON.stringify(follow_ups) : null,
      patient_ref !== undefined ? (String(patient_ref).trim() || null) : null,
      req.params.id, req.user.tenant_id, edited,
      medications ? JSON.stringify(medications) : null,
    ]
  );
  res.json({ note: rows[0], interactions: interactions.checkInteractions(rows[0].medications) });
};

// POST /api/scribe/notes/:id/prescribe — draft a structured e-prescription
exports.prescribe = async (req, res) => {
  const { rows: n } = await pool.query('SELECT * FROM clinical_notes WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
  if (!n.length) return res.status(404).json({ error: 'Note not found' });
  if (n[0].status === 'signed') return res.status(409).json({ error: 'A signed note cannot be re-prescribed' });

  let out;
  try {
    out = await prescribe.generateRx({ tenantId: req.user.tenant_id, userId: req.user.id, transcript: n[0].transcript, plan: n[0].soap?.plan });
  } catch (err) {
    if (err && (err.code === 'MODEL_OUTPUT' || err.status === 502)) return res.status(502).json({ error: err.message });
    if (/JSON|model response/i.test(err.message)) return res.status(502).json({ error: 'The model did not return a usable prescription. Please try again.' });
    throw err;
  }

  const { rows } = await pool.query(
    `UPDATE clinical_notes SET medications = $1::jsonb, updated_at = NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *`,
    [JSON.stringify(out.medications), req.params.id, req.user.tenant_id]
  );
  const warnings = interactions.checkInteractions(out.medications);
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Naina',
    action: `Prescription drafted · ${out.medications.length} item(s)`,
    decision: warnings.some((w) => w.severity === 'major') ? 'flagged' : 'created',
    entityType: 'note', entityId: rows[0].id, patientRef: rows[0].patient_ref, model: out.model,
    summary: out.medications.map((m) => m.drug).join(', ') || null,
    metadata: { interactions: warnings.length, major: warnings.filter((w) => w.severity === 'major').length },
  });
  res.json({ note: rows[0], interactions: warnings });
};

// POST /api/scribe/interactions — stateless drug-interaction screen for a med list
exports.checkInteractions = async (req, res) => {
  res.json({ interactions: interactions.checkInteractions(req.body?.medications) });
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
  const wasEdited = !!rows[0].edited;
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Naina',
    action: wasEdited ? 'SOAP note edited & signed' : 'SOAP note approved & signed',
    decision: wasEdited ? 'modified' : 'signed', entityType: 'note', entityId: rows[0].id,
    patientRef: rows[0].patient_ref, source: rows[0].source, model: rows[0].model,
    summary: rows[0].soap?.assessment || null,
  });
  res.json({ note: rows[0] });
};
