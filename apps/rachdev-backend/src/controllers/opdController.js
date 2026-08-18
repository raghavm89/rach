'use strict';

/**
 * OPD reception (Dhanvantri-style): patient master + visits (registration, token
 * queue, appointments). Designed HIS-generic; Dhanvantri data syncs in via the
 * dhanvantri seam using source_system + external_id.
 */

const { pool } = require('@rach/core');
const dhanvantri = require('../services/dhanvantri');
const { assignUhid } = require('../services/patientId');
const doctorAssign = require('../services/doctorAssign');
const audit = require('../services/audit');

const VISIT_STATUSES = ['scheduled', 'waiting', 'in_consultation', 'completed', 'cancelled'];

// Doctors + their department (if profiled) and today's active load, for assignment.
async function loadDoctorRoster(client, tenantId) {
  const { rows } = await client.query(
    `SELECT u.id, u.name, dp.department,
            COALESCE(load.cnt, 0)::int AS active_load
       FROM users u
       LEFT JOIN doctor_profiles dp ON dp.user_id = u.id AND dp.tenant_id = u.tenant_id AND dp.active
       LEFT JOIN (
         SELECT doctor_id, COUNT(*) AS cnt FROM visits
          WHERE tenant_id = $1 AND doctor_id IS NOT NULL
            AND status IN ('waiting', 'in_consultation')
            AND created_at::date = CURRENT_DATE
          GROUP BY doctor_id
       ) load ON load.doctor_id = u.id
      WHERE u.tenant_id = $1 AND u.role = 'doctor'
      ORDER BY u.name`,
    [tenantId]
  );
  return rows;
}

// Notes captured for a SPECIFIC visit (a visit is "documented" only by notes
// linked to it — not by other notes that merely share the same patient).
async function notesForVisit(client, tenantId, visitId) {
  const { rows } = await client.query(
    `SELECT id, patient_ref, soap, status, signed_at, created_at, updated_at
       FROM clinical_notes
      WHERE tenant_id = $1 AND visit_id = $2
      ORDER BY updated_at DESC`,
    [tenantId, visitId]
  );
  return rows;
}

// ── Patients ──────────────────────────────────────────────────────────────────

// GET /api/reception/patients?q=
exports.searchPatients = async (req, res) => {
  const q = String(req.query.q || '').trim();
  const params = [req.user.tenant_id];
  let where = 'tenant_id = $1';
  if (q) {
    params.push(`%${q.toLowerCase()}%`, q);
    where += ` AND (lower(name) LIKE $2 OR uhid = $3 OR phone = $3 OR external_id = $3)`;
  }
  const { rows } = await pool.query(
    `SELECT * FROM patients WHERE ${where} ORDER BY updated_at DESC LIMIT 25`, params
  );
  res.json({ patients: rows, dhanvantri: dhanvantri.enabled() });
};

