'use strict';

/**
 * Status page — pure derivations (no DB): component state from probes, uptime %, daily
 * history bucketing, overall roll-up, and the deploy-pipeline (outbox) classifier.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/services/statusService');
const P = require('../src/services/statusProber');

test('componentStateFromProbes reads the latest probe', () => {
  assert.equal(S.componentStateFromProbes([]), 'unknown');
  assert.equal(S.componentStateFromProbes(null), 'unknown');
  assert.equal(S.componentStateFromProbes([{ ok: true, degraded: false }]), 'operational');
  assert.equal(S.componentStateFromProbes([{ ok: true, degraded: true }]), 'degraded');
  assert.equal(S.componentStateFromProbes([{ ok: false, degraded: false }]), 'down');
  // newest-first: only the head matters
  assert.equal(S.componentStateFromProbes([{ ok: false }, { ok: true }]), 'down');
});

test('uptimePct counts ok probes; degraded still counts as up; null when empty', () => {
  assert.equal(S.uptimePct([]), null);
  assert.equal(S.uptimePct([{ ok: true }, { ok: true }]), 100);
  assert.equal(S.uptimePct([{ ok: true }, { ok: false }]), 50);
  assert.equal(S.uptimePct([{ ok: true, degraded: true }, { ok: false }, { ok: false }, { ok: false }]), 25);
});

test('dailyHistory buckets probes into worst-of daily cells', () => {
  const now = Date.UTC(2026, 8, 3, 12, 0, 0); // 2026-09-03T12:00Z
  const DAY = 24 * 60 * 60 * 1000;
  const probes = [
    { ok: true, degraded: false, ts: new Date(now).toISOString() },          // today: operational
    { ok: false, degraded: false, ts: new Date(now - DAY).toISOString() },    // yesterday: down
    { ok: true, degraded: true, ts: new Date(now - 2 * DAY).toISOString() },  // 2d ago: degraded
    // 3d ago: no probe → 'none'
  ];
  const cells = S.dailyHistory(probes, 4, now);
  assert.equal(cells.length, 4);
  assert.equal(cells[0].state, 'none');        // oldest (3d ago)
  assert.equal(cells[1].state, 'degraded');
  assert.equal(cells[2].state, 'down');
  assert.equal(cells[3].state, 'operational'); // newest (today)
});

test('dailyHistory worst-of: a single down in a day dominates', () => {
  const now = Date.UTC(2026, 8, 3, 23, 0, 0);
  const start = new Date(now); start.setUTCHours(1, 0, 0, 0);
  const probes = [
    { ok: true, degraded: false, ts: new Date(start.getTime()).toISOString() },
    { ok: false, degraded: false, ts: new Date(start.getTime() + 3600e3).toISOString() },
    { ok: true, degraded: true, ts: new Date(start.getTime() + 7200e3).toISOString() },
  ];
  const cells = S.dailyHistory(probes, 1, now);
  assert.equal(cells[0].state, 'down');
});

test('overallStatus rolls component states up', () => {
  assert.equal(S.overallStatus(['operational', 'operational']), 'operational');
  assert.equal(S.overallStatus(['operational', 'degraded']), 'degraded');
  assert.equal(S.overallStatus(['operational', 'down']), 'partial_outage');
  assert.equal(S.overallStatus(['down', 'down']), 'major_outage');
  assert.equal(S.overallStatus(['operational', 'unknown']), 'operational'); // unknown ignored
  assert.equal(S.overallStatus(['operational'], true), 'maintenance');      // maintenance flag
  // an outage beats an active maintenance flag
  assert.equal(S.overallStatus(['down'], true), 'major_outage');
});

test('overallStatus: ALL components unknown → "unknown", not a false "operational"', () => {
  // A dead prober / down backend leaves every component without a fresh reading. This must NOT
  // render "All Systems Operational" (the audit's false-green).
  assert.equal(S.overallStatus(['unknown', 'unknown']), 'unknown');
  assert.equal(S.overallStatus(['unknown'], true), 'unknown'); // still unknown even with maint flag
  assert.equal(S.overallStatus([]), 'operational');            // genuinely no components configured
});

test('isStale: a probe older than the freshness window reads stale', () => {
  const now = 1_000_000_000;
  assert.equal(S.isStale(null, now), true);                 // no probe at all
  assert.equal(S.isStale(now - 1000, now, 60_000), false);  // 1s old, 60s window
  assert.equal(S.isStale(now - 120_000, now, 60_000), true); // 2min old, 60s window
});

test('dailyHistoryFromBuckets: fills gaps with none, worst-of state, uptime from up/n', () => {
  const now = Date.UTC(2026, 8, 3, 12, 0, 0);
  const buckets = [
    { day: '2026-09-03', any_down: false, any_degraded: false, n: 10, up: 10 }, // today: operational 100%
    { day: '2026-09-02', any_down: true,  any_degraded: false, n: 10, up: 6 },  // down 60%
    // 2026-09-01 missing → none
    { day: '2026-08-31', any_down: false, any_degraded: true,  n: 4,  up: 4 },  // degraded
  ];
  const cells = S.dailyHistoryFromBuckets(buckets, 4, now);
  assert.equal(cells.length, 4);
  assert.deepEqual(cells.map((c) => c.state), ['degraded', 'none', 'down', 'operational']);
  assert.equal(cells[3].uptime, 100);
  assert.equal(cells[2].uptime, 60);
  assert.equal(cells[1].uptime, null); // no data that day
});

test('uptimeFromBuckets: aggregate Σup/Σn, null when empty', () => {
  assert.equal(S.uptimeFromBuckets([]), null);
  assert.equal(S.uptimeFromBuckets([{ n: 10, up: 9 }, { n: 10, up: 8 }]), 85);
});

test('classifyOutbox: dead-letters or stuck → down; delayed → degraded; else flowing', () => {
  assert.deepEqual(P.classifyOutbox({}).ok, true);
  assert.equal(P.classifyOutbox({ deadLetters: 1 }).ok, false);
  assert.equal(P.classifyOutbox({ stuckOld: 2 }).ok, false);
  const warn = P.classifyOutbox({ stuckWarn: 3 });
  assert.equal(warn.ok, true);
  assert.equal(warn.degraded, true);
  const good = P.classifyOutbox({ deadLetters: 0, stuckOld: 0, stuckWarn: 0 });
  assert.equal(good.ok, true);
  assert.equal(good.degraded, false);
});

test('latencyDegraded flags slow round-trips', () => {
  assert.equal(P.latencyDegraded(100, 750), false);
  assert.equal(P.latencyDegraded(800, 750), true);
  assert.equal(P.latencyDegraded(750, 750), true);
});
