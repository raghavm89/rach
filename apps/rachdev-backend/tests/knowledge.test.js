'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const knowledge = require('../src/services/knowledge');

test('buildSystemPrompt enforces the grounded, no-diagnosis contract', () => {
  const p = knowledge.buildSystemPrompt();
  assert.ok(p.includes('"can_answer"'));
  assert.match(p, /ONLY the (approved )?reference sources|only from the approved/i);
});

test('retrieve ranks approved docs by keyword overlap with the question', () => {
  const docs = [
    { id: 1, title: 'HAPO protocol', body: 'high altitude pulmonary oedema oxygen descent' },
    { id: 2, title: 'Leave policy', body: 'annual leave casual leave' },
    { id: 3, title: 'Frostbite care', body: 'rewarming cold injury altitude' },
  ];
  const top = knowledge.retrieve('What is the protocol for HAPO at altitude?', docs, 2);
  assert.equal(top[0].id, 1);                 // best overlap first
  assert.ok(top.length <= 2);
});

test('parseAnswer normalizes citations and can_answer, tolerates fences', () => {
  const out = knowledge.parseAnswer('```json\n{"answer":"See source","citations":[{"title":"HAPO","ref":"AFMS"},{"bad":1}],"can_answer":true}\n```');
  assert.equal(out.answer, 'See source');
  assert.equal(out.citations.length, 1);
  assert.equal(out.citations[0].title, 'HAPO');
  assert.equal(out.can_answer, true);
});

test('generateAnswer refuses (no model call) when the approved library is empty', async () => {
  const out = await knowledge.generateAnswer({ tenantId: 1, userId: 1, question: 'anything', docs: [] });
  assert.equal(out.can_answer, false);
  assert.deepEqual(out.citations, []);
  assert.equal(out.model, null);
});

test('knowledgeController exposes docs CRUD + ask and audits with agent Ira', () => {
  const ctrl = require('../src/controllers/knowledgeController');
  for (const m of ['listDocs', 'createDoc', 'deleteDoc', 'ask']) assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'knowledgeController.js'), 'utf8');
  assert.match(src, /agent: 'Ira'/);
});

test('knowledge web-reference bypass is OFF by default and PHI-free', async () => {
  const web = require('../src/services/knowledgeWeb');
  assert.equal(web.enabled(), false);            // no KNOWLEDGE_WEB_ENABLED
  const out = await web.search('HAPO management');
  assert.equal(out.enabled, false);
  assert.equal(out.source, 'off');
  assert.deepEqual(out.references, []);
  assert.match(out.note, /air-gapped|disabled/i);
  const ctrl = require('../src/controllers/knowledgeController');
  assert.equal(typeof ctrl.webReferences, 'function');
});

test('069 migration creates knowledge_docs; 070 seeds Vihaan + Ira templates', () => {
  const mig = (n) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations', n), 'utf8');
  assert.match(mig('069_knowledge.sql'), /CREATE TABLE IF NOT EXISTS knowledge_docs/);
  const t = mig('070_agent_templates_v2.sql');
  assert.match(t, /'triage', 'Vihaan'/);
  assert.match(t, /'knowledge', 'Ira'/);
});