// POST /api/reception/patients — create or update a patient
exports.upsertPatient = async (req, res) => {
  const { id, name, dob, age, sex, phone, address, military } = req.body ?? {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  const mil = military && typeof military === 'object' ? JSON.stringify(military) : '{}';

  if (id) {
    const { rows } = await pool.query(
      `UPDATE patients SET name=$1, dob=$2, age=$3, sex=$4, phone=$5, address=$6, military=$7::jsonb, updated_at=NOW()
       WHERE id=$8 AND tenant_id=$9 RETURNING *`,
      [String(name).trim(), dob || null, age || null, sex || null, phone || null, address || null, mil, id, req.user.tenant_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Patient not found' });
    return res.json({ patient: rows[0] });
  }

  const { rows } = await pool.query(
    `INSERT INTO patients (tenant_id, name, dob, age, sex, phone, address, military)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
    [req.user.tenant_id, String(name).trim(), dob || null, age || null, sex || null, phone || null, address || null, mil]
  );
  // Assign a UHID/CR number using the tenant's configured prefix.
  await assignUhid(pool, req.user.tenant_id, rows[0].id);
  const { rows: upd } = await pool.query('SELECT * FROM patients WHERE id = $1', [rows[0].id]);
  res.status(201).json({ patient: upd[0] });
};

// Latest standing consent per purpose for a patient (DPDP).
async function consentFor(client, tenantId, patientId) {
  const { rows } = await client.query(
    `SELECT DISTINCT ON (purpose) purpose, granted, method, notes, created_at
       FROM patient_consents
      WHERE tenant_id = $1 AND patient_id = $2
      ORDER BY purpose, created_at DESC`,
    [tenantId, patientId]
  );
  return rows;
}

// GET /api/reception/patients/:id
exports.getPatient = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM patients WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
  if (!rows.length) return res.status(404).json({ error: 'Patient not found' });
  const consent = await consentFor(pool, req.user.tenant_id, req.params.id);
  res.json({ patient: rows[0], consent });
};

// GET /api/reception/patients/:id/consent — full consent history
exports.getConsent = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.*, u.name AS captured_by_name FROM patient_consents c
       LEFT JOIN users u ON u.id = c.captured_by
      WHERE c.tenant_id = $1 AND c.patient_id = $2 ORDER BY c.created_at DESC`,
    [req.user.tenant_id, req.params.id]
  );
  res.json({ consents: rows });
};

// POST /api/reception/patients/:id/consent — record a DPDP consent decision
const CONSENT_PURPOSES = new Set(['treatment', 'data_processing', 'echs_claim', 'research']);
const CONSENT_METHODS = new Set(['verbal', 'written', 'digital']);
exports.recordConsent = async (req, res) => {
  const purpose = CONSENT_PURPOSES.has(req.body?.purpose) ? req.body.purpose : 'treatment';
  const method = CONSENT_METHODS.has(req.body?.method) ? req.body.method : 'verbal';
  const granted = req.body?.granted === undefined ? true : Boolean(req.body.granted);
  const notes = req.body?.notes ? String(req.body.notes).trim() : null;

  const { rows: p } = await pool.query('SELECT id, uhid, name FROM patients WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
  if (!p.length) return res.status(404).json({ error: 'Patient not found' });

  const { rows } = await pool.query(
    `INSERT INTO patient_consents (tenant_id, patient_id, purpose, granted, method, notes, captured_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.tenant_id, req.params.id, purpose, granted, method, notes, req.user.id]
  );
  await audit.record({
    tenantId: req.user.tenant_id, actorId: req.user.id, agent: null,
    action: `DPDP consent ${granted ? 'granted' : 'withdrawn'} · ${purpose}`, decision: 'consent',
    entityType: 'patient', entityId: Number(req.params.id),
    patientRef: p[0].uhid || p[0].name, source: method,
    summary: notes || `${purpose} · ${method}`, metadata: { purpose, granted, method },
  });
  res.status(201).json({ consent: rows[0] });
};

// ── Doctors (for visit assignment) ────────────────────────────────────────────

// GET /api/reception/doctors — roster with department + today's active load
exports.listDoctors = async (req, res) => {
  const client = await pool.connect();
  try {
    const doctors = await loadDoctorRoster(client, req.user.tenant_id);
    res.json({ doctors });
  } finally {
    client.release();
  }
};

// ── Visits (registration / token / queue / appointments) ──────────────────────

// POST /api/reception/visits — register a visit and issue a token
const PATIENT_TYPES = new Set(['routine', 'urgent', 'schedule']);
const VISIT_TYPES = new Set(['OPD', 'AME', 'PME']);

exports.createVisit = async (req, res) => {
  const { patient_id, department, doctor_id, appointment_at, reason } = req.body ?? {};
  const patient_type = PATIENT_TYPES.has(req.body?.patient_type) ? req.body.patient_type : 'routine';
  const visit_type = VISIT_TYPES.has(req.body?.visit_type) ? req.body.visit_type : 'OPD';
  const referral_hospital = req.body?.referral_hospital ? String(req.body.referral_hospital).trim() : null;
  const referred_by = req.body?.referred_by ? String(req.body.referred_by).trim() : null;
  if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: p } = await client.query('SELECT id FROM patients WHERE id=$1 AND tenant_id=$2', [patient_id, req.user.tenant_id]);
    if (!p.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Patient not found' }); }

    let doctorName = null;
    if (doctor_id) {
      const { rows: d } = await client.query(`SELECT name FROM users WHERE id=$1 AND tenant_id=$2 AND role='doctor'`, [doctor_id, req.user.tenant_id]);
      doctorName = d[0]?.name ?? null;
    }

    // Per-tenant, per-day token serial.
    const { rows: tk } = await client.query(
      `SELECT COALESCE(MAX(token_no),0)+1 AS next FROM visits
        WHERE tenant_id=$1 AND created_at::date = CURRENT_DATE`, [req.user.tenant_id]
    );
    const token = tk[0].next;
    // 'schedule' patient type or an appointment time → scheduled; else a walk-in queue entry.
    const status = (appointment_at || patient_type === 'schedule') ? 'scheduled' : 'waiting';

    const { rows } = await client.query(
      `INSERT INTO visits (tenant_id, patient_id, department, doctor_id, doctor_name, token_no,
                           appointment_at, status, reason, patient_type, visit_type, referral_hospital, referred_by, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [req.user.tenant_id, patient_id, department || null, doctor_id || null, doctorName, token,
       appointment_at || null, status, reason || null, patient_type, visit_type, referral_hospital, referred_by, req.user.id]
    );
    // Enrich for the token slip (hospital name + patient identity).
    const { rows: full } = await client.query(
      `SELECT v.*, p.name AS patient_name, p.uhid, t.name AS hospital_name
         FROM visits v JOIN patients p ON p.id = v.patient_id JOIN tenants t ON t.id = v.tenant_id
        WHERE v.id = $1`, [rows[0].id]
    );
    await client.query('COMMIT');
    res.status(201).json({ visit: full[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// GET /api/reception/visits?scope=today|all&mine=1
// mine=1 restricts to the caller's assigned visits (a doctor's own patient list).
exports.listVisits = async (req, res) => {
  const scope = req.query.scope === 'all' ? 'all' : 'today';
  const mine = req.query.mine === '1' || req.query.mine === 'true';
  const params = [req.user.tenant_id];
  let where = 'v.tenant_id = $1';
  if (scope === 'today') where += ' AND v.created_at::date = CURRENT_DATE';
  if (mine) { params.push(req.user.id); where += ` AND v.doctor_id = $${params.length}`; }
  const { rows } = await pool.query(
    `SELECT v.*, p.name AS patient_name, p.uhid, p.phone
       FROM visits v JOIN patients p ON p.id = v.patient_id
      WHERE ${where}
      ORDER BY (v.status = 'completed' OR v.status = 'cancelled'),
               v.appointment_at NULLS LAST, v.token_no NULLS LAST, v.created_at`,
    params
  );
  res.json({ visits: rows });
};

// GET /api/reception/visits/:id — full detail: patient (+military), doctor, notes
exports.getVisit = async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT v.*, p.name AS patient_name, p.uhid, p.phone, p.age, p.sex, p.address, p.military,
              t.name AS hospital_name, d.name AS doctor_name
         FROM visits v
         JOIN patients p ON p.id = v.patient_id
         JOIN tenants  t ON t.id = v.tenant_id
         LEFT JOIN users d ON d.id = v.doctor_id
        WHERE v.id = $1 AND v.tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Visit not found' });
    const visit = rows[0];
    const notes = await notesForVisit(client, req.user.tenant_id, visit.id);
    const consent = await consentFor(client, req.user.tenant_id, visit.patient_id);
    res.json({ visit, notes, consent });
  } finally {
    client.release();
  }
};

// POST /api/reception/visits/:id/assign — assign a doctor.
// Body { doctor_id } → manual; omitted → AI picks the best available for the dept.
exports.assignDoctor = async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows: v } = await client.query('SELECT * FROM visits WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
    if (!v.length) return res.status(404).json({ error: 'Visit not found' });
    const visit = v[0];

    const manual = !!(req.body && req.body.doctor_id);
    let doctorId = manual ? Number(req.body.doctor_id) : null;
    let rationale = 'Assigned manually.';
    let pickModel = null;

    if (doctorId) {
      const { rows: d } = await client.query(`SELECT name FROM users WHERE id=$1 AND tenant_id=$2 AND role='doctor'`, [doctorId, req.user.tenant_id]);
      if (!d.length) return res.status(400).json({ error: 'Selected user is not a doctor in this hospital' });
    } else {
      const candidates = await loadDoctorRoster(client, req.user.tenant_id);
      if (!candidates.length) return res.status(409).json({ error: 'No doctors are available to assign' });
      const pick = await doctorAssign.pickDoctor({
        tenantId: req.user.tenant_id, userId: req.user.id, department: visit.department, candidates,
      });
      if (!pick) return res.status(409).json({ error: 'Could not determine a doctor to assign' });
      doctorId = pick.doctor_id;
      rationale = pick.rationale;
      pickModel = pick.model || null;
    }

    const { rows } = await client.query(
      `UPDATE visits SET doctor_id = $1,
              doctor_name = (SELECT name FROM users WHERE id = $1),
              updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [doctorId, req.params.id, req.user.tenant_id]
    );
    const { rows: pr } = await client.query(
      'SELECT p.uhid, p.name FROM patients p WHERE p.id = $1', [rows[0].patient_id]
    );
    await audit.record({
      tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Kabir',
      action: `Doctor ${manual ? 'assigned' : 'auto-assigned'}: ${rows[0].doctor_name}`,
      decision: 'assigned', entityType: 'visit', entityId: rows[0].id,
      patientRef: pr[0]?.uhid || pr[0]?.name || null, source: manual ? 'manual' : 'ai', model: pickModel,
      summary: rationale, metadata: { doctor_id: doctorId, department: visit.department },
    });
    res.json({ visit: rows[0], rationale });
  } finally {
    client.release();
  }
};

// PATCH /api/reception/visits/:id — advance status (start / complete / cancel)
exports.updateVisit = async (req, res) => {
  const status = VISIT_STATUSES.includes(req.body?.status) ? req.body.status : null;
  const client = await pool.connect();
  try {
    // Completing a consultation requires an assigned doctor AND a recorded note.
    if (status === 'completed') {
      const { rows: v } = await client.query(
        `SELECT v.doctor_id, p.uhid, p.name FROM visits v JOIN patients p ON p.id = v.patient_id
          WHERE v.id = $1 AND v.tenant_id = $2`,
        [req.params.id, req.user.tenant_id]
      );
      if (!v.length) return res.status(404).json({ error: 'Visit not found' });
      if (!v[0].doctor_id) return res.status(422).json({ error: 'Assign a doctor before completing this visit.' });
      const notes = await notesForVisit(client, req.user.tenant_id, req.params.id);
      if (!notes.length) return res.status(422).json({ error: "Record the doctor's notes before completing this visit." });
    }

    const sets = [];
    const args = [];
    if (status) { args.push(status); sets.push(`status = $${args.length}`); }
    if (req.body?.doctor_id !== undefined) { args.push(req.body.doctor_id || null); sets.push(`doctor_id = $${args.length}`); }
    if (req.body?.department !== undefined) { args.push(req.body.department || null); sets.push(`department = $${args.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'nothing to update' });

    args.push(req.params.id, req.user.tenant_id);
    const { rows } = await client.query(
      `UPDATE visits SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${args.length - 1} AND tenant_id = $${args.length}
       RETURNING *`,
      args
    );
    if (!rows.length) return res.status(404).json({ error: 'Visit not found' });

    // Log the closing decisions (completed / cancelled) to the audit trail.
    if (status === 'completed' || status === 'cancelled') {
      const { rows: pr } = await client.query('SELECT uhid, name FROM patients WHERE id = $1', [rows[0].patient_id]);
      await audit.record({
        tenantId: req.user.tenant_id, actorId: req.user.id, agent: 'Kabir',
        action: status === 'completed' ? 'Visit completed' : 'Visit cancelled',
        decision: status, entityType: 'visit', entityId: rows[0].id,
        patientRef: pr[0]?.uhid || pr[0]?.name || null, source: 'manual',
        summary: rows[0].department ? `${rows[0].visit_type || 'OPD'} · ${rows[0].department}` : null,
      });
    }
    res.json({ visit: rows[0] });
  } finally {
    client.release();
  }
};
