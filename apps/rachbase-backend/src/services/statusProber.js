'use strict';

/**
 * Status prober — on a fixed tick, checks each public component and records one row per
 * component in `status_probes`. The public status page aggregates those rows into current
 * state, uptime %, and the 90-day history bars.
 *
 * Component probes (by key):
 *   control-plane / database — a `SELECT 1` round-trip (latency → degraded if slow)
 *   deploy                   — outbox health (dead-letters / stuck backlog)
 *   region-* (site_id set)   — the site-controller's readiness via the site API (pro_tier only)
 *   dashboard / rachdev      — optional HTTP probe of STATUS_DASHBOARD_URL / STATUS_RACHDEV_URL
 *
 * A probe never throws out of the tick — a failed check is recorded as ok=false so the outage
 * shows on the page. Mirrors services/endpointProber.js.
 */

const { pool, flags } = require('@rach/core');
const siteClient = require('./siteClient');
const siteRegistry = require('./siteRegistry');

const TICK_MS       = Number(process.env.STATUS_PROBE_TICK_MS) || 60 * 1000; // probe every 60s
const HTTP_TIMEOUT  = 10 * 1000;
const SLOW_MS       = Number(process.env.STATUS_SLOW_MS) || 750;   // latency → degraded
const RETAIN_DAYS   = Number(process.env.STATUS_RETAIN_DAYS) || 120;
const PRUNE_EVERY   = 60; // prune ~hourly at a 60s tick

let timer = null;
let running = false;
let ticks = 0;

// ── Pure classifiers (unit-tested) ──────────────────────────────────────────

// Outbox → deploy-pipeline health. deadLetters = permanently-failed rows in the window;
// stuckOld = undelivered rows older than the DOWN threshold; stuckWarn = older than WARN.
function classifyOutbox({ deadLetters = 0, stuckOld = 0, stuckWarn = 0 } = {}) {
  if (deadLetters > 0 || stuckOld > 0) {
    return { ok: false, degraded: false, detail: `${deadLetters} dead-lettered, ${stuckOld} stuck` };
  }
  if (stuckWarn > 0) return { ok: true, degraded: true, detail: `${stuckWarn} delayed deliveries` };
  return { ok: true, degraded: false, detail: 'flowing' };
}

const latencyDegraded = (ms, slow = SLOW_MS) => ms >= slow;

// ── Probe implementations ───────────────────────────────────────────────────

async function probePing() {
  const t0 = Date.now();
  await pool.query('SELECT 1');
  const ms = Date.now() - t0;
  return { ok: true, degraded: latencyDegraded(ms), latency_ms: ms, detail: `${ms}ms` };
}

async function probeDeploy() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE failed_at IS NOT NULL AND failed_at > NOW() - INTERVAL '1 hour')                 AS dead_letters,
      COUNT(*) FILTER (WHERE delivered_at IS NULL AND failed_at IS NULL AND created_at < NOW() - INTERVAL '15 minutes') AS stuck_old,
      COUNT(*) FILTER (WHERE delivered_at IS NULL AND failed_at IS NULL AND created_at < NOW() - INTERVAL '5 minutes')  AS stuck_warn
    FROM site_outbox`);
  const r = rows[0] || {};
  return classifyOutbox({
    deadLetters: Number(r.dead_letters || 0),
    stuckOld: Number(r.stuck_old || 0),
    stuckWarn: Number(r.stuck_warn || 0),
  });
}

async function probeSite(siteId) {
  const site = await siteRegistry.resolveSite(siteId);
  if (!site) return null; // site not registered → don't fabricate a probe
  const t0 = Date.now();
  await siteClient.fetchCapabilities({ siteId }); // throws on unreachable/unhealthy
  const ms = Date.now() - t0;
  return { ok: true, degraded: latencyDegraded(ms, SLOW_MS * 2), latency_ms: ms, detail: `${ms}ms` };
}

async function probeHttp(url) {
  if (!url) return null; // not configured → skip (component shows "—")
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT);
  const t0 = Date.now();
  try {
    const resp = await fetch(url, { method: 'GET', redirect: 'manual', signal: controller.signal });
    const ms = Date.now() - t0;
    const ok = resp.status < 500;
    return { ok, degraded: ok && (resp.status >= 400 || latencyDegraded(ms)), latency_ms: ms, detail: `HTTP ${resp.status}` };
  } catch (e) {
    return { ok: false, degraded: false, latency_ms: Date.now() - t0, detail: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

// Route a component to its probe. Site-bound components use the site check; others by key.
async function probeComponent(c) {
  try {
    if (c.site_id) return await probeSite(c.site_id);
    switch (c.key) {
      case 'control-plane':
      case 'database': return await probePing();
      case 'deploy':   return await probeDeploy();
      case 'dashboard':return await probeHttp(process.env.STATUS_DASHBOARD_URL);
      default:         return await probeHttp(process.env[`STATUS_URL_${c.key.toUpperCase().replace(/-/g, '_')}`]);
    }
  } catch (e) {
    return { ok: false, degraded: false, latency_ms: null, detail: (e && e.message ? String(e.message) : 'error').slice(0, 200) };
  }
}

async function record(componentKey, r) {
  if (!r) return; // skipped (unconfigured / unregistered)
  await pool.query(
    'INSERT INTO status_probes (component_key, ok, degraded, latency_ms, detail) VALUES ($1,$2,$3,$4,$5)',
    [componentKey, !!r.ok, !!r.degraded, r.latency_ms ?? null, r.detail ?? null]
  );
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const { rows: components } = await pool.query('SELECT key, site_id FROM status_components WHERE enabled = TRUE');
    for (const c of components) {
      // Site-bound components only when the site pipeline is enabled.
      if (c.site_id && !flags.isEnabled('pro_tier')) continue;
      const r = await probeComponent(c);
      await record(c.key, r);
    }
    if (++ticks % PRUNE_EVERY === 0) {
      await pool.query("DELETE FROM status_probes WHERE ts < NOW() - ($1 || ' days')::interval", [RETAIN_DAYS]);
    }
  } catch (e) {
    console.error('[statusProber] tick error:', e && e.message);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return () => stop();
  tick(); // prime immediately
  timer = setInterval(tick, TICK_MS);
  timer.unref?.();
  console.log(`[statusProber] started (tick ${TICK_MS}ms)`);
  return () => stop();
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { start, stop, tick, classifyOutbox, latencyDegraded, probeComponent };
