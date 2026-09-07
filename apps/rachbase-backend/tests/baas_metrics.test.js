'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const metrics = require('../src/services/baasMetrics');

const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();

async function db() {
  const { PGlite } = await import('@electric-sql/pglite');
  const p = new PGlite();
  await p.query(`CREATE TABLE projects (id SERIAL PRIMARY KEY)`);
  await p.query(`CREATE TABLE baas_metrics (id BIGSERIAL PRIMARY KEY, project_id INTEGER, metric TEXT, value DOUBLE PRECISION, labels JSONB DEFAULT '{}', ts TIMESTAMPTZ DEFAULT NOW())`);
  await p.query(`INSERT INTO projects DEFAULT VALUES`);
  return { query: (t, params) => (params === undefined ? p.query(t) : p.query(t, params)) };
}

test('record filters invalid samples, latest returns newest per metric', { skip: !HAVE_PGLITE }, async () => {
  const d = await db();
  const n = await metrics.record(1, [
    { metric: 'cpu', value: 10 },
    { metric: 'cpu', value: 20 },
    { metric: 'bad name', value: 1 },   // invalid metric name → dropped
    { metric: 'mem', value: 'x' },       // non-numeric → dropped
    { metric: 'requests', value: 5, labels: { primitive: 'rest' } },
  ], { db: d });
  assert.equal(n, 3);
  const latest = await metrics.latest(1, ['cpu', 'requests'], { db: d });
  assert.equal(latest.cpu.value, 20);          // newest
  assert.equal(latest.requests.value, 5);
});

test('series buckets values over a time window', { skip: !HAVE_PGLITE }, async () => {
  const d = await db();
  await metrics.record(1, [
    { metric: 'requests', value: 3, ts: new Date(Date.now() - 60_000).toISOString() },
    { metric: 'requests', value: 4, ts: new Date(Date.now() - 30_000).toISOString() },
    { metric: 'requests', value: 5, ts: new Date().toISOString() },
  ], { db: d });
  const s = await metrics.series(1, { metric: 'requests', minutes: 10, buckets: 60 }, { db: d });
  assert.ok(s.length >= 1);
  const totals = s.reduce((a, b) => a + b.total, 0);
  assert.equal(totals, 12);                     // 3+4+5 across buckets
});
