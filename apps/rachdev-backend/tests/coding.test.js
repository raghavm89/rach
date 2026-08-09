'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const coding = require('../src/services/coding');

test('buildSystemPrompt keeps a custom persona but always appends the JSON contract', () => {
  assert.ok(coding.buildSystemPrompt().includes('denial'));
  const custom = coding.buildSystemPrompt('Custom coding rules');
  assert.ok(custom.startsWith('Custom coding rules'));
  assert.ok(custom.includes('"denial_risk"'));
});

test('parseClaim normalizes codes/charges and computes the total', () => {
  const out = coding.parseClaim(JSON.stringify({
    codes: [{ system: 'ICD-10-CM', code: 'J70.2', description: 'Altitude illness' }, { bad: 1 }],
    charges: [{ code: '99223', description: 'Admit', amount: 2500 }, { code: 'O2', description: 'Oxygen', amount: '800' }, { description: '', amount: -5 }],
    denial_risk: 'medium', denial_reasons: ['Unspecified laterality', ''], notes: 'check',
  }));
  assert.equal(out.codes.length, 1);
  assert.equal(out.charges.length, 2);        // empty desc/no code dropped
  assert.equal(out.total, 3300);              // 2500 + 800 (string coerced)
  assert.equal(out.denial_risk, 'medium');
  assert.deepEqual(out.denial_reasons, ['Unspecified laterality']);
});

test('parseClaim clamps a bad denial_risk and tolerates fences', () => {
  const out = coding.parseClaim('```json\n{"codes":[],"charges":[],"denial_risk":"catastrophic"}\n```');
  assert.equal(out.denial_risk, 'low');       // unknown → low
  assert.equal(out.total, 0);
});

test('parseClaim throws on empty / non-JSON', () => {
  assert.throws(() => coding.parseClaim(''), /Empty model response/);
  assert.throws(() => coding.parseClaim('nope'), /No JSON object/);
});

test('noteToText flattens a SOAP note and surfaces existing codes', () => {
  const t = coding.noteToText({ soap: { assessment: 'HAPO', plan: 'O2' }, codes: [{ system: 'ICD-10-CM', code: 'J70.2' }] });
  assert.match(t, /Assessment: HAPO/);
  assert.match(t, /J70\.2/);
});

test('claimsController exposes endpoints; only signed notes code; audits agent Rhea', () => {
  const ctrl = require('../src/controllers/claimsController');
  for (const m of ['generate', 'list', 'get', 'update', 'submit']) assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'claimsController.js'), 'utf8');
  assert.match(src, /Only a signed note can be coded/);
  assert.match(src, /agent: 'Rhea'/);
  assert.match(src, /Add at least one code before submitting/);
});

test('073 migration creates claims; 074 seeds Rhea', () => {
  const mig = (n) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', n), 'utf8');
  assert.match(mig('073_claims.sql'), /CREATE TABLE IF NOT EXISTS claims/);
  assert.match(mig('073_claims.sql'), /denial_risk/);
  assert.match(mig('074_agent_template_coding.sql'), /'coding', 'Rhea'/);
});
