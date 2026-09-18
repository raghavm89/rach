'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeReporter } = require('../src/metrics');

test('counts requests per primitive, errors, and average latency', () => {
  const r = makeReporter({ ref: 'p1', url: 'http://cp/ingest', token: 't', fetchImpl: async () => ({ ok: true }) });
  r.inc({ primitive: 'rest', status: 200, ms: 100, bytes: 50 });
  r.inc({ primitive: 'rest', status: 500, ms: 200, bytes: 50 });
  r.inc({ primitive: 'auth', status: 200, ms: 60 });
  const samples = r.toSamples(r.snapshot());
  const by = Object.fromEntries(samples.map((s) => [s.metric, s.value]));
  assert.equal(by['requests.total'], 3);
  assert.equal(by['requests.rest'], 2);
  assert.equal(by['requests.auth'], 1);
  assert.equal(by['response.errors'], 1);
  assert.equal(by['response.ms'], 120);   // (100+200+60)/3
  assert.equal(by['net.bytes'], 100);
});

test('flush posts the batch and resets; empty window is a no-op', async () => {
  let posted = null;
  const r = makeReporter({ ref: 'p1', url: 'http://cp/ingest', token: 'svc', fetchImpl: async (u, o) => { posted = JSON.parse(o.body); return { ok: true }; } });
  assert.equal(await r.flush(), null);      // nothing recorded → no post
  assert.equal(posted, null);
  r.inc({ primitive: 'gateway', status: 200, ms: 10 });
  const samples = await r.flush();
  assert.ok(samples);
  assert.equal(posted.ref, 'p1');
  assert.ok(posted.samples.some((s) => s.metric === 'requests.total' && s.value === 1));
  // counters reset after flush
  assert.equal(r.snapshot().total, 0);
});
