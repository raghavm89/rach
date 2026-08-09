'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const interactions = require('../src/services/interactions');
const prescribe = require('../src/services/prescribe');

test('interaction checker flags a major warfarin + NSAID interaction', () => {
  const w = interactions.checkInteractions([{ drug: 'Warfarin 5mg' }, { drug: 'Ibuprofen 400mg' }]);
  assert.equal(w.length, 1);
  assert.equal(w[0].severity, 'major');
  assert.match(w[0].description, /bleeding/i);
});

test('interaction checker is order-agnostic and catches ACE + potassium (moderate)', () => {
  const a = interactions.checkInteractions([{ drug: 'Ramipril' }, { drug: 'Spironolactone' }]);
  const b = interactions.checkInteractions([{ drug: 'Spironolactone' }, { drug: 'Ramipril' }]);
  assert.equal(a.length, 1);
  assert.equal(a[0].severity, 'moderate');
  assert.deepEqual(a.map((x) => x.severity), b.map((x) => x.severity));
});

test('interaction checker flags duplicate therapy', () => {
  const w = interactions.checkInteractions([{ drug: 'Paracetamol' }, { drug: 'paracetamol' }]);
  assert.ok(w.some((x) => /duplicate/i.test(x.description)));
});

test('interaction checker stays quiet for a safe combination + sorts major first', () => {
  assert.deepEqual(interactions.checkInteractions([{ drug: 'Paracetamol' }, { drug: 'Amoxicillin' }]), []);
  const mixed = interactions.checkInteractions([{ drug: 'Ramipril' }, { drug: 'Spironolactone' }, { drug: 'Warfarin' }, { drug: 'Aspirin' }]);
  assert.equal(mixed[0].severity, 'major');       // warfarin+aspirin sorts before ace+k
});

test('parseRx normalizes medication rows and drops entries without a drug', () => {
  const out = prescribe.parseRx(JSON.stringify({ medications: [
    { drug: 'Paracetamol', strength: '500 mg', dose: '1 tab', frequency: 'TDS', route: 'PO', duration: '3 days' },
    { instructions: 'no drug named' },
  ] }));
  assert.equal(out.length, 1);
  assert.equal(out[0].drug, 'Paracetamol');
  assert.equal(out[0].frequency, 'TDS');
});

test('parseRx throws on empty / non-JSON', () => {
  assert.throws(() => prescribe.parseRx(''), /Empty model response/);
  assert.throws(() => prescribe.parseRx('nope'), /No JSON object/);
});

test('scribeController exposes prescribe + checkInteractions; 078 adds medications', () => {
  const ctrl = require('../src/controllers/scribeController');
  for (const m of ['prescribe', 'checkInteractions']) assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'scribeController.js'), 'utf8');
  assert.match(src, /agent: 'Naina'[\s\S]*Prescription drafted/);
  const mig = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', '078_prescriptions.sql'), 'utf8');
  assert.match(mig, /ADD COLUMN IF NOT EXISTS medications JSONB/);
});
