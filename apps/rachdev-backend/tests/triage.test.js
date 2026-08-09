'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const triage = require('../src/services/triage');

test('buildSystemPrompt keeps a custom persona but always appends the JSON contract', () => {
  assert.ok(triage.buildSystemPrompt().includes('acuity'));
  const custom = triage.buildSystemPrompt('Custom triage rules');
  assert.ok(custom.startsWith('Custom triage rules'));
  assert.ok(custom.includes('"acuity"'));
});

test('parseTriage normalizes a clean object', () => {
  const out = triage.parseTriage(JSON.stringify({
    acuity: 'critical', acuity_score: 1, red_flags: ['SpO2 60%', 'confusion'],
    recommended_route: 'ICU', page_on_call: true, rationale: 'HAPO', disposition: 'ICU now',
  }));
  assert.equal(out.acuity, 'critical');
  assert.equal(out.acuity_score, 1);
  assert.deepEqual(out.red_flags, ['SpO2 60%', 'confusion']);
  assert.equal(out.recommended_route, 'ICU');
  assert.equal(out.page_on_call, true);
});

test('parseTriage clamps bad acuity/route/score to safe defaults + tolerates fences', () => {
  const out = triage.parseTriage('```json\n{"acuity":"nonsense","acuity_score":9,"recommended_route":"WARD"}\n```');
  assert.equal(out.acuity, 'routine');            // unknown → routine
  assert.equal(out.recommended_route, 'OPD');     // unknown → OPD
  assert.ok(out.acuity_score >= 1 && out.acuity_score <= 5);
  assert.deepEqual(out.red_flags, []);
});

test('parseTriage throws on empty / non-JSON', () => {
  assert.throws(() => triage.parseTriage(''), /Empty model response/);
  assert.throws(() => triage.parseTriage('nope'), /No JSON object/);
});

test('triageController exposes the endpoints and audits acuity', () => {
  const ctrl = require('../src/controllers/triageController');
  for (const m of ['create', 'list', 'get', 'acknowledge']) assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'triageController.js'), 'utf8');
  assert.match(src, /agent: 'Vihaan'/);
  assert.match(src, /'flagged' : 'created'/);      // critical/red-flag → flagged
});

test('068 migration creates triage_assessments with acuity + routing', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', '068_triage.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS triage_assessments/);
  assert.match(sql, /acuity/);
  assert.match(sql, /recommended_route/);
});
