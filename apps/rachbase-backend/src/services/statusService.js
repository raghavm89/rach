'use strict';

/**
 * Status service — reads the status_* tables and derives the public health picture the
 * status page renders (current component states, uptime %, 90-day history bars, active +
 * past incidents, scheduled maintenance). The pure derivation helpers (no DB) are exported
 * for unit tests; the async functions assemble the public payload.
 *
 * Nothing here is tenant-scoped — this is platform-wide, PUBLIC health. Callers must not add
 * any per-tenant or internal detail (hostnames, IPs) to what this returns.
 */

const { pool } = require('@rach/core');

const DAY_MS = 24 * 60 * 60 * 1000;

// A component whose newest probe is older than this is treated as UNKNOWN, not "still whatever it
// last was" — otherwise a dead prober (or a down backend) leaves a stale `ok` probe reading
// "operational" forever. Default: 5× the probe tick, floored at 5 minutes.
const TICK_MS  = Number(process.env.STATUS_PROBE_TICK_MS) || 60 * 1000;
const STALE_MS = Number(process.env.STATUS_STALE_MS) || Math.max(5 * TICK_MS, 5 * 60 * 1000);
// Server-side cache TTL for the assembled public payload. The public endpoint is unauthenticated,
// so without this each hit re-runs the aggregation (a scrape or an incident spike could hammer the
// DB during the very outage it reports).
const CACHE_MS = Number(process.env.STATUS_CACHE_MS) || 30 * 1000;

// ── Pure derivations (unit-tested) ──────────────────────────────────────────

// Latest probe → component state. `probes` newest-first. No probes → 'unknown'.
function componentStateFromProbes(probes) {
  if (!probes || probes.length === 0) return 'unknown';
  const latest = probes[0];
  if (!latest.ok) return 'down';
  if (latest.degraded) return 'degraded';
  return 'operational';
}

// Uptime % over the given probes (a probe with ok=true counts as up; degraded is still up).
// Returns null when there is no data (so the UI can show "—" rather than a fake 100%).
function uptimePct(probes) {
  if (!probes || probes.length === 0) return null;
  const up = probes.filter((p) => p.ok).length;
  return Math.round((up / probes.length) * 10000) / 100; // 2 dp
}

// Bucket probes into `days` daily cells (oldest → newest). Each cell's state is the worst
// outcome that day: any down → 'down', else any degraded → 'degraded', else 'operational';
// no probes that day → 'none'. `now` is injectable for tests.
function dailyHistory(probes, days = 90, now = Date.now()) {
  const cells = [];
  const startOfToday = new Date(now); startOfToday.setUTCHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = todayMs - i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const inDay = (probes || []).filter((p) => {
      const t = new Date(p.ts).getTime();
      return t >= dayStart && t < dayEnd;
    });
    let state = 'none';
    if (inDay.length) {
      if (inDay.some((p) => !p.ok)) state = 'down';
      else if (inDay.some((p) => p.degraded)) state = 'degraded';
      else state = 'operational';
    }
    cells.push({ date: new Date(dayStart).toISOString().slice(0, 10), state, uptime: uptimePct(inDay) });
  }
  return cells;
}

// Roll component states up into one overall banner state.
function overallStatus(states, hasActiveMaintenance = false) {
  const real = states.filter((s) => s !== 'unknown');
  // Nothing has a fresh reading (e.g. the prober is dead / the backend just recovered) — say so
  // rather than defaulting to "All Systems Operational", which is the exact false-green the audit
  // flagged. A truly empty component set (no components configured) also reads unknown.
  if (real.length === 0) return states.length ? 'unknown' : 'operational';
  const down = real.filter((s) => s === 'down').length;
  const degraded = real.filter((s) => s === 'degraded').length;
  if (down > 0) return down >= real.length ? 'major_outage' : 'partial_outage';
  if (degraded > 0) return 'degraded';
  if (hasActiveMaintenance) return 'maintenance';
  return 'operational';
}

const OVERALL_LABEL = {
  operational: 'All Systems Operational',
  degraded: 'Degraded Performance',
  partial_outage: 'Partial System Outage',
  major_outage: 'Major System Outage',
  maintenance: 'Under Maintenance',
  unknown: 'Status Unknown',
};

