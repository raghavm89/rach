'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const icu = require('../src/services/icu');

test('news2 aggregates vitals and skips missing params', () => {
  assert.equal(icu.news2({ rr: 16, spo2: 98, sbp: 120, hr: 70, temp: 37 }), 0); // all normal
  assert.equal(icu.news2({}), 0);                                                // nothing provided
  assert.ok(icu.news2({ rr: 30, spo2: 89, sbp: 88, hr: 135 }) >= 9);             // grossly abnormal
});

test('assess detects sepsis from qSOFA', () => {
  const { conditions } = icu.assess({ rr: 26, sbp: 92, gcs: 13, temp: 38.5, lactate: 4.2 });
  const s = conditions.find((c) => c.condition === 'sepsis');
  assert.ok(s, 'sepsis not detected');
  assert.equal(s.severity, 'critical');       // qSOFA≥2 + lactate≥4
  assert.ok(s.evidence.length > 0);
});

test('assess detects a silent MI from troponin without chest pain', () => {
  const { conditions } = icu.assess({ troponin: 0.9, ecg_note: 'ST elevation anterior' });
  const mi = conditions.find((c) => c.condition === 'mi');
  assert.ok(mi);
  assert.equal(mi.severity, 'critical');
  assert.ok(mi.evidence.some((e) => /silent/i.test(e)));
});

test('assess detects AKI and arrhythmia', () => {
  const aki = icu.assess({ creatinine: 3.6 }).conditions.find((c) => c.condition === 'aki');
  assert.ok(aki && aki.severity === 'critical');
  const arr = icu.assess({ hr: 158, ecg_note: 'irregular, AF' }).conditions.find((c) => c.condition === 'arrhythmia');
  assert.ok(arr && arr.severity === 'critical');
});

test('assess stays quiet for a stable patient', () => {
  const { conditions, news2 } = icu.assess({ hr: 72, rr: 15, sbp: 122, spo2: 98, temp: 36.8, gcs: 15 });
  assert.equal(conditions.length, 0);
  assert.equal(news2, 0);
});

test('generic deterioration fires when NEWS2 is high but no single condition matched', () => {
  const { conditions } = icu.assess({ rr: 23, spo2: 92, hr: 112 }); // elevated but no qSOFA≥2 / labs
  assert.ok(conditions.some((c) => c.condition === 'deterioration'));
});

test('buildMessage is a safe deterministic fallback', () => {
  const m = icu.buildMessage('Rfn Arjun', 'sepsis', ['RR 26', 'SBP 92'], 8);
  assert.match(m, /sepsis/i);
  assert.match(m, /clinician review/i);
});

test('icuController exposes the endpoints and audits with agent Umeed', () => {
  const ctrl = require('../src/controllers/icuController');
  for (const m of ['recordObservation', 'board', 'listAlerts', 'acknowledge', 'resolve']) {
    assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  }
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'icuController.js'), 'utf8');
  assert.match(src, /agent: 'Umeed'/);
  assert.match(src, /decision: 'flagged'/);
});

test('071 migration creates icu tables; 072 seeds Umeed', () => {
  const mig = (n) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', n), 'utf8');
  assert.match(mig('071_icu.sql'), /CREATE TABLE IF NOT EXISTS icu_observations/);
  assert.match(mig('071_icu.sql'), /CREATE TABLE IF NOT EXISTS icu_alerts/);
  assert.match(mig('072_agent_template_icu.sql'), /'icu', 'Umeed'/);
});
