'use strict';

const { pool } = require('@rach/core');
const reception = require('../services/reception');
const audit = require('../services/audit');

const VALID_SOURCES = new Set(['text', 'dictation', 'asr']);

// POST /api/reception/encounters — structure an intake from a transcript, persist a draft
exports.create = async (req, res) => {
  const { transcript, patient_ref, source, encounter_id } = req.body ?? {};
  if (!transcript || !String(transcript).trim()) {
    return res.status(400).json({ error: 'transcript is required' });
  }
  const src = VALID_SOURCES.has(source) ? source : 'text';
  const ref = (patient_ref || '').trim() || null;

  // Resolve the attached patient (if any) up front, so we can (a) give the model
  // its demographics — it won't report them as "not collected" — and (b) fill
  // identity into the result afterward.
  let attached = null;
  if (ref) {
    const { rows: pm } = await pool.query(
      `SELECT name, age, sex FROM patients
         WHERE tenant_id = $1 AND (uhid = $2 OR phone = $2 OR lower(name) = lower($2)) LIMIT 1`,
      [req.user.tenant_id, ref]
    );
    attached = pm[0] || null;
  }

  const { intake, model } = await reception.generateIntake({
    tenantId: req.user.tenant_id,
    userId:   req.user.id,
    transcript,
    patient: attached ? { name: attached.name, age: attached.age, sex: attached.sex } : null,
  });

  // The attached record is the source of truth for identity — fill Name/Age/Sex.
  if (attached) {
    const cur = intake.patient || {};
    intake.patient = {
      name: attached.name || cur.name || '',
      age: (attached.age != null && String(attached.age) !== '') ? String(attached.age) : (cur.age || ''),
      sex: attached.sex || cur.sex || '',
    };
  }

  const patientName = intake.patient?.name || null;
  const reason = intake.reason || null;

  // Continue an OPEN draft in place (avoids duplicates when re-generating).
  if (encounter_id) {
    const { rows } = await pool.query(
      `UPDATE encounters
         SET patient_ref = $3, patient_name = $4, reason = $5, intake = $6::jsonb,
             transcript = $7, source = $8, model = $9, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'open'
       RETURNING *`,
      [encounter_id, req.user.tenant_id, ref, patientName, reason,
       JSON.stringify(intake), transcript, src, model]
    );
    if (!rows.length) return res.status(404).json({ error: 'Draft not found or already confirmed' });
    return res.json({ encounter: rows[0] });
  }

  const { rows } = await pool.query(
    `INSERT INTO encounters
       (tenant_id, created_by, patient_ref, patient_name, reason, intake, transcript, source, status, model)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, 'open', $9)
     RETURNING *`,
    [req.user.tenant_id, req.user.id, ref, patientName, reason,
     JSON.stringify(intake), transcript, src, model]
  );
  res.status(201).json({ encounter: rows[0] });
};

