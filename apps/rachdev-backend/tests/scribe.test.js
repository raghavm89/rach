'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const scribe = require('../src/services/scribe');

test('buildSystemPrompt uses the persona (default or custom) and always enforces the JSON output contract', () => {
  assert.ok(scribe.buildSystemPrompt().includes('SOAP'));
  const custom = scribe.buildSystemPrompt('Custom scribe rules');
  assert.ok(custom.startsWith('Custom scribe rules'));   // custom persona preserved
  assert.ok(custom.includes('"soap"'));                  // JSON contract always appended
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

// ── generateNote resilience: prose → retry → clean error (no raw 500) ─────────
test('generateNote retries once and recovers when the first response is prose', async () => {
  const { gateway } = require('@rach/llm');
  const orig = gateway.chat;
  let calls = 0;
  gateway.chat = async () => {
    calls += 1;
    return calls === 1
      ? { text: 'Sure! Here is the note in plain words.', model: 'test' }
      : { text: '{"soap":{"subjective":"cough","objective":"","assessment":"","plan":"rest"},"codes":[],"follow_ups":[]}', model: 'test' };
  };
  try {
    const note = await scribe.generateNote({ tenantId: 1, userId: 1, transcript: 'medicine dolo' });
    assert.equal(calls, 2);                    // it retried
    assert.equal(note.soap.subjective, 'cough');
  } finally { gateway.chat = orig; }
});

test('generateNote surfaces a clean 502-style error when the model never returns JSON', async () => {
  const { gateway } = require('@rach/llm');
  const orig = gateway.chat;
  gateway.chat = async () => ({ text: 'no json here at all', model: 'test' });
  try {
    await assert.rejects(
      scribe.generateNote({ tenantId: 1, userId: 1, transcript: 'medicine dolo' }),
      (err) => err.code === 'MODEL_OUTPUT' && err.status === 502,
    );
  } finally { gateway.chat = orig; }
});
