'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const scribe = require('../src/services/scribe');

test('buildSystemPrompt uses the default, or a custom prompt when given', () => {
  assert.ok(scribe.buildSystemPrompt().includes('SOAP'));
  assert.equal(scribe.buildSystemPrompt('Custom scribe rules'), 'Custom scribe rules');
  assert.equal(scribe.buildSystemPrompt('   '), scribe.DEFAULT_SYSTEM_PROMPT);
});

test('parseNote parses a clean JSON object', () => {
  const out = scribe.parseNote(JSON.stringify({
    soap: { subjective: 'S', objective: 'O', assessment: 'A', plan: 'P' },
    codes: [{ system: 'ICD-10-CM', code: 'E11.9', description: 'T2DM' }],
    follow_ups: ['A1c in 3 months'],
  }));
  assert.deepEqual(out.soap, { subjective: 'S', objective: 'O', assessment: 'A', plan: 'P' });
  assert.equal(out.codes[0].code, 'E11.9');
  assert.deepEqual(out.follow_ups, ['A1c in 3 months']);
});

test('parseNote strips ```json fences and surrounding prose', () => {
  const fenced = 'Here you go:\n```json\n{"soap":{"plan":"rest"}}\n```\nThanks!';
  const out = scribe.parseNote(fenced);
  assert.equal(out.soap.plan, 'rest');
  assert.equal(out.soap.subjective, ''); // missing field normalized to empty
});

test('parseNote normalizes bad codes / follow_ups and never throws on shape', () => {
  const out = scribe.parseNote('{"soap":{},"codes":[{"description":"x"},null,{"foo":1}],"follow_ups":["ok","",3]}');
  assert.equal(out.codes.length, 1);            // the {foo:1} and null are dropped
  assert.equal(out.codes[0].system, 'ICD-10-CM'); // default system
  assert.deepEqual(out.follow_ups, ['ok']);
});

test('parseNote throws on empty or non-JSON input', () => {
  assert.throws(() => scribe.parseNote(''), /Empty model response/);
  assert.throws(() => scribe.parseNote('no json here'), /No JSON object/);
});

test('scribeController exposes the note endpoints', () => {
  const ctrl = require('../src/controllers/scribeController');
  for (const m of ['create', 'list', 'get', 'update', 'sign']) {
    assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  }
});

test('clinical_notes migration creates the table with a status column', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', '046_clinical_notes.sql'),
    'utf8',
  );
  assert.match(sql, /CREATE TABLE IF NOT EXISTS clinical_notes/);
  assert.match(sql, /status\s+TEXT\s+NOT NULL DEFAULT 'draft'/);
});