// ── Aggregated-history helpers (pure; fed by SQL daily buckets, not raw probes) ─────────────
// A DB daily bucket: { day:'YYYY-MM-DD', any_down, any_degraded, n, up }.
function bucketState(b) {
  if (b.any_down) return 'down';
  if (b.any_degraded) return 'degraded';
  return 'operational';
}

// Build `days` daily cells (oldest → newest) from pre-aggregated buckets, filling gaps with 'none'.
// Same shape as dailyHistory() but O(days) instead of O(probes) — no raw rows crossed the wire.
function dailyHistoryFromBuckets(buckets, days = 90, now = Date.now()) {
  const byDay = new Map((buckets || []).map((b) => [String(b.day), b]));
  const startOfToday = new Date(now); startOfToday.setUTCHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(todayMs - i * DAY_MS).toISOString().slice(0, 10);
    const b = byDay.get(key);
    let state = 'none', uptime = null;
    if (b && Number(b.n) > 0) { state = bucketState(b); uptime = Math.round((Number(b.up) / Number(b.n)) * 10000) / 100; }
    cells.push({ date: key, state, uptime });
  }
  return cells;
}

// Overall uptime % across buckets (Σup / Σn). Null when there is no data.
function uptimeFromBuckets(buckets) {
  let up = 0, n = 0;
  for (const b of buckets || []) { up += Number(b.up) || 0; n += Number(b.n) || 0; }
  return n ? Math.round((up / n) * 10000) / 100 : null;
}

// A component reading is stale (→ unknown) when its newest probe predates the freshness window.
function isStale(latestTsMs, now = Date.now(), maxAgeMs = STALE_MS) {
  if (latestTsMs == null) return true;
  return (now - latestTsMs) > maxAgeMs;
}

// ── DB reads ────────────────────────────────────────────────────────────────

async function listComponents() {
  const { rows } = await pool.query(
    'SELECT key, name, component_group, sort, site_id FROM status_components WHERE enabled = TRUE ORDER BY sort, name'
  );
  return rows;
}

async function probesSince(componentKey, sinceMs) {
  const { rows } = await pool.query(
    'SELECT ok, degraded, latency_ms, ts FROM status_probes WHERE component_key = $1 AND ts >= $2 ORDER BY ts DESC',
    [componentKey, new Date(sinceMs)]
  );
  return rows;
}

// Pre-aggregate a component's probes into UTC daily buckets IN THE DATABASE, so the page reads at
// most ~90 rows/component instead of tens of thousands. Uses idx_status_probes_key_ts.
async function componentDailyBuckets(componentKey, sinceMs) {
  const { rows } = await pool.query(
    `SELECT to_char(date_trunc('day', ts AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
            bool_or(NOT ok)      AS any_down,
            bool_or(degraded)    AS any_degraded,
            COUNT(*)::int        AS n,
            COUNT(*) FILTER (WHERE ok)::int AS up
       FROM status_probes
      WHERE component_key = $1 AND ts >= $2
      GROUP BY 1`,
    [componentKey, new Date(sinceMs)]
  );
  return rows;
}

// The single newest probe for a component (current state + freshness). One row via the index.
async function latestProbe(componentKey) {
  const { rows } = await pool.query(
    'SELECT ok, degraded, ts FROM status_probes WHERE component_key = $1 ORDER BY ts DESC LIMIT 1',
    [componentKey]
  );
  return rows[0] || null;
}

async function activeIncidents() {
  const { rows } = await pool.query(
    `SELECT * FROM status_incidents
       WHERE resolved_at IS NULL AND status <> 'completed'
       ORDER BY started_at DESC`
  );
  return withUpdatesAndComponents(rows);
}

async function pastIncidents(limit = 20) {
  const { rows } = await pool.query(
    `SELECT * FROM status_incidents
       WHERE resolved_at IS NOT NULL OR status = 'completed'
       ORDER BY COALESCE(resolved_at, started_at) DESC
       LIMIT $1`, [limit]
  );
  return withUpdatesAndComponents(rows);
}

