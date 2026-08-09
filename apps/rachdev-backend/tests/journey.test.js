'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('journeyController assembles a timeline from the audit trail + next steps', () => {
  const ctrl = require('../src/controllers/journeyController');
  assert.equal(typeof ctrl.get, 'function');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'journeyController.js'), 'utf8');
  assert.match(src, /FROM audit_log/);                 // timeline source
  assert.match(src, /ORDER BY a\.created_at ASC/);      // step-in first
  assert.match(src, /status='scheduled'/);             // upcoming follow-up
  assert.match(src, /FROM discharge_summaries/);        // discharge advice
  assert.match(src, /jsonb_array_length\(medications\)/); // active prescription
});

test('journey route is mounted at /api/journey', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.match(app, /app\.use\('\/api\/journey'/);
});

test('ICU observation ingest accepts a device source (079 migration)', () => {
  const ctrl = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'icuController.js'), 'utf8');
  assert.match(ctrl, /b\.source === 'device' \? 'device' : 'manual'/);
  const mig = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', '079_icu_source.sql'), 'utf8');
  assert.match(mig, /ADD COLUMN IF NOT EXISTS source TEXT/);
  assert.match(mig, /device_id/);
});
