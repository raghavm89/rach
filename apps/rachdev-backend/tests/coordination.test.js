'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const discharge = require('../src/services/discharge');

test('discharge buildSystemPrompt enforces the JSON contract', () => {
  const p = discharge.buildSystemPrompt();
  assert.ok(p.includes('"hospital_course"'));
  const custom = discharge.buildSystemPrompt('Custom rules');
  assert.ok(custom.startsWith('Custom rules'));
  assert.ok(custom.includes('"hospital_course"'));
});

test('parseSummary normalizes fields + medications, tolerates fences', () => {
  const out = discharge.parseSummary('```json\n{"diagnosis":"HAPO","hospital_course":"O2 + descent","medications":["Nifedipine","",3],"follow_up":"OPD 1w","advice":"rest"}\n```');
  assert.equal(out.diagnosis, 'HAPO');
  assert.deepEqual(out.medications, ['Nifedipine']);
  assert.equal(out.follow_up, 'OPD 1w');
});

test('parseSummary throws on empty / non-JSON', () => {
  assert.throws(() => discharge.parseSummary(''), /Empty model response/);
  assert.throws(() => discharge.parseSummary('nope'), /No JSON object/);
});

test('notesToContext flattens signed notes to assessment/plan lines', () => {
  const c = discharge.notesToContext([{ soap: { assessment: 'A', plan: 'P' } }, { soap: {} }]);
  assert.match(c, /Assessment: A/);
  assert.match(c, /Plan: P/);
});

test('coordinationController exposes beds/referrals/discharge/follow-up and audits as Kabir', () => {
  const ctrl = require('../src/controllers/coordinationController');
  for (const m of ['listBeds', 'upsertBed', 'updateBed', 'listReferrals', 'createReferral', 'updateReferral',
                   'generateDischarge', 'getDischarge', 'updateDischarge', 'signDischarge', 'scheduleFollowUp']) {
    assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  }
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'coordinationController.js'), 'utf8');
  assert.match(src, /agent: 'Kabir'/);
  assert.match(src, /'modified' : 'signed'/);        // discharge sign as-is / edited
});

test('076/077 migrations create coordination tables + seed Kabir', () => {
  const mig = (n) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', n), 'utf8');
  const c = mig('076_coordination.sql');
  assert.match(c, /CREATE TABLE IF NOT EXISTS beds/);
  assert.match(c, /CREATE TABLE IF NOT EXISTS referrals/);
  assert.match(c, /CREATE TABLE IF NOT EXISTS discharge_summaries/);
  assert.match(mig('077_agent_template_coordination.sql'), /'coordination', 'Kabir'/);
});