// Scheduled maintenance that hasn't started yet (upcoming).
async function upcomingMaintenance() {
  const { rows } = await pool.query(
    `SELECT * FROM status_incidents
       WHERE kind = 'maintenance' AND status = 'scheduled' AND started_at > NOW()
       ORDER BY started_at ASC`
  );
  return withUpdatesAndComponents(rows);
}

async function withUpdatesAndComponents(incidents) {
  if (!incidents.length) return [];
  const ids = incidents.map((i) => i.id);
  const { rows: updates } = await pool.query(
    'SELECT id, incident_id, status, body, created_at FROM status_incident_updates WHERE incident_id = ANY($1) ORDER BY created_at DESC',
    [ids]
  );
  const { rows: comps } = await pool.query(
    'SELECT incident_id, component_key FROM status_incident_components WHERE incident_id = ANY($1)',
    [ids]
  );
  return incidents.map((i) => ({
    id: i.id,
    kind: i.kind,
    title: i.title,
    status: i.status,
    impact: i.impact,
    startedAt: i.started_at,
    scheduledEnd: i.scheduled_end,
    resolvedAt: i.resolved_at,
    components: comps.filter((c) => c.incident_id === i.id).map((c) => c.component_key),
    updates: updates.filter((u) => u.incident_id === i.id)
      .map((u) => ({ status: u.status, body: u.body, createdAt: u.created_at })),
  }));
}

// Assemble the full public status payload — aggregated in SQL, current state derived from the
// single latest probe, and a component with no fresh probe reported as UNKNOWN rather than a stale
// "operational". The result is cached for CACHE_MS (see getPublicStatus).
async function assemblePublicStatus({ days = 90 } = {}) {
  const now = Date.now();
  const components = await listComponents();
  const sinceMs = now - days * DAY_MS;

  const enriched = await Promise.all(components.map(async (c) => {
    const [buckets, latest] = await Promise.all([
      componentDailyBuckets(c.key, sinceMs),
      latestProbe(c.key),
    ]);
    const latestTsMs = latest ? new Date(latest.ts).getTime() : null;
    // Fresh latest probe → its state; no probe or a stale one → unknown.
    const state = isStale(latestTsMs, now)
      ? 'unknown'
      : componentStateFromProbes([{ ok: latest.ok, degraded: latest.degraded }]);
    return {
      key: c.key,
      name: c.name,
      group: c.component_group,
      state,
      uptime: uptimeFromBuckets(buckets),
      history: dailyHistoryFromBuckets(buckets, days, now),
    };
  }));

  const [active, past, maintenance] = await Promise.all([
    activeIncidents(), pastIncidents(20), upcomingMaintenance(),
  ]);

  const hasActiveMaintenance = active.some((i) => i.kind === 'maintenance' && i.status === 'in_progress');
  const overall = overallStatus(enriched.map((c) => c.state), hasActiveMaintenance);

  return {
    overall,
    overallLabel: OVERALL_LABEL[overall],
    updatedAt: new Date(now).toISOString(),
    windowDays: days,
    components: enriched,
    activeIncidents: active,
    scheduledMaintenance: maintenance,
    pastIncidents: past,
  };
}

// Small in-process TTL cache keyed by the requested window. Shields the DB from the unauthenticated
// public endpoint; the payload is platform-wide (not per-user), so one cache serves everyone.
const _cache = new Map(); // days → { at, payload }
async function getPublicStatus({ days = 90 } = {}) {
  const hit = _cache.get(days);
  if (hit && (Date.now() - hit.at) < CACHE_MS) return hit.payload;
  const payload = await assemblePublicStatus({ days });
  _cache.set(days, { at: Date.now(), payload });
  return payload;
}

module.exports = {
  // pure
  componentStateFromProbes, uptimePct, dailyHistory, overallStatus, OVERALL_LABEL,
  bucketState, dailyHistoryFromBuckets, uptimeFromBuckets, isStale,
  // reads
  listComponents, probesSince, componentDailyBuckets, latestProbe,
  activeIncidents, pastIncidents, upcomingMaintenance, getPublicStatus,
};