// GET /api/reception/encounters — recent encounters for the tenant
exports.list = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, patient_ref, patient_name, reason, source, status, model, confirmed_at, created_at, updated_at
     FROM encounters WHERE tenant_id = $1
     ORDER BY updated_at DESC LIMIT 50`,
    [req.user.tenant_id]
  );
  res.json({ encounters: rows });
};

// GET /api/reception/encounters/:id
exports.get = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM encounters WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Encounter not found' });
  res.json({ encounter: rows[0] });
};

// PATCH /api/reception/encounters/:id — edit an open draft's intake/fields
exports.update = async (req, res) => {
  const { rows: existing } = await pool.query(
    'SELECT status, intake, edited FROM encounters WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user.tenant_id]
  );
  if (!existing.length) return res.status(404).json({ error: 'Encounter not found' });
  if (existing[0].status === 'confirmed') return res.status(409).json({ error: 'A confirmed encounter cannot be edited' });

  const { intake, patient_ref } = req.body ?? {};
  const patientName = intake?.patient?.name ?? undefined;
  const reason = intake?.reason ?? undefined;
  // Sticky "edited" flag: set when reception changes the AI-drafted intake.
  const changed = intake && JSON.stringify(intake) !== JSON.stringify(existing[0].intake);
  const edited = existing[0].edited || !!changed;
  const { rows } = await pool.query(
    `UPDATE encounters SET
       intake       = COALESCE($1::jsonb, intake),
       patient_name = COALESCE($2, patient_name),
       reason       = COALESCE($3, reason),
       patient_ref  = COALESCE($4, patient_ref),
       edited       = $7,
       updated_at   = NOW()
     WHERE id = $5 AND tenant_id = $6
     RETURNING *`,
    [
      intake ? JSON.stringify(intake) : null,
      patientName ?? null,
      reason ?? null,
      patient_ref !== undefined ? (String(patient_ref).trim() || null) : null,
      req.params.id, req.user.tenant_id, edited,
    ]
  );
  res.json({ encounter: rows[0] });
};

// POST /api/reception/encounters/:id/confirm — reception/clinician confirms the
// intake. Confirming also registers the patient into the OPD queue: it resolves
// (or creates) a patient from the intake, opens a waiting visit with a token, and
// links it back to the encounter so a confirmed intake behaves like a walk-in.
exports.confirm = async (req, res) => {
  const tenantId = req.user.tenant_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Confirm the open encounter and read its intake.
    const { rows: enc } = await client.query(
      `UPDATE encounters
         SET status = 'confirmed', confirmed_by = $1, confirmed_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 AND status = 'open'
       RETURNING *`,
      [req.user.id, req.params.id, tenantId]
    );
    if (!enc.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Open encounter not found' }); }
    const encounter = enc[0];

    // Only create a visit once; nothing to do if somehow already linked.
    if (!encounter.visit_id) {
      const intake = encounter.intake || {};
      const p = intake.patient || {};
      const ref = (encounter.patient_ref || '').trim();
      const name = (p.name || encounter.patient_name || ref || 'Unknown').trim();

      // Resolve an existing patient by UHID / phone / exact name, else create one.
      let patientId = null;
      if (ref) {
        const { rows: match } = await client.query(
          `SELECT id FROM patients WHERE tenant_id = $1 AND (uhid = $2 OR phone = $2 OR lower(name) = lower($3)) LIMIT 1`,
          [tenantId, ref, name]
        );
        patientId = match[0]?.id ?? null;
      }
      if (!patientId) {
        const { rows: ins } = await client.query(
          `INSERT INTO patients (tenant_id, name, age, sex) VALUES ($1, $2, $3, $4) RETURNING id`,
          [tenantId, name, p.age || null, p.sex || null]
        );
        patientId = ins[0].id;
        await client.query(`UPDATE patients SET uhid = $1 WHERE id = $2`, ['UH' + String(patientId).padStart(6, '0'), patientId]);
      }

      // Per-tenant, per-day token serial → a waiting OPD visit.
      const { rows: tk } = await client.query(
        `SELECT COALESCE(MAX(token_no),0)+1 AS next FROM visits WHERE tenant_id=$1 AND created_at::date = CURRENT_DATE`,
        [tenantId]
      );
      const { rows: visit } = await client.query(
        `INSERT INTO visits (tenant_id, patient_id, token_no, status, reason, visit_type, patient_type, created_by)
         VALUES ($1, $2, $3, 'waiting', $4, 'OPD', 'routine', $5) RETURNING id`,
        [tenantId, patientId, tk[0].next, intake.reason || encounter.reason || null, req.user.id]
      );
      const { rows: linked } = await client.query(
        `UPDATE encounters SET visit_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [visit[0].id, encounter.id]
      );
      await client.query('COMMIT');
      await audit.record({
        tenantId, actorId: req.user.id, agent: 'Asha',
        action: encounter.edited
          ? 'Patient intake edited & confirmed → OPD visit opened'
          : 'Patient intake confirmed → OPD visit opened',
        decision: encounter.edited ? 'modified' : 'confirmed',
        entityType: 'encounter', entityId: encounter.id,
        patientRef: encounter.patient_ref || encounter.patient_name, source: encounter.source, model: encounter.model,
        summary: encounter.reason || null, metadata: { visit_id: visit[0].id, edited: !!encounter.edited },
      });
      return res.json({ encounter: linked[0] });
    }

    await client.query('COMMIT');
    res.json({ encounter });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// DELETE /api/reception/encounters/:id — remove an OPEN draft
exports.remove = async (req, res) => {
  const { rows } = await pool.query(
    `DELETE FROM encounters WHERE id = $1 AND tenant_id = $2 AND status = 'open'
     RETURNING id, patient_ref, patient_name, source, model`,
    [req.params.id, req.user.tenant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Open draft not found' });
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Asha',
    action: 'AI intake draft discarded', decision: 'overridden', entityType: 'encounter', entityId: rows[0].id,
    patientRef: rows[0].patient_ref || rows[0].patient_name, source: rows[0].source, model: rows[0].model,
  });
  res.json({ ok: true });
};
