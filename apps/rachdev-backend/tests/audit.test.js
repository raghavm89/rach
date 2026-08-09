'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const audit = require('../src/services/audit');

test('audit service exposes record/list/summary and a decision vocabulary', () => {
  for (const m of ['record', 'list', 'summary']) assert.equal(typeof audit[m], 'function', `missing ${m}`);
  for (const d of ['created', 'confirmed', 'signed', 'assigned', 'completed', 'cancelled']) {
    assert.ok(audit.DECISIONS.has(d), `missing decision ${d}`);
  }
});

test('audit.record never throws, even with a bad payload (best-effort)', async () => {
  await assert.doesNotReject(audit.record(null));
  await assert.doesNotReject(audit.record({}));           // missing tenant/action → no-op
});

test('auditController exposes list + summary', () => {
  const ctrl = require('../src/controllers/auditController');
  for (const m of ['list', 'summary']) assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
});

test('065 migration creates an append-only audit_log with the key columns', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', '065_audit_log.sql'),
    'utf8',
  );
  assert.match(sql, /CREATE TABLE IF NOT EXISTS audit_log/);
  for (const col of ['tenant_id', 'actor_id', 'agent', 'action', 'decision', 'patient_ref', 'source', 'model']) {
    assert.match(sql, new RegExp(`\\b${col}\\b`), `column ${col} missing`);
  }
});

test('clinical flows write to the audit trail at each decision point', () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', p), 'utf8');
  const scribe = read('scribeController.js');
  const reception = read('receptionController.js');
  const opd = read('opdController.js');
  assert.match(scribe, /audit\.record[\s\S]*decision: 'created'/);
  assert.match(scribe, /'modified' : 'signed'/);          // sign-off (as-is or edited)
  assert.match(reception, /'modified' : 'confirmed'/);     // intake accept (as-is or edited)
  assert.match(opd, /audit\.record[\s\S]*decision: 'assigned'/);
  assert.match(opd, /decision: status,/); // completed / cancelled
});

test('edited AI drafts log modified, discards log overridden', () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', p), 'utf8');
  const scribe = read('scribeController.js');
  const reception = read('receptionController.js');
  // Sign chooses modified vs signed by the sticky edited flag.
  assert.match(scribe, /wasEdited \? 'modified' : 'signed'/);
  assert.match(scribe, /decision: 'overridden'/);       // draft discarded
  assert.match(reception, /'modified' : 'confirmed'/);
  assert.match(reception, /decision: 'overridden'/);
});

test("'consent' is part of the audit vocabulary and 066/067 migrations exist", () => {
  assert.ok(audit.DECISIONS.has('consent'));
  const mig = (n) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', n), 'utf8');
  assert.match(mig('066_edited_flags.sql'), /ADD COLUMN IF NOT EXISTS edited BOOLEAN/);
  assert.match(mig('067_patient_consent.sql'), /CREATE TABLE IF NOT EXISTS patient_consents/);
  assert.match(mig('067_patient_consent.sql'), /purpose\s+TEXT/);
});

test('opdController exposes consent endpoints and records a consent decision', () => {
  const ctrl = require('../src/controllers/opdController');
  for (const m of ['recordConsent', 'getConsent']) assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  const opd = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'opdController.js'), 'utf8');
  assert.match(opd, /decision: 'consent'/);
});
