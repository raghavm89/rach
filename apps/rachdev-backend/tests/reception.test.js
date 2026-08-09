'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const reception = require('../src/services/reception');

test('buildSystemPrompt keeps a custom persona but always appends the JSON contract', () => {
  assert.ok(reception.buildSystemPrompt().includes('triage_summary'));
  const custom = reception.buildSystemPrompt('Custom reception rules');
  assert.ok(custom.startsWith('Custom reception rules'));
  assert.ok(custom.includes('"triage_summary"'));
});

test('parseIntake normalizes a clean object', () => {
  const out = reception.parseIntake(JSON.stringify({
    patient: { name: 'Karen Mitchell', age: '45', sex: 'F' },
    reason: 'T2DM follow-up',
    history: 'T2DM, HTN',
    medications: ['metformin', 'lisinopril'],
    allergies: [],
    vitals: 'BP 130/80',
    triage_summary: 'Routine follow-up, stable.',
  }));
  assert.equal(out.patient.name, 'Karen Mitchell');
  assert.equal(out.reason, 'T2DM follow-up');
  assert.deepEqual(out.medications, ['metformin', 'lisinopril']);
});

test('parseIntake tolerates fences + missing fields, never throws on shape', () => {
  const out = reception.parseIntake('```json\n{"reason":"cough","medications":["x","",3]}\n```');
  assert.equal(out.reason, 'cough');
  assert.deepEqual(out.medications, ['x']);
  assert.equal(out.patient.name, '');       // missing → empty
  assert.equal(out.triage_summary, '');
});

test('parseIntake throws on empty / non-JSON', () => {
  assert.throws(() => reception.parseIntake(''), /Empty model response/);
  assert.throws(() => reception.parseIntake('nope'), /No JSON object/);
});

test('receptionController exposes the encounter endpoints', () => {
  const ctrl = require('../src/controllers/receptionController');
  for (const m of ['create', 'list', 'get', 'update', 'confirm', 'remove']) {
    assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  }
});

test('encounters migration creates the table with a status column', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', '056_encounters.sql'),
    'utf8',
  );
  assert.match(sql, /CREATE TABLE IF NOT EXISTS encounters/);
  assert.match(sql, /status\s+TEXT\s+NOT NULL DEFAULT 'open'/);
});

test('061 migration links an encounter to the OPD visit it produces', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', '061_encounter_visit.sql'),
    'utf8',
  );
  assert.match(sql, /ALTER TABLE encounters/);
  assert.match(sql, /visit_id\s+INTEGER\s+REFERENCES visits\(id\)/);
});

test('confirm creates a waiting OPD visit and links it back to the encounter', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'receptionController.js'), 'utf8');
  // Confirming must register the patient into the queue, not just flip status.
  assert.match(src, /INSERT INTO visits[\s\S]*'waiting'/);
  assert.match(src, /SET visit_id = \$1/);
});

// ── AI doctor assignment ──────────────────────────────────────────────────────
const doctorAssign = require('../src/services/doctorAssign');

test('leastLoaded prefers the matching department, then the lightest load', () => {
  const cands = [
    { id: 1, name: 'A', department: 'CARDIOLOGY OPD', active_load: 5 },
    { id: 2, name: 'B', department: 'ENT', active_load: 0 },
    { id: 3, name: 'C', department: 'CARDIOLOGY OPD', active_load: 2 },
  ];
  assert.equal(doctorAssign.leastLoaded(cands, 'CARDIOLOGY OPD').id, 3);   // dept match + lightest
  assert.equal(doctorAssign.leastLoaded(cands, 'DENTAL').id, 2);           // no dept match → global lightest
});

test('inDepartment: profile-less doctors are eligible anywhere', () => {
  assert.equal(doctorAssign.inDepartment({ department: null }, 'ENT'), true);
  assert.equal(doctorAssign.inDepartment({ department: 'ENT' }, 'ent'), true);
  assert.equal(doctorAssign.inDepartment({ department: 'ENT' }, 'SURGERY'), false);
});

test('parsePick validates the id and falls back to least-loaded on junk', () => {
  const cands = [{ id: 7, name: 'X', department: null, active_load: 1 }, { id: 9, name: 'Y', department: null, active_load: 0 }];
  assert.equal(doctorAssign.parsePick('{"doctor_id":7,"rationale":"ok"}', cands, null).doctor_id, 7);
  assert.equal(doctorAssign.parsePick('```json\n{"doctor_id": 9}\n```', cands, null).doctor_id, 9);
  assert.equal(doctorAssign.parsePick('nonsense', cands, null).doctor_id, 9);       // fallback: lightest
  assert.equal(doctorAssign.parsePick('{"doctor_id":404}', cands, null).doctor_id, 9); // unknown id → fallback
});

test('opdController exposes detail + assignment endpoints', () => {
  const ctrl = require('../src/controllers/opdController');
  for (const m of ['getVisit', 'assignDoctor', 'updateVisit', 'listDoctors']) {
    assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  }
});

test('completing a visit is gated on an assigned doctor and recorded notes', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'opdController.js'), 'utf8');
  assert.match(src, /Assign a doctor before completing/);
  assert.match(src, /Record the doctor's notes before completing/);
});

test('completion notes are matched to the specific visit, not just the patient', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'opdController.js'), 'utf8');
  // The guard must check notes linked to THIS visit (visit_id), so an old note
  // for the same patient can't satisfy a new visit.
  assert.match(src, /async function notesForVisit\(client, tenantId, visitId\)/);
  assert.match(src, /WHERE tenant_id = \$1 AND visit_id = \$2/);
  assert.doesNotMatch(src, /notesForPatient/);
});

test('scribe note create accepts and stores a visit_id link', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'scribeController.js'), 'utf8');
  assert.match(src, /visit_id/);
});

test('063 migration links clinical notes to visits', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', '063_note_visit.sql'),
    'utf8',
  );
  assert.match(sql, /ALTER TABLE clinical_notes/);
  assert.match(sql, /visit_id\s+INTEGER\s+REFERENCES visits\(id\)/);
});

test('062 migration maps doctors to departments', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', '062_doctor_profiles.sql'),
    'utf8',
  );
  assert.match(sql, /CREATE TABLE IF NOT EXISTS doctor_profiles/);
  assert.match(sql, /department\s+TEXT/);
});
